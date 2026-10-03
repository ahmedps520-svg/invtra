import { createHmac, timingSafeEqual } from "node:crypto";
import type { Order } from "@prisma/client";
import { env } from "@/server/env";
import type { CheckoutContext, PaymentProvider } from "./types";

/**
 * Tap Payments (tap.company) — hosted checkout for Saudi Arabia and the GCC.
 *
 * `source.id = "src_all"` sends the customer to Tap's payment page, which offers every
 * method enabled on the merchant account: Apple Pay and Google Pay (no extra setup on
 * the hosted page), mada, Visa / Mastercard, STC Pay… Card and wallet data never touch
 * INVTRA.
 *
 * Amounts: Tap takes decimal major units (189.00 SAR); orders store minor units.
 * A charge is only trusted after INVTRA fetches it from Tap's API with the secret key —
 * webhook bodies and redirect parameters are hints, never proof of payment.
 *
 * Docs: https://developers.tap.company/reference/create-a-charge ·
 *       https://developers.tap.company/docs/webhook
 */

const API = "https://api.tap.company/v2";
const THREE_DECIMALS = new Set(["KWD", "BHD", "OMR", "JOD"]);

/** Charge states that will never become CAPTURED. */
export const TAP_FAILED_STATUSES = new Set(["ABANDONED", "CANCELLED", "FAILED", "DECLINED", "RESTRICTED", "VOID", "TIMEDOUT"]);

export class TapApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "TapApiError";
  }
}

export interface TapCharge {
  id: string;
  object?: string;
  status: string;
  amount: number;
  currency: string;
  live_mode?: boolean;
  reference?: { transaction?: string; order?: string; payment?: string; gateway?: string };
  transaction?: { url?: string; created?: string | number };
  metadata?: Record<string, string>;
  source?: { payment_method?: string; payment_type?: string };
  response?: { code?: string; message?: string };
}

function decimalsOf(currency: string) {
  return THREE_DECIMALS.has(currency.toUpperCase()) ? 3 : 2;
}

/** Minor units → Tap's decimal amount (69900 halalas → 699 SAR). */
export function toTapAmount(minor: number, currency: string): number {
  if (!Number.isInteger(minor) || minor <= 0) throw new TapApiError(`Invalid amount ${minor}`, null);
  return minor / 10 ** decimalsOf(currency);
}

/** Tap's decimal amount → minor units (699.0 SAR → 69900). */
export function fromTapAmount(amount: number, currency: string): number {
  return Math.round(Number(amount) * 10 ** decimalsOf(currency));
}

async function tapRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = env().TAP_SECRET_KEY;
  if (!key) throw new TapApiError("TAP_SECRET_KEY is not configured", null);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new TapApiError(`Network error calling Tap: ${(e as Error).message}`, null);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const errors = (json as { errors?: { description?: string }[] } | null)?.errors;
    throw new TapApiError(errors?.[0]?.description ?? `Tap HTTP ${res.status}`, res.status);
  }
  return json as T;
}

/** The authoritative state of a charge, straight from Tap. */
export async function retrieveTapCharge(chargeId: string): Promise<TapCharge> {
  if (!/^chg_[A-Za-z0-9]+$/.test(chargeId)) throw new TapApiError(`Not a Tap charge id: ${chargeId}`, null);
  return tapRequest<TapCharge>("GET", `/charges/${encodeURIComponent(chargeId)}`);
}

/** Split a display name into Tap's first/last name fields. */
function names(full: string | undefined, email: string | undefined) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts.shift() || email?.split("@")[0] || "Customer";
  return { first_name: first.slice(0, 50), ...(parts.length ? { last_name: parts.join(" ").slice(0, 50) } : {}) };
}

export function tapChargeRequest(order: Order, returnUrl: string, webhookUrl: string, ctx?: CheckoutContext) {
  return {
    amount: toTapAmount(order.amount, order.currency),
    currency: order.currency.toUpperCase(),
    customer_initiated: true,
    threeDSecure: true,
    save_card: false,
    description: (ctx?.description ?? `INVTRA ${order.plan} plan`).slice(0, 250),
    metadata: { orderId: order.id, plan: order.plan, eventId: order.eventId ?? "" },
    reference: { transaction: order.id, order: order.id },
    receipt: { email: true, sms: false },
    customer: { ...names(ctx?.customerName, ctx?.customerEmail), ...(ctx?.customerEmail ? { email: ctx.customerEmail } : {}) },
    ...(env().TAP_MERCHANT_ID ? { merchant: { id: env().TAP_MERCHANT_ID } } : {}),
    source: { id: "src_all" },
    post: { url: webhookUrl },
    redirect: { url: returnUrl },
  };
}

export const tapProvider: PaymentProvider = {
  name: "tap",
  async createCheckout(order, urls, ctx) {
    // Tap returns every customer — paid or not — to one URL; the review page then
    // fetches the charge to find out what happened.
    const returnUrl = urls.successUrl.replace(/([?&])checkout=success\b/, "$1checkout=return");
    const webhookUrl = new URL("/api/webhooks/payments/tap", env().APP_URL).toString();
    const charge = await tapRequest<TapCharge>("POST", "/charges", tapChargeRequest(order, returnUrl, webhookUrl, ctx));
    if (!charge?.id || !charge.transaction?.url) throw new TapApiError("Tap did not return a payment page", 200);
    return { redirectUrl: charge.transaction.url, providerRef: charge.id };
  },
};

// ── Webhook signature (hashstring header) ───────────────────────────────────

/**
 * Tap signs webhooks with HMAC-SHA256 (key = secret API key) over
 * `x_id{id}x_amount{amount}x_currency{currency}x_gateway_reference{reference.gateway}`
 * `x_payment_reference{reference.payment}x_status{status}x_created{transaction.created}`,
 * the amount written with the currency's standard decimals.
 */
export function tapHashString(charge: TapCharge, secret: string): string {
  const amount = Number(charge.amount).toFixed(decimalsOf(charge.currency));
  const data =
    `x_id${charge.id}x_amount${amount}x_currency${charge.currency}` +
    `x_gateway_reference${charge.reference?.gateway ?? ""}x_payment_reference${charge.reference?.payment ?? ""}` +
    `x_status${charge.status}x_created${charge.transaction?.created ?? ""}`;
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

export function verifyTapSignature(charge: TapCharge, header: string | null | undefined, secret: string): boolean {
  if (!header || !/^[0-9a-f]{64}$/i.test(header.trim())) return false;
  const expected = Buffer.from(tapHashString(charge, secret), "hex");
  const given = Buffer.from(header.trim().toLowerCase(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
