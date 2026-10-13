/**
 * Discount codes: what they take off, when they can be used, checkout with a code (including
 * one that makes the plan free), staff management and reporting, and remembering where a
 * visitor came from.
 */
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { THEMES } from "@/lib/themes/registry";
import { PLANS, upgradePrice } from "@/lib/plans";

const session = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/server/auth/session", async (orig) => ({ ...(await orig<object>()), getSessionUser: vi.fn(async () => session.user) }));

import { codeState, discountFor, normalizeCode, usableCode } from "@/server/payments/promo";
import { createOrderForEvent, paymentCurrency, startCheckout } from "@/server/payments/service";
import { createPromoCode, deletePromoCode, getPromoCode, listPromoCodes, promoInputSchema, updatePromoCode } from "@/server/admin/promo";
import { GET as quoteRoute } from "@/app/api/billing/promo/route";
import { cleanSource } from "@/lib/attribution";
import { proxy } from "@/proxy";

const run = randomBytes(4).toString("hex").toUpperCase();
const userIds: string[] = [];
const codeIds: string[] = [];
const DAY = 86_400_000;
const SAR = (n: number) => n * 100;

async function makeUser(extra: Record<string, unknown> = {}) {
  const user = await db.user.create({
    data: { email: `promo-${run.toLowerCase()}-${userIds.length}@example.test`, name: "Promo Host", passwordHash: "x", emailVerifiedAt: new Date(), ...extra },
  });
  userIds.push(user.id);
  return user;
}
async function makeEvent(userId: string, plan: "BASIC" | "PREMIUM" | null = null) {
  return db.event.create({
    data: {
      userId,
      title: "Promo Party",
      hostNames: "A & B",
      startsAt: new Date(Date.now() + 60 * DAY),
      venueName: "Venue",
      address: "Riyadh",
      themeKey: "minimal",
      design: THEMES.minimal.defaults as object,
      plan,
      guestLimit: plan ? (PLANS[plan].guestLimit ?? 0) : 0,
    },
  });
}
async function makeCode(name: string, input: Partial<Parameters<typeof promoInputSchema.parse>[0]> = {}) {
  const admin = await makeUser({ role: "ADMIN" });
  const code = await createPromoCode(admin.id, promoInputSchema.parse({ code: `${name}${run}`, kind: "percent", value: 10, ...input }));
  codeIds.push(code.id);
  return code;
}
const pay = (orderId: string) => db.order.update({ where: { id: orderId }, data: { status: "PAID", paidAt: new Date() } });

