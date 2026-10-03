import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import {
  clientIp,
  conflict,
  HttpError,
  notFound,
  ok,
  route,
} from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { logError } from "@/server/log";
import { paymentProvider, providerFor } from "@/server/payments";
import { applyPaidOrder } from "@/server/payments/service";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Pay a payment link (/pay/<token>) — no sign-in needed: the unguessable token is the
 * authorisation. Starts the hosted checkout (Tap / Stripe) and returns its URL; in test
 * mode (mock provider) the order is paid immediately.
 */
export const POST = route<Ctx>(
  "pay.checkout",
  async (req: NextRequest, ctx) => {
    await enforceRateLimit(`paylink:${clientIp(req)}`, 20, 600);
    const { token } = await ctx.params;
    // The page language, so the host comes back to the receipt in the language they paid in.
    const body = (await req.json().catch(() => null)) as {
      lang?: unknown;
    } | null;
    const lang =
      body?.lang === "ar" || body?.lang === "en" ? `&lang=${body.lang}` : "";
    const order = await db.order.findUnique({
      where: { payToken: token },
      include: {
        user: { select: { name: true, email: true } },
        event: { select: { title: true } },
      },
    });
    if (!order) throw notFound("Payment link");
    if (order.status === "PAID")
      return ok({ redirectUrl: `/pay/${token}${lang.replace("&", "?")}` });
    if (order.status !== "PENDING")
      throw conflict("not_payable", "This payment link is no longer active.");

    const provider = paymentProvider();
    if (provider.name === "mock") {
      await db.order.update({
        where: { id: order.id },
        data: { provider: "mock" },
      });
      await applyPaidOrder(order.id, {
        provider: "mock",
        providerPaymentId: `mock_${order.id}`,
        raw: { via: "payment-link" },
      });
      return ok({ redirectUrl: `/pay/${token}?checkout=success${lang}` });
    }
    if (provider.name === "manual")
      throw conflict(
        "manual_payment",
        "Online payment isn't available — please contact contact@invtra.store.",
      );

    // A previous hosted session for this link must not stay payable alongside the new one.
    if (order.providerRef)
      await providerFor(order.provider)
        ?.expireCheckout?.(order.providerRef)
        .catch(() => undefined);
    let result;
    try {
      result = await provider.createCheckout(
        { ...order, provider: provider.name },
        {
          successUrl: appUrl(`/pay/${token}?checkout=success${lang}`),
          cancelUrl: appUrl(`/pay/${token}?checkout=cancelled${lang}`),
        },
        {
          customerEmail: order.user.email,
          customerName: order.user.name,
          description:
            `INVTRA Custom package — ${order.event?.title ?? ""}`.slice(0, 250),
        },
      );
    } catch (e) {
      await logError("payments:checkout", e, {
        orderId: order.id,
        provider: provider.name,
        via: "payment-link",
      });
      throw new HttpError(
        502,
        "payment_provider_error",
        "We couldn't start the payment right now. Please try again in a moment.",
      );
    }
    await db.order.update({
      where: { id: order.id },
      data: {
        provider: provider.name,
        providerRef: result.providerRef ?? null,
      },
    });
    return ok({ redirectUrl: result.redirectUrl });
  },
);
