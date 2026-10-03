import { createHmac, randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Must be set before the env module is first read.
const WEBHOOK_SECRET = "whsec_test_" + randomBytes(12).toString("hex");
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_SECRET_KEY = "sk_test_invtra";
process.env.TAP_SECRET_KEY = "sk_test_tap_invtra";

const { db } = await import("@/server/db");
const { upgradePrice, PLANS } = await import("@/lib/plans");
const { THEMES } = await import("@/lib/themes/registry");
const service = await import("@/server/payments/service");
const { verifyStripeSignature, signStripePayload, toStripeAmount, stripeForm, stripeProvider } = await import("@/server/payments/stripe");
const { handleStripeWebhook } = await import("@/server/payments/webhook");
const tap = await import("@/server/payments/tap");
const { handleTapWebhook, confirmTapReturn } = await import("@/server/payments/tap-webhook");

const run = randomBytes(5).toString("hex");
const started = new Date();
const userIds: string[] = [];

async function makeUser(tag: string) {
  const user = await db.user.create({
    data: { email: `pay-test-${tag}-${run}@example.test`, name: `Payment Test ${tag}`, passwordHash: "x" },
  });
  userIds.push(user.id);
  return user;
}

async function makeEvent(userId: string, plan: "BASIC" | "PREMIUM" | null = null, guestLimit = 0) {
  return db.event.create({
    data: {
      userId,
      title: `Test Wedding ${run}`,
      hostNames: "A & B",
      startsAt: new Date(Date.now() + 90 * 86_400_000),
      venueName: "Test Venue",
      address: "Test Address",
      themeKey: "minimal",
      design: THEMES.minimal.defaults as object,
      plan,
      guestLimit,
    },
  });
}

afterAll(async () => {
  await db.webhookEvent.deleteMany({ where: { dedupeKey: { startsWith: `stripe:evt_${run}` } } });
  await db.webhookEvent.deleteMany({ where: { dedupeKey: { contains: run }, provider: "tap" } });
  await db.errorLog.deleteMany({
    where: {
      createdAt: { gte: started },
      OR: [{ message: { contains: run } }, { source: "webhook:stripe", message: { startsWith: "Rejected Stripe webhook" } }, { source: "payments:amount_mismatch" }, { source: { in: ["payments:tap", "webhook:tap"] } }],
    },
  });
  await db.user.deleteMany({ where: { id: { in: userIds } } }); // cascades events, orders, payments
});

describe("upgrade pricing", () => {
  it("charges the full price for a first plan and the difference for an upgrade", () => {
    expect(upgradePrice(null, "BASIC", "USD")).toBe(PLANS.BASIC.prices!.USD);
    expect(upgradePrice(null, "PREMIUM", "AED")).toBe(PLANS.PREMIUM.prices!.AED);
    expect(upgradePrice("BASIC", "PREMIUM", "USD")).toBe(PLANS.PREMIUM.prices!.USD - PLANS.BASIC.prices!.USD);
    expect(upgradePrice("BASIC", "PREMIUM", "SAR")).toBe(20000); // 699 − 499 SAR
    expect(upgradePrice("BASIC", "PREMIUM", "KWD")).toBe(16000); // three-decimal currency
  });

  it("refuses downgrades, same-plan purchases and Custom", () => {
    expect(upgradePrice("PREMIUM", "BASIC", "USD")).toBeNull();
    expect(upgradePrice("BASIC", "BASIC", "USD")).toBeNull();
    expect(upgradePrice(null, "CUSTOM", "USD")).toBeNull();
  });

  it("passes three-decimal currencies to Stripe unchanged, but only when they end in 0", () => {
    for (const c of ["KWD", "BHD", "OMR"] as const) {
      for (const tier of ["BASIC", "PREMIUM"] as const) expect(toStripeAmount(PLANS[tier].prices![c], c)).toBe(PLANS[tier].prices![c]);
      expect(toStripeAmount(upgradePrice("BASIC", "PREMIUM", c)!, c)).toBe(upgradePrice("BASIC", "PREMIUM", c));
    }
    expect(() => toStripeAmount(15005, "KWD")).toThrow();
    expect(toStripeAmount(4999, "USD")).toBe(4999);
  });

  it("form-encodes nested Stripe parameters", () => {
    const f = stripeForm({ mode: "payment", line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 4900 } }], metadata: { orderId: "o1" } });
    expect(f.get("line_items[0][price_data][unit_amount]")).toBe("4900");
    expect(f.get("line_items[0][quantity]")).toBe("1");
    expect(f.get("metadata[orderId]")).toBe("o1");
  });
});

