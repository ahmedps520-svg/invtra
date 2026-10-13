import { db } from "@/server/db";
import { paymentCurrency } from "@/server/payments/service";
import { currencyDigits } from "@/lib/format";

/**
 * Admin → Funnel: what happens to the people who sign up. Accounts created in the chosen period
 * (customers only) are followed through each step — verified their email, created an event,
 * added guests, paid, sent invitations — overall, week by week, and by where they came from.
 * Weeks start on Sunday in Riyadh time. The steps aren't strictly in order (someone can pay
 * before adding guests), so "continued" counts the people who did both a step and the one before.
 */

export const FUNNEL_RANGES = [4, 12, 26] as const;
export type FunnelRange = (typeof FUNNEL_RANGES)[number];
export const FUNNEL_STEPS = ["signedUp", "verified", "createdEvent", "addedGuests", "paid", "sent"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
export type StepCounts = Record<FunnelStep, number>;

const TZ = "Asia/Riyadh";
const DAY = 86_400_000;
// Riyadh is UTC+3 all year (no daylight saving).
const RIYADH_OFFSET = 3 * 3_600_000;

/** Midnight (Riyadh) on the Sunday that starts this instant's week, as a UTC Date. */
export function weekStart(d: Date): Date {
  const local = new Date(d.getTime() + RIYADH_OFFSET);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - local.getUTCDay() * DAY - RIYADH_OFFSET);
}

const zero = (): StepCounts => ({ signedUp: 0, verified: 0, createdEvent: 0, addedGuests: 0, paid: 0, sent: 0 });

/** "Direct", "Invitation links", "Code TIKTOK10", "Ad: tiktok", "Made by INVTRA". */
export function sourceLabel(source: string | null): string {
  if (!source) return "Direct";
  if (source === "invitation") return "Invitation links";
  if (source === "staff") return "Made by INVTRA";
  if (source.startsWith("code:")) return `Code ${source.slice(5)}`;
  if (source.startsWith("utm:")) return `Ad: ${source.slice(4)}`;
  return source;
}

export async function funnel(weeks: FunnelRange, sourceFilter: string | null = null, now = new Date()) {
  const thisWeek = weekStart(now);
  const from = new Date(thisWeek.getTime() - (weeks - 1) * 7 * DAY);
  const bySourceFilter = sourceFilter === "direct" ? { source: null } : sourceFilter ? { source: sourceFilter } : {};
  const users = await db.user.findMany({
    where: { role: "CUSTOMER", createdAt: { gte: from }, ...bySourceFilter },
    select: { id: true, createdAt: true, source: true, emailVerifiedAt: true },
  });
  const ids = users.map((u) => u.id);
  const [withEvents, withGuests, sent, paidOrders, revenueOrders] = await Promise.all([
    db.event.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ["userId"] }),
    db.event.findMany({ where: { userId: { in: ids }, guests: { some: { isTest: false } } }, select: { userId: true }, distinct: ["userId"] }),
    db.event.findMany({
      where: { userId: { in: ids }, OR: [{ firstSentAt: { not: null } }, { guests: { some: { isTest: false, OR: [{ manualSentAt: { not: null } }, { requestSentAt: { not: null } }] } } }] },
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.order.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "PAID" }, _sum: { amount: true } }),
    // Revenue in the period, from every customer (not only the new ones) from the chosen source.
    db.order.findMany({
      where: { status: "PAID", paidAt: { gte: from }, user: { role: "CUSTOMER", ...bySourceFilter } },
      select: { amount: true, currency: true, userId: true },
    }),
  ]);
  const has = (rows: { userId: string }[]) => new Set(rows.map((r) => r.userId));
  const events = has(withEvents);
  const guests = has(withGuests);
  const sentSet = has(sent);
  const paid = new Map(paidOrders.map((r) => [r.userId, r._sum.amount ?? 0]));

  const steps = (u: (typeof users)[number]): Record<FunnelStep, boolean> => ({
    signedUp: true,
    verified: Boolean(u.emailVerifiedAt),
    createdEvent: events.has(u.id),
    addedGuests: guests.has(u.id),
    paid: paid.has(u.id),
    sent: sentSet.has(u.id),
  });

  const total = zero();
  const continued = zero();
  const byWeek = new Map<number, StepCounts & { revenue: number }>();
  for (let i = 0; i < weeks; i++) byWeek.set(from.getTime() + i * 7 * DAY, { ...zero(), revenue: 0 });
  const bySource = new Map<string | null, StepCounts & { revenue: number }>();

  for (const u of users) {
    const s = steps(u);
    const week = byWeek.get(weekStart(u.createdAt).getTime());
    const src = bySource.get(u.source) ?? { ...zero(), revenue: 0 };
    FUNNEL_STEPS.forEach((k, i) => {
      if (!s[k]) return;
      total[k]++;
      if (i === 0 || s[FUNNEL_STEPS[i - 1]]) continued[k]++;
      if (week) week[k]++;
      src[k]++;
    });
    const spent = paid.get(u.id) ?? 0;
    if (week) week.revenue += spent;
    src.revenue += spent;
    bySource.set(u.source, src);
  }

  const codes = await db.promoCode.findMany({
    where: { code: { in: [...bySource.keys()].filter((s) => s?.startsWith("code:")).map((s) => s!.slice(5)) } },
    select: { id: true, code: true },
  });
  const codeId = new Map(codes.map((c) => [`code:${c.code}`, c.id]));

  const currency = paymentCurrency();
  const inCurrency = revenueOrders.filter((o) => o.currency === currency);
  const periodRevenue = inCurrency.reduce((n, o) => n + o.amount, 0);
  const unit = 10 ** currencyDigits(currency);
  const average = inCurrency.length ? Math.round(periodRevenue / inCurrency.length / unit) * unit : null;
  const payers = new Set(revenueOrders.map((o) => o.userId)).size;

  return {
    weeks,
    from: from.toISOString(),
    currency,
    total,
    /** Of those who reached the step before, how many also did this one. */
    continued,
    revenue: { period: periodRevenue, orders: inCurrency.length, average, payers },
    weekly: [...byWeek.entries()].map(([t, c]) => ({ week: new Date(t).toISOString(), ...c })),
    sources: [...bySource.entries()]
      .map(([source, c]) => ({ source, label: sourceLabel(source), codeId: (source && codeId.get(source)) ?? null, ...c }))
      .sort((a, b) => b.signedUp - a.signedUp || b.paid - a.paid),
  };
}

export type FunnelData = Awaited<ReturnType<typeof funnel>>;

/** Every source seen on accounts, for the filter. */
export async function funnelSources() {
  const rows = await db.user.groupBy({ by: ["source"], where: { role: "CUSTOMER" }, _count: { _all: true } });
  return rows
    .map((r) => ({ value: r.source ?? "direct", label: sourceLabel(r.source), count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

export const formatWeek = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(iso));
