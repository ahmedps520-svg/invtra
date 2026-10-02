import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import type { CheckoutContext, PaymentProvider } from "./types";

/**
 * Stripe Checkout over the REST API (no SDK).
 *
 * Amounts: INVTRA stores money in the currency's minor unit, which is exactly what
 * Stripe's `unit_amount` expects — cents for USD/AED/SAR/QAR and, for the
 * three-decimal currencies KWD/BHD/OMR, thousandths (fils/baisa). We therefore pass
 * `order.amount` through unchanged. Stripe additionally requires three-decimal amounts
 * to be divisible by 10 (the last digit must be 0); every catalogue price satisfies
 * that and `toStripeAmount` refuses anything that does not rather than silently
 * rounding a customer's charge.
 */

const API = "https://api.stripe.com/v1";
export const THREE_DECIMAL_CURRENCIES = new Set(["KWD", "BHD", "OMR", "JOD", "TND"]);

export class StripeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "StripeApiError";
  }
}

export function toStripeAmount(amount: number, currency: string): number {
  if (!Number.isInteger(amount) || amount < 0) throw new StripeApiError(`Invalid amount ${amount}`, null);
  if (THREE_DECIMAL_CURRENCIES.has(currency.toUpperCase()) && amount % 10 !== 0) {
    throw new StripeApiError(`Stripe requires ${currency} amounts to end in 0 (got ${amount})`, null);
  }
  return amount;
}

/** Flatten a nested object into Stripe's form encoding: a[b][0][c]=v. */
export function stripeForm(params: Record<string, unknown>): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (prefix: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    else if (typeof value === "object") for (const [k, v] of Object.entries(value)) walk(prefix ? `${prefix}[${k}]` : k, v);
    else out.append(prefix, String(value));
  };
  walk("", params);
  return out;
}

async function stripeRequest<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new StripeApiError("STRIPE_SECRET_KEY is not configured", null);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      },
      body: params ? stripeForm(params).toString() : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new StripeApiError(`Network error calling Stripe: ${(e as Error).message}`, null);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } } | null)?.error;
    throw new StripeApiError(err?.message ?? `Stripe HTTP ${res.status}`, res.status, err?.code);
  }
  return json as T;
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createCheckout(order, urls, ctx?: CheckoutContext) {
    const session = await stripeRequest<{ id: string; url: string | null }>("/checkout/sessions", {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: toStripeAmount(order.amount, order.currency),
            product_data: { name: ctx?.description ?? `INVTRA ${order.plan} plan` },
          },
        },
      ],
      client_reference_id: order.id,
      metadata: { orderId: order.id, eventId: order.eventId ?? "", plan: order.plan },
      payment_intent_data: { metadata: { orderId: order.id } },
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      customer_email: ctx?.customerEmail,
    });
    if (!session.url) throw new StripeApiError("Stripe did not return a checkout URL", 200);
    return { redirectUrl: session.url, providerRef: session.id };
  },
  async expireCheckout(sessionId) {
    if (!sessionId.startsWith("cs_")) return;
    try {
      await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
    } catch {
      // Already completed or expired — nothing to do.
    }
  },
};

// ── Webhook signatures ──────────────────────────────────────────────────────

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

export type StripeSignatureResult = { ok: true; timestamp: number } | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

/**
 * Verify a `Stripe-Signature` header (`t=<unix>,v1=<hex>[,v1=<hex>...]`): HMAC-SHA256 of
 * `${t}.${rawBody}` keyed with the endpoint secret, compared in constant time, and the
 * timestamp must be within the tolerance window (replay protection).
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  opts: { toleranceSeconds?: number; now?: number } = {},
): StripeSignatureResult {
  if (!header) return { ok: false, reason: "missing" };
  let t: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t" && /^\d+$/.test(v)) t = Number(v);
    else if (k === "v1" && /^[0-9a-f]{64}$/i.test(v)) signatures.push(v.toLowerCase());
  }
  if (t === null || !signatures.length) return { ok: false, reason: "malformed" };
  const tolerance = opts.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  if (Math.abs(nowSec - t) > tolerance) return { ok: false, reason: "expired" };
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex"), "hex");
  const match = signatures.some((s) => {
    const given = Buffer.from(s, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  return match ? { ok: true, timestamp: t } : { ok: false, reason: "mismatch" };
}

/** Build a valid header (tests and local webhook simulation). */
export function signStripePayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${sig}`;
}