describe("orders", () => {
  it("creates an upgrade order priced from the event's current plan and reuses a pending one", async () => {
    const user = await makeUser("order");
    const event = await makeEvent(user.id, "BASIC", 100);
    const currency = service.paymentCurrency();
    const a = await service.createOrderForEvent(user, event, "PREMIUM");
    expect(a.reused).toBe(false);
    expect(a.order.amount).toBe(upgradePrice("BASIC", "PREMIUM", currency));
    expect(a.order.guestLimit).toBe(500);
    expect(a.order.status).toBe("PENDING");
    const b = await service.createOrderForEvent(user, event, "PREMIUM");
    expect(b.reused).toBe(true);
    expect(b.order.id).toBe(a.order.id);
    await expect(service.createOrderForEvent(user, event, "BASIC")).rejects.toMatchObject({ code: "not_an_upgrade", status: 400 });
    await expect(service.createOrderForEvent(user, event, "CUSTOM")).rejects.toMatchObject({ status: 400 });
    const stranger = await makeUser("stranger");
    await expect(service.createOrderForEvent(stranger, event, "PREMIUM")).rejects.toMatchObject({ status: 404 });
  });
});

describe("applyPaidOrder", () => {
  it("marks the order paid, records the payment and applies the plan — exactly once", async () => {
    const user = await makeUser("apply");
    const event = await makeEvent(user.id);
    const { order } = await service.createOrderForEvent(user, event, "PREMIUM");

    const first = await service.applyPaidOrder(order.id, { provider: "mock", providerPaymentId: `pi_${run}_1` });
    expect(first.applied).toBe(true);
    expect(first.order.status).toBe("PAID");
    expect(first.order.paidAt).toBeInstanceOf(Date);

    const again = await service.applyPaidOrder(order.id, { provider: "mock", providerPaymentId: `pi_${run}_1` });
    expect(again.applied).toBe(false);
    expect(again.duplicatePayment).toBe(false);

    const payments = await db.payment.findMany({ where: { orderId: order.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: "SUCCEEDED", amount: order.amount, currency: order.currency, provider: "mock" });

    const updated = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.plan).toBe("PREMIUM");
    expect(updated.guestLimit).toBe(500);
    expect(await db.activity.count({ where: { eventId: event.id, kind: "plan.purchased" } })).toBe(1);
  });

  it("never downgrades the event or lowers its guest limit", async () => {
    const user = await makeUser("nodown");
    const event = await makeEvent(user.id);
    const { order } = await service.createOrderForEvent(user, event, "BASIC");
    await db.event.update({ where: { id: event.id }, data: { plan: "PREMIUM", guestLimit: 800 } }); // e.g. granted meanwhile
    await service.applyPaidOrder(order.id, { provider: "manual" });
    const e = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(e.plan).toBe("PREMIUM");
    expect(e.guestLimit).toBe(800);
  });

  it("supports refunds (optionally revoking the plan) and refuses to cancel paid orders", async () => {
    const user = await makeUser("refund");
    const event = await makeEvent(user.id);
    const { order } = await service.createOrderForEvent(user, event, "BASIC");
    await service.applyPaidOrder(order.id, { provider: "manual" });
    await expect(service.cancelOrder(order.id)).rejects.toMatchObject({ code: "order_paid" });
    const r = await service.markOrderRefunded(order.id, { note: "test refund", revokePlan: true });
    expect(r.order.status).toBe("REFUNDED");
    expect(r.plan).toEqual({ plan: null, guestLimit: 0 });
    expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("REFUNDED");
    await expect(service.applyPaidOrder(order.id, { provider: "manual" })).rejects.toMatchObject({ code: "order_refunded" });
  });
});

