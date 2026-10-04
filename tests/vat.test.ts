/**
 * VAT for INVTRA's own sales (prices include 15% VAT), the monthly statement, and the
 * "start fresh" reset of test payment history.
 */
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  closeTaxMonth,
  exactMoney,
  monthCsv,
  monthKey,
  monthlyTotals,
  quarterMonthsUpTo,
  resetPaymentHistory,
  sumTotals,
  vatInside,
} from "@/server/admin/tax";
import { nextReceiptNumber } from "@/server/payments/receipts";
import { markOrderRefunded } from "@/server/payments/service";

const run = randomBytes(5).toString("hex");
const userIds: string[] = [];

afterAll(async () => {
  await db.taxStatement.deleteMany({});
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

async function user(role: "CUSTOMER" | "ADMIN" = "CUSTOMER") {
  const u = await db.user.create({ data: { email: `vat-${run}-${userIds.length}@example.test`, name: `VAT ${userIds.length}`, passwordHash: "x", role } });
  userIds.push(u.id);
  return u;
}

describe("VAT", () => {
  it("takes the VAT out of VAT-inclusive prices, to the halala", () => {
    expect(vatInside(9600, 15)).toBe(1252); // SAR 96.00 → VAT 12.52, excl. 83.48
    expect(vatInside(69900, 15)).toBe(9117); // SAR 699.00 → VAT 91.17
    expect(vatInside(11500, 15)).toBe(1500); // exactly 15 on 100
    expect(vatInside(100, 15)).toBe(13);
    expect(vatInside(0, 15)).toBe(0);
    expect(vatInside(9600, 0)).toBe(0);
    expect(exactMoney(1252, "SAR")).toBe("SAR 12.52");
    expect(exactMoney(-1252, "SAR")).toBe("−SAR 12.52");
    expect(exactMoney(7900, "KWD")).toBe("KWD 7.900");
    // Months are Riyadh time: 21:30 UTC on 31 October is already 1 November.
    expect(monthKey(new Date("2026-10-31T20:59:00Z"))).toBe("2026-10");
    expect(monthKey(new Date("2026-10-31T21:30:00Z"))).toBe("2026-11");
    expect(quarterMonthsUpTo("2026-11")).toEqual(["2026-10", "2026-11"]);
  });

  it("deletes all test payment history, then totals each month and emails the statement once", async () => {
    // Test payments from before going live…
    const host = await user();
    const old = await db.order.create({ data: { userId: host.id, plan: "BASIC", guestLimit: 100, amount: 29900, currency: "SAR", provider: "mock", status: "PAID", paidAt: new Date(), receiptNumber: `INVTRA-2099-${run}` } });
    await db.payment.create({ data: { orderId: old.id, provider: "mock", amount: 29900, currency: "SAR", status: "SUCCEEDED" } });
    await db.$transaction((tx) => nextReceiptNumber(tx, new Date("2099-01-01T00:00:00Z")));
    const admin = await user("ADMIN");

    // …are wiped: orders, payment attempts, receipt numbering; a summary stays in the audit log.
    const r = await resetPaymentHistory(admin.id);
    expect(r.orders).toBeGreaterThanOrEqual(1);
    expect(await db.order.count()).toBe(0);
    expect(await db.payment.count()).toBe(0);
    expect(await db.receiptCounter.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "admin.payments.reset", actorId: admin.id } })).toBe(1);

    // Real sales: 96 SAR on 5 October, 699 SAR at 00:30 on 1 November (Riyadh), the October
    // one refunded on 3 November; a granted plan and an unpaid order don't count.
    const oct = await db.order.create({ data: { userId: host.id, plan: "BASIC", guestLimit: 96, amount: 9600, currency: "SAR", provider: "tap", status: "PAID", paidAt: new Date("2026-10-05T12:00:00Z"), receiptNumber: `R1-${run}` } });
    await db.order.create({ data: { userId: host.id, plan: "PREMIUM", guestLimit: 500, amount: 69900, currency: "SAR", provider: "tap", status: "PAID", paidAt: new Date("2026-10-31T21:30:00Z"), receiptNumber: `R2-${run}` } });
    await db.order.create({ data: { userId: host.id, plan: "PREMIUM", guestLimit: 500, amount: 0, currency: "SAR", provider: "manual", status: "PAID", paidAt: new Date("2026-10-10T12:00:00Z") } });
    await db.order.create({ data: { userId: host.id, plan: "BASIC", guestLimit: 100, amount: 29900, currency: "SAR", provider: "tap", status: "PENDING" } });
    await markOrderRefunded(oct.id, { note: "test" });
    await db.order.update({ where: { id: oct.id }, data: { refundedAt: new Date("2026-11-03T09:00:00Z") } });

    const months = await monthlyTotals({ until: "2026-12" });
    const by = (m: string) => months.find((x) => x.month === m)!;
    expect(months.map((m) => m.month)).toEqual(["2026-12", "2026-11", "2026-10"]);
    expect(by("2026-10")).toMatchObject({ receipts: 1, gross: 9600, refunds: 0, sales: 9600, vat: 1252, net: 8348 });
    expect(by("2026-11")).toMatchObject({ receipts: 1, gross: 69900, refundsCount: 1, refunds: 9600, sales: 60300, vat: 9117 - 1252, net: 60300 - 7865 });
    expect(by("2026-12")).toMatchObject({ receipts: 0, vat: 0 });
    expect(sumTotals(months, "Q4 2026", "SAR")).toMatchObject({ vat: 9117, sales: 69900, net: 69900 - 9117 });

    const csv = await monthCsv("2026-11");
    expect(csv).toContain(`R2-${run},01/11/2026 00:30,Sale`);
    expect(csv).toContain("699.00,91.17,607.83,SAR");
    expect(csv).toContain(`R1-${run},03/11/2026 12:00,Refund`);
    expect(csv).toContain("-96.00,-12.52,-83.48,SAR");

    // The worker saves last month's statement on the 1st, once.
    expect(await closeTaxMonth(new Date("2026-10-02T06:00:00Z"))).toBeNull(); // September: before statements started
    const saved = await closeTaxMonth(new Date("2026-12-01T06:00:00Z"));
    expect(saved?.map((s) => [s.month, s.currency, s.vat, s.net, s.receipts])).toEqual([["2026-11", "SAR", 7865, 52435, 1]]);
    expect((await db.taxStatement.findFirstOrThrow({ where: { month: "2026-11" } })).emailedAt).toBeInstanceOf(Date);
    expect(await closeTaxMonth(new Date("2026-12-01T07:00:00Z"))).toBeNull();
  });
});