afterAll(async () => {
  await db.order.deleteMany({ where: { promoCodeId: { in: codeIds } } });
  await db.promoCode.deleteMany({ where: { id: { in: codeIds } } });
  await db.auditLog.deleteMany({ where: { targetType: "promo", targetId: { in: codeIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("what a code takes off", () => {
  it("rounds percentages to whole riyals and never goes below zero", () => {
    expect(discountFor({ percentOff: 10, amountOff: null, currency: null }, SAR(199), "SAR")).toBe(SAR(20));
    expect(discountFor({ percentOff: 15, amountOff: null, currency: null }, SAR(199), "SAR")).toBe(SAR(30));
    expect(discountFor({ percentOff: 100, amountOff: null, currency: null }, SAR(399), "SAR")).toBe(SAR(399));
    expect(discountFor({ percentOff: null, amountOff: SAR(50), currency: "SAR" }, SAR(199), "SAR")).toBe(SAR(50));
    expect(discountFor({ percentOff: null, amountOff: SAR(500), currency: "SAR" }, SAR(199), "SAR")).toBe(SAR(199));
    expect(discountFor({ percentOff: null, amountOff: SAR(50), currency: "USD" }, SAR(199), "SAR")).toBe(0);
    expect(normalizeCode("  tiktok 10 ")).toBe("TIKTOK10");
  });

  it("knows when a code is active", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    const base = { active: true, startsAt: null, endsAt: null, maxUses: null };
    expect(codeState(base, 0, now)).toBe("active");
    expect(codeState({ ...base, active: false }, 0, now)).toBe("off");
    expect(codeState({ ...base, startsAt: new Date(now.getTime() + DAY) }, 0, now)).toBe("scheduled");
    expect(codeState({ ...base, endsAt: now }, 0, now)).toBe("ended");
    expect(codeState({ ...base, maxUses: 3 }, 3, now)).toBe("used_up");
  });
});

describe("using a code", () => {
  it("refuses codes that don't exist, have ended, haven't started, are used up or were already used", async () => {
    const user = await makeUser();
    const currency = paymentCurrency();
    await expect(usableCode("NOPE-" + run, user.id, currency)).rejects.toMatchObject({ code: "promo_not_found" });
    await expect(usableCode("x", user.id, currency)).rejects.toMatchObject({ code: "promo_not_found" });

    const ended = await makeCode("ENDED");
    await db.promoCode.update({ where: { id: ended.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    await expect(usableCode(ended.code, user.id, currency)).rejects.toMatchObject({ code: "promo_expired" });

    const off = await makeCode("OFF");
    await db.promoCode.update({ where: { id: off.id }, data: { active: false } });
    await expect(usableCode(off.code, user.id, currency)).rejects.toMatchObject({ code: "promo_expired" });

    const later = await makeCode("LATER");
    await db.promoCode.update({ where: { id: later.id }, data: { startsAt: new Date(Date.now() + DAY) } });
    await expect(usableCode(later.code.toLowerCase(), user.id, currency)).rejects.toMatchObject({ code: "promo_not_started" });

    // Limits count paid orders only, so abandoned checkouts don't use a code up.
    const limited = await makeCode("ONE", { maxUses: 1, onePerCustomer: false });
    const other = await makeUser();
    const { order } = await createOrderForEvent(other, await makeEvent(other.id), "BASIC", { code: limited.code });
    await expect(usableCode(limited.code, user.id, currency)).resolves.toMatchObject({ id: limited.id });
    await pay(order.id);
    await expect(usableCode(limited.code, user.id, currency)).rejects.toMatchObject({ code: "promo_used_up" });

    const once = await makeCode("ONCE");
    const first = await createOrderForEvent(user, await makeEvent(user.id), "BASIC", { code: once.code });
    await pay(first.order.id);
    await expect(createOrderForEvent(user, await makeEvent(user.id), "BASIC", { code: once.code })).rejects.toMatchObject({ code: "promo_already_used" });
  });

  it("takes the discount off a new plan or an upgrade, and only for the plans it covers", async () => {
    const user = await makeUser();
    const currency = paymentCurrency();
    const code = await makeCode("PREM", { plans: ["PREMIUM"], kind: "amount", value: 50 });
    await expect(createOrderForEvent(user, await makeEvent(user.id), "BASIC", { code: code.code })).rejects.toMatchObject({ code: "promo_wrong_plan" });

    const upgrade = await createOrderForEvent(user, await makeEvent(user.id, "BASIC"), "PREMIUM", { code: code.code });
    const base = upgradePrice("BASIC", "PREMIUM", currency)!;
    expect(upgrade.order).toMatchObject({ amount: base - 5000, discount: 5000, promoCodeId: code.id, plan: "PREMIUM" });

    await expect(createOrderForEvent(user, await makeEvent(user.id), "BASIC", { code: code.code, offer: "national-day-96" })).rejects.toMatchObject({ code: "promo_with_offer" });
  });

  it("a 100% code activates the plan straight away, with a receipt and no payment page", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    const code = await makeCode("FREE", { value: 100 });
    const result = await startCheckout(user, event, "PREMIUM", { code: code.code });
    expect(result.redirectUrl).toContain(`/dashboard/events/${event.id}/review?checkout=success`);
    const order = await db.order.findUniqueOrThrow({ where: { id: result.orderId }, include: { payments: true } });
    expect(order).toMatchObject({ status: "PAID", amount: 0, provider: "promo", promoCodeId: code.id });
    expect(order.discount).toBe(PLANS.PREMIUM.prices![paymentCurrency()]);
    expect(order.receiptNumber).toBeTruthy();
    expect(order.payments[0]).toMatchObject({ provider: "promo", amount: 0, status: "SUCCEEDED" });
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).plan).toBe("PREMIUM");
    await db.job.deleteMany({ where: { type: "payment.receipt", payload: { path: ["orderId"], equals: order.id } } });
  });

  it("prices each plan with the code for the event", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    const code = await makeCode("QUOTE", { value: 25 });
    session.user = user;
    const res = await quoteRoute(new NextRequest(`https://invtra.store/api/billing/promo?code=${code.code.toLowerCase()}&event=${event.id}`), { params: Promise.resolve({}) });
    const body = await res.json();
    const currency = paymentCurrency();
    const premium = PLANS.PREMIUM.prices![currency];
    expect(body.code).toBe(code.code);
    expect(body.prices.PREMIUM).toEqual({ base: premium, discount: discountFor(code, premium, currency), amount: premium - discountFor(code, premium, currency) });

    const wrong = await quoteRoute(new NextRequest(`https://invtra.store/api/billing/promo?code=NOPE${run}`), { params: Promise.resolve({}) });
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error.code).toBe("promo_not_found");
    session.user = null;
  });
});

describe("staff", () => {
  it("validates new codes", () => {
    expect(promoInputSchema.safeParse({ code: "ok", kind: "percent", value: 10 }).success).toBe(false); // too short
    expect(promoInputSchema.safeParse({ code: "GOOD-1", kind: "percent", value: 120 }).success).toBe(false);
    expect(promoInputSchema.safeParse({ code: "GOOD-1", kind: "percent", value: 10, startsOn: "2026-11-02", endsOn: "2026-11-01" }).success).toBe(false);
    expect(promoInputSchema.parse({ code: " sara 15 ", kind: "amount", value: 49.5 })).toMatchObject({ code: "SARA15", value: 49.5, plans: [] });
  });

  it("creates, edits, switches off and only deletes unused codes — and reports what each brought in", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const code = await makeCode("STATS", { kind: "amount", value: 40, endsOn: "2027-01-31", note: "TikTok October" });
    expect(code.amountOff).toBe(4000);
    // The last day counts in full (Riyadh time).
    expect(code.endsAt?.toISOString()).toBe("2027-01-31T21:00:00.000Z");
    await expect(createPromoCode(admin.id, promoInputSchema.parse({ code: code.code, kind: "percent", value: 5 }))).rejects.toMatchObject({ code: "code_taken" });

    const fan = await makeUser({ source: `code:${code.code}` });
    await makeUser({ source: `code:${code.code}` });
    const { order } = await createOrderForEvent(fan, await makeEvent(fan.id), "BASIC", { code: code.code });
    await pay(order.id);

    const data = await getPromoCode(code.id);
    expect(data?.stats).toMatchObject({ paid: 1, revenue: order.amount, discount: 4000, signups: 2, state: "active" });
    expect(data?.signups.find((u) => u.id === fan.id)?._count.orders).toBe(1);
    expect((await listPromoCodes()).find((c) => c.id === code.id)?.stats.paid).toBe(1);

    await updatePromoCode(admin.id, code.id, { maxUses: 1 });
    expect((await getPromoCode(code.id))?.stats.state).toBe("used_up");
    await updatePromoCode(admin.id, code.id, { active: false });
    expect((await getPromoCode(code.id))?.stats.state).toBe("off");
    await expect(deletePromoCode(admin.id, code.id)).rejects.toMatchObject({ code: "code_used" });

    const unused = await makeCode("UNUSED");
    await deletePromoCode(admin.id, unused.id);
    expect(await db.promoCode.findUnique({ where: { id: unused.id } })).toBeNull();
  });
});

describe("where visitors come from", () => {
  it("remembers a link's code for checkout and the first source for the account", () => {
    const res = proxy(new NextRequest("https://invtra.store/?code=tiktok10&utm_source=tiktok"));
    expect(res.cookies.get("invtra_code")?.value).toBe("TIKTOK10");
    expect(res.cookies.get("invtra_src")?.value).toBe("code:TIKTOK10");

    // The "create your invitation" link at the end of every guest page.
    const guest = proxy(new NextRequest("https://invtra.store/?ref=invitation"));
    expect(guest.cookies.get("invtra_src")?.value).toBe("invitation");
    expect(guest.cookies.get("invtra_code")).toBeUndefined();

    const ad = proxy(new NextRequest("https://invtra.store/invitations/weddings?utm_source=TikTok"));
    expect(ad.cookies.get("invtra_src")?.value).toBe("utm:tiktok");

    // First touch wins: an existing source isn't replaced, but a newer code is remembered.
    const again = proxy(new NextRequest("https://invtra.store/?code=SARA15", { headers: { cookie: "invtra_src=invitation" } }));
    expect(again.cookies.get("invtra_src")).toBeUndefined();
    expect(again.cookies.get("invtra_code")?.value).toBe("SARA15");

    expect(cleanSource("code:TIKTOK10")).toBe("code:TIKTOK10");
    expect(cleanSource("invitation")).toBe("invitation");
    expect(cleanSource("<script>")).toBeNull();
  });
});