describe("Stripe signature verification", () => {
  const body = JSON.stringify({ id: "evt_sig", type: "ping" });

  it("accepts a valid signature", () => {
    expect(verifyStripeSignature(body, signStripePayload(body, WEBHOOK_SECRET), WEBHOOK_SECRET)).toMatchObject({ ok: true });
  });

  it("accepts a header with several v1 signatures when one matches (secret rotation)", () => {
    const t = Math.floor(Date.now() / 1000);
    const good = signStripePayload(body, WEBHOOK_SECRET, t);
    const header = `t=${t},v1=${"0".repeat(64)},${good.split(",")[1]}`;
    expect(verifyStripeSignature(body, header, WEBHOOK_SECRET).ok).toBe(true);
  });

  it("rejects a tampered body or a different secret", () => {
    const header = signStripePayload(body, WEBHOOK_SECRET);
    expect(verifyStripeSignature(body.replace("ping", "pong"), header, WEBHOOK_SECRET)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyStripeSignature(body, header, "whsec_other")).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects timestamps outside the 5-minute tolerance", () => {
    const old = Math.floor(Date.now() / 1000) - 301;
    expect(verifyStripeSignature(body, signStripePayload(body, WEBHOOK_SECRET, old), WEBHOOK_SECRET)).toEqual({ ok: false, reason: "expired" });
    const now = Math.floor(Date.now() / 1000) - 290;
    expect(verifyStripeSignature(body, signStripePayload(body, WEBHOOK_SECRET, now), WEBHOOK_SECRET).ok).toBe(true);
  });

  it("rejects missing and malformed headers", () => {
    expect(verifyStripeSignature(body, null, WEBHOOK_SECRET)).toEqual({ ok: false, reason: "missing" });
    expect(verifyStripeSignature(body, "v1=abc", WEBHOOK_SECRET)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyStripeSignature(body, "t=123", WEBHOOK_SECRET)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("Stripe webhook", () => {
  let order: Awaited<ReturnType<typeof db.order.create>>;
  let eventId: string;

  beforeAll(async () => {
    const user = await makeUser("webhook");
    const event = await makeEvent(user.id);
    eventId = event.id;
    order = await db.order.create({
      data: {
        userId: user.id,
        eventId: event.id,
        plan: "PREMIUM",
        guestLimit: 500,
        amount: 12900,
        currency: "USD",
        provider: "stripe",
        providerRef: `cs_test_${run}`,
      },
    });
  });

  const send = (payload: object, secret = WEBHOOK_SECRET) => {
    const raw = JSON.stringify(payload);
    return handleStripeWebhook(raw, signStripePayload(raw, secret));
  };
  const session = (over: Record<string, unknown> = {}) => ({
    id: `cs_test_${run}`,
    object: "checkout.session",
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    payment_status: "paid",
    payment_intent: `pi_${run}`,
    amount_total: 12900,
    currency: "usd",
    ...over,
  });

  it("returns 400 for a bad signature", async () => {
    const r = await send({ id: `evt_${run}_bad`, type: "checkout.session.completed", data: { object: session() } }, "whsec_wrong");
    expect(r.status).toBe(400);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });

  it("does not apply a payment whose amount doesn't match the order", async () => {
    const r = await send({ id: `evt_${run}_mismatch`, type: "checkout.session.completed", data: { object: session({ amount_total: 100 }) } });
    expect(r.status).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });

  it("ignores the expiry of a session that is no longer the order's current one", async () => {
    const r = await send({ id: `evt_${run}_oldexp`, type: "checkout.session.expired", data: { object: session({ id: "cs_test_previous" }) } });
    expect(r.status).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });

  it("applies checkout.session.completed once, even when Stripe retries", async () => {
    const evt = { id: `evt_${run}_paid`, type: "checkout.session.completed", data: { object: session() } };
    const r1 = await send(evt);
    expect(r1.status).toBe(200);
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(paid.status).toBe("PAID");
    expect(paid.payments.filter((p) => p.status === "SUCCEEDED")).toHaveLength(1);
    expect(paid.payments.find((p) => p.status === "SUCCEEDED")?.providerPaymentId).toBe(`pi_${run}`);
    const e = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(e.plan).toBe("PREMIUM");
    expect(e.guestLimit).toBe(500);

    const r2 = await send(evt);
    expect(r2).toMatchObject({ status: 200, body: { duplicate: true } });
    expect(await db.payment.count({ where: { orderId: order.id, status: "SUCCEEDED" } })).toBe(1);
  });

  it("marks the order refunded on charge.refunded", async () => {
    const r = await send({ id: `evt_${run}_refund`, type: "charge.refunded", data: { object: { id: `ch_${run}`, object: "charge", payment_intent: `pi_${run}`, refunded: true } } });
    expect(r.status).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
  });

  it("cancels a pending order when its current session expires", async () => {
    const pending = await db.order.create({
      data: { userId: order.userId, eventId, plan: "PREMIUM", guestLimit: 500, amount: 12900, currency: "USD", provider: "stripe", providerRef: `cs_test_${run}_2` },
    });
    const r = await send({
      id: `evt_${run}_expired`,
      type: "checkout.session.expired",
      data: { object: session({ id: `cs_test_${run}_2`, client_reference_id: pending.id, metadata: { orderId: pending.id }, payment_status: "unpaid" }) },
    });
    expect(r.status).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("CANCELLED");
  });
});

describe("Stripe Checkout session request", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a payment-mode session with the order amount passed through unchanged", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }), { status: 200 });
      }),
    );
    const order = { id: "ord_1", eventId: "evt_1", plan: "PREMIUM", amount: 24000, currency: "KWD" } as never;
    const r = await stripeProvider.createCheckout(order, { successUrl: "https://invtra.store/ok", cancelUrl: "https://invtra.store/no" }, { customerEmail: "a@b.co", description: "INVTRA Premium plan — Test" });
    expect(r).toEqual({ redirectUrl: "https://checkout.stripe.com/c/pay/cs_test_123", providerRef: "cs_test_123" });
    expect(calls[0].url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk_test_invtra");
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(Object.fromEntries(form)).toMatchObject({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "kwd",
      "line_items[0][price_data][unit_amount]": "24000",
      "line_items[0][price_data][product_data][name]": "INVTRA Premium plan — Test",
      client_reference_id: "ord_1",
      "metadata[orderId]": "ord_1",
      success_url: "https://invtra.store/ok",
      cancel_url: "https://invtra.store/no",
      customer_email: "a@b.co",
    });
  });

  it("surfaces Stripe API errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid currency: xyz", code: "parameter_invalid" } }), { status: 400 })));
    await expect(
      stripeProvider.createCheckout({ id: "o", eventId: null, plan: "BASIC", amount: 4900, currency: "USD" } as never, { successUrl: "https://x/ok", cancelUrl: "https://x/no" }),
    ).rejects.toMatchObject({ message: "Invalid currency: xyz", status: 400, code: "parameter_invalid" });
  });
});

