import { z } from "zod";
import type { PromoCode } from "@prisma/client";
import { db } from "@/server/db";
import { conflict, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { paymentCurrency } from "@/server/payments/service";
import { CODE_RE, codeState, describeDiscount, normalizeCode, type CodeState } from "@/server/payments/promo";
import { currencyDigits } from "@/lib/format";
import { zonedToUtc } from "@/lib/time";

/** Admin → Discount codes: create and manage codes, and see what each one brought in. */

const ADMIN_TZ = "Asia/Riyadh";
const DAY = 86_400_000;
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");

export const promoInputSchema = z
  .object({
    code: z.string().transform(normalizeCode).refine((v) => CODE_RE.test(v), "3–30 letters, digits or dashes, starting with a letter or digit"),
    note: z.string().trim().max(120).optional().default(""),
    kind: z.enum(["percent", "amount"]),
    value: z.number().positive("Enter a discount"),
    plans: z.array(z.enum(["BASIC", "PREMIUM"])).max(2).default([]),
    maxUses: z.number().int().min(1).max(100_000).nullable().default(null),
    onePerCustomer: z.boolean().default(true),
    startsOn: isoDay.nullable().default(null),
    endsOn: isoDay.nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "percent" && (!Number.isInteger(v.value) || v.value < 1 || v.value > 100)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "A whole percentage from 1 to 100" });
    }
    if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "Ends before it starts" });
  });
export type PromoInput = z.infer<typeof promoInputSchema>;

/** Dates are whole days in Riyadh time; a code runs until the end of its last day. */
const startOf = (day: string | null) => (day ? zonedToUtc(day, "00:00", ADMIN_TZ) : null);
const endOf = (day: string | null) => (day ? new Date(zonedToUtc(day, "00:00", ADMIN_TZ).getTime() + DAY) : null);

export async function createPromoCode(adminId: string, input: PromoInput) {
  if (await db.promoCode.findUnique({ where: { code: input.code } })) throw conflict("code_taken", "A code with this name already exists.");
  const currency = paymentCurrency();
  const code = await db.promoCode.create({
    data: {
      code: input.code,
      note: input.note || null,
      percentOff: input.kind === "percent" ? input.value : null,
      amountOff: input.kind === "amount" ? Math.round(input.value * 10 ** currencyDigits(currency)) : null,
      currency: input.kind === "amount" ? currency : null,
      plans: input.plans,
      maxUses: input.maxUses,
      onePerCustomer: input.onePerCustomer,
      startsAt: startOf(input.startsOn),
      endsAt: endOf(input.endsOn),
      createdById: adminId,
    },
  });
  await audit(adminId, "admin.promo.create", "promo", code.id, { code: code.code, discount: describeDiscount(code) });
  return code;
}

export const promoUpdateSchema = z.object({
  note: z.string().trim().max(120).optional(),
  maxUses: z.number().int().min(1).max(100_000).nullable().optional(),
  endsOn: isoDay.nullable().optional(),
  active: z.boolean().optional(),
});

/** Change what can safely change once a code is out: its note, limit, end date, or switch it off. */
export async function updatePromoCode(adminId: string, id: string, patch: z.infer<typeof promoUpdateSchema>) {
  const code = await db.promoCode.findUnique({ where: { id } });
  if (!code) throw notFound("Code");
  const updated = await db.promoCode.update({
    where: { id },
    data: {
      ...(patch.note !== undefined ? { note: patch.note || null } : {}),
      ...(patch.maxUses !== undefined ? { maxUses: patch.maxUses } : {}),
      ...(patch.endsOn !== undefined ? { endsAt: endOf(patch.endsOn) } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    },
  });
  await audit(adminId, patch.active === false ? "admin.promo.deactivate" : patch.active ? "admin.promo.activate" : "admin.promo.update", "promo", id, {
    code: code.code,
    ...patch,
  });
  return updated;
}

/** Only a code nobody has ordered with can be deleted; otherwise switch it off. */
export async function deletePromoCode(adminId: string, id: string) {
  const code = await db.promoCode.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } });
  if (!code) throw notFound("Code");
  if (code._count.orders) throw conflict("code_used", "This code has orders, so it can't be deleted. Switch it off instead.");
  await db.promoCode.delete({ where: { id } });
  await audit(adminId, "admin.promo.delete", "promo", id, { code: code.code });
}

export type PromoStats = {
  paid: number;
  pending: number;
  revenue: number;
  discount: number;
  signups: number;
  lastUsedAt: Date | null;
  state: CodeState;
};

/** Paid orders, revenue, discount given and sign-ups through the code's link — for each code. */
async function statsFor(codes: PromoCode[]): Promise<Map<string, PromoStats>> {
  const ids = codes.map((c) => c.id);
  const [paid, pending, signups] = await Promise.all([
    db.order.groupBy({
      by: ["promoCodeId"],
      where: { promoCodeId: { in: ids }, status: "PAID" },
      _count: { _all: true },
      _sum: { amount: true, discount: true },
      _max: { paidAt: true },
    }),
    db.order.groupBy({ by: ["promoCodeId"], where: { promoCodeId: { in: ids }, status: "PENDING" }, _count: { _all: true } }),
    db.user.groupBy({ by: ["source"], where: { source: { in: codes.map((c) => `code:${c.code}`) } }, _count: { _all: true } }),
  ]);
  const map = new Map<string, PromoStats>();
  for (const c of codes) {
    const p = paid.find((r) => r.promoCodeId === c.id);
    const n = p?._count._all ?? 0;
    map.set(c.id, {
      paid: n,
      pending: pending.find((r) => r.promoCodeId === c.id)?._count._all ?? 0,
      revenue: p?._sum.amount ?? 0,
      discount: p?._sum.discount ?? 0,
      signups: signups.find((r) => r.source === `code:${c.code}`)?._count._all ?? 0,
      lastUsedAt: p?._max.paidAt ?? null,
      state: codeState(c, n),
    });
  }
  return map;
}

export async function listPromoCodes() {
  const codes = await db.promoCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] });
  const stats = await statsFor(codes);
  return codes.map((c) => ({ ...c, stats: stats.get(c.id)! }));
}

export async function getPromoCode(id: string) {
  const code = await db.promoCode.findUnique({ where: { id } });
  if (!code) return null;
  const [stats, orders, signups] = await Promise.all([
    statsFor([code]),
    db.order.findMany({
      where: { promoCodeId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true, email: true } }, event: { select: { id: true, title: true } } },
    }),
    db.user.findMany({
      where: { source: `code:${code.code}` },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: { where: { status: "PAID" } } } } },
    }),
  ]);
  return { code, stats: stats.get(id)!, orders, signups };
}