describe("Tap Payments (Apple Pay, Google Pay, mada)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const charge = (over: Partial<import("@/server/payments/tap").TapCharge> = {}) => ({
    id: `chg_TS${run}A1`,
    object: "charge",
    status: "CAPTURED",
    amount: 699.0,
    currency: "SAR",
    reference: { gateway: "mada_pg123", payment: "4327230736106619650", order: "", transaction: "" },
    transaction: { created: "1698392202943" },
    source: { payment_method: "APPLE_PAY" },
    ...over,
  });

  /** Tap's API, as seen by INVTRA: GET /v2/charges/:id returns `current`. */
  function stubTap(current: () => object) {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (init.method === "POST") return new Response(JSON.stringify({ id: `chg_TS${run}NEW`, status: "INITIATED", transaction: { url: "https://checkout.tap.company/?mode=page&token=x" } }), { status: 200 });
        return new Response(JSON.stringify(current()), { status: 200 });
      }),
    );
    return calls;
  }

  it("converts between order minor units and Tap's decimal amounts", () => {
    expect(tap.toTapAmount(69900, "SAR")).toBe(699);
    expect(tap.toTapAmount(49950, "SAR")).toBe(499.5);
    expect(tap.toTapAmount(41000, "KWD")).toBe(41);
    expect(tap.fromTapAmount(699.0, "SAR")).toBe(69900);
    expect(tap.fromTapAmount(1.03, "KWD")).toBe(1030);
    expect(() => tap.toTapAmount(0, "SAR")).toThrow();
  });

  it("verifies the webhook hashstring exactly as Tap computes it", () => {
    const c = charge();
    const secret = "sk_test_tap_invtra";
    const expected = createHmac("sha256", secret)
      .update(`x_id${c.id}x_amount699.00x_currencySARx_gateway_referencemada_pg123x_payment_reference4327230736106619650x_statusCAPTUREDx_created1698392202943`)
      .digest("hex");
    expect(tap.tapHashString(c, secret)).toBe(expected);
    expect(tap.verifyTapSignature(c, expected, secret)).toBe(true);
    expect(tap.verifyTapSignature({ ...c, amount: 1 }, expected, secret)).toBe(false);
    expect(tap.verifyTapSignature(c, "nope", secret)).toBe(false);
  });

  it("opens Tap's hosted page with every payment method and returns to the review page", async () => {
    const user = await makeUser("tap-create");
    const event = await makeEvent(user.id);
    const order = await db.order.create({ data: { userId: user.id, eventId: event.id, plan: "PREMIUM", guestLimit: 500, amount: 69900, currency: "SAR", provider: "tap" } });
    const calls = stubTap(() => ({}));
    const result = await tap.tapProvider.createCheckout(order, service.checkoutUrls(event.id), { customerEmail: "sara@example.test", customerName: "Sara Al Hashimi", description: "INVTRA Premium plan" });
    expect(result).toEqual({ redirectUrl: "https://checkout.tap.company/?mode=page&token=x", providerRef: `chg_TS${run}NEW` });
    expect(calls[0].url).toBe("https://api.tap.company/v2/charges");
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe("Bearer sk_test_tap_invtra");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({
      amount: 699,
      currency: "SAR",
      source: { id: "src_all" },
      reference: { order: order.id },
      customer: { first_name: "Sara", last_name: "Al Hashimi", email: "sara@example.test" },
    });
    expect(body.redirect.url).toMatch(new RegExp(`/dashboard/events/${event.id}/review\\?checkout=return$`));
    expect(body.post.url).toMatch(/\/api\/webhooks\/payments\/tap$/);
  });

  it("activates the plan only after Tap confirms the charge, once", async () => {
    const user = await makeUser("tap-pay");
    const event = await makeEvent(user.id);
    const c = charge({ id: `chg_TS${run}PAY` });
    const order = await db.order.create({
      data: { userId: user.id, eventId: event.id, plan: "PREMIUM", guestLimit: 500, amount: 69900, currency: "SAR", provider: "tap", providerRef: c.id },
    });
    c.reference.order = order.id;
    let state: object = { ...c, status: "INITIATED" };
    stubTap(() => state);

    // A forged "CAPTURED" webhook is not believed: Tap's API still says INITIATED.
    const forged = JSON.stringify({ ...c, status: "CAPTURED" });
    const r1 = await handleTapWebhook(forged, null);
    expect(r1).toMatchObject({ status: 200, body: { outcome: "pending" } });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");

    // A webhook whose hashstring doesn't match is rejected outright.
    expect((await handleTapWebhook(forged, "0".repeat(64))).status).toBe(400);

    // The customer returns after paying with Apple Pay → plan applied.
    state = c;
    expect(await confirmTapReturn(event.id, user.id)).toBe("success");
    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    expect(paid.status).toBe("PAID");
    expect(paid.payments).toHaveLength(1);
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).plan).toBe("PREMIUM");

    // The (signed) webhook arriving afterwards changes nothing.
    const raw = JSON.stringify(c);
    const r2 = await handleTapWebhook(raw, tap.tapHashString(c as never, "sk_test_tap_invtra"));
    expect(r2.status).toBe(200);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("leaves the order open when the payment is declined, and refuses mismatched amounts", async () => {
    const user = await makeUser("tap-decline");
    const event = await makeEvent(user.id);
    const c = charge({ id: `chg_TS${run}DEC`, status: "DECLINED" });
    const order = await db.order.create({
      data: { userId: user.id, eventId: event.id, plan: "BASIC", guestLimit: 100, amount: 49900, currency: "SAR", provider: "tap", providerRef: c.id },
    });
    c.reference.order = order.id;
    let state: object = c;
    stubTap(() => state);
    expect(await confirmTapReturn(event.id, user.id)).toBe("cancelled");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");

    state = { ...c, status: "CAPTURED", amount: 1 };
    expect(await tap.retrieveTapCharge(c.id).then((ch) => import("@/server/payments/tap-webhook").then((m) => m.settleTapCharge(ch, "webhook")))).toBe("failed");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).plan).toBeNull();
  });
});
