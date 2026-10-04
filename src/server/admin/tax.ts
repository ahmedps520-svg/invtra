import type { Order } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl, env } from "@/server/env";
import { emailLayout, sendEmail } from "@/server/email";
import { audit, logError } from "@/server/log";
import { utcToZoned, zonedToUtc } from "@/lib/time";

/**
 * VAT for INVTRA's own sales. Prices are VAT-inclusive (as the site and receipts say), so
 * the VAT inside a payment of A at rate r is A × r / (100 + r), rounded to the halala per
 * receipt. Each month (Riyadh time) owes the VAT on its sales minus the VAT on refunds made
 * that month. On the 1st, the worker saves the previous month's statement and emails it.
 */

export const TAX_TZ = "Asia/Riyadh";
/** Statements are saved and emailed from this month on (the first month INVTRA tracked VAT). */
export const FIRST_STATEMENT_MONTH = "2026-10";
/** Saudi VAT registration: mandatory above SAR 375,000 a year, optional above SAR 187,500. */
export const VAT_MANDATORY_SAR = 375_000_00;
export const VAT_VOLUNTARY_SAR = 187_500_00;

export function vatRate(): number {
  return env().VAT_RATE;
}

/** The VAT inside a VAT-inclusive amount, in minor units (rounded half up). */
export function vatInside(amountMinor: number, rate = vatRate()): number {
  if (!rate || amountMinor <= 0) return 0;
  return Math.floor((amountMinor * rate) / (100 + rate) + 0.5);
}

/** Minor-unit digits per currency (KWD, BHD and OMR have 3). */
export function minorDigits(currency: string) {
  return ["KWD", "BHD", "OMR"].includes(currency) ? 3 : 2;
}

/** "SAR 1,152.00" — always to the halala / cent. */
export function exactMoney(minor: number, currency: string): string {
  const d = minorDigits(currency);
  const sign = minor < 0 ? "−" : "";
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(minor) / 10 ** d);
  return `${sign}${currency} ${n}`;
}

/** "2026-10" for a moment, in Riyadh time. */
export function monthKey(d: Date): string {
  return utcToZoned(d, TAX_TZ).date.slice(0, 7);
}

export function monthStart(key: string): Date {
  return zonedToUtc(`${key}-01`, "00:00", TAX_TZ);
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-15T00:00:00Z`));
}

/** "Q4 2026" — Saudi VAT returns are quarterly for most small businesses. */
export function quarterOf(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `Q${Math.ceil(m / 3)} ${y}`;
}

export type MonthTotals = {
  month: string;
  currency: string;
  /** Paid orders (receipts) in the month. */
  receipts: number;
  /** Collected, VAT included. */
  gross: number;
  refundsCount: number;
  /** Refunded in the month, VAT included. */
  refunds: number;
  /** Collected minus refunded, VAT included. */
  sales: number;
  /** VAT owed: on the month's sales minus on its refunds. */
  vat: number;
  /** Income excluding VAT. */
  net: number;
};

type TaxOrder = Pick<Order, "id" | "amount" | "currency" | "status" | "paidAt" | "refundedAt" | "updatedAt">;

const refundDate = (o: TaxOrder) => o.refundedAt ?? o.updatedAt;

function empty(month: string, currency: string): MonthTotals {
  return { month, currency, receipts: 0, gross: 0, refundsCount: 0, refunds: 0, sales: 0, vat: 0, net: 0 };
}

/** Orders that took money (paid, or paid then refunded) — complimentary plans are excluded. */
async function moneyOrders(range?: { from: Date; to: Date }) {
  const within = range ? { gte: range.from, lt: range.to } : undefined;
  return db.order.findMany({
    where: {
      amount: { gt: 0 },
      status: { in: ["PAID", "REFUNDED"] },
      paidAt: { not: null },
      ...(range ? { OR: [{ paidAt: within }, { refundedAt: within }, { refundedAt: null, status: "REFUNDED", updatedAt: within }] } : {}),
    },
    select: { id: true, amount: true, currency: true, status: true, paidAt: true, refundedAt: true, updatedAt: true },
  });
}

/** Totals per month and currency, from the first month with money up to `until` (default: this month). */
export async function monthlyTotals(opts: { until?: string; months?: string[]; rate?: number } = {}): Promise<MonthTotals[]> {
  const rate = opts.rate ?? vatRate();
  const until = opts.until ?? monthKey(new Date());
  const orders = opts.months?.length
    ? await moneyOrders({ from: monthStart(opts.months[0]), to: monthStart(addMonths(opts.months[opts.months.length - 1], 1)) })
    : await moneyOrders();
  const rows = new Map<string, MonthTotals>();
  const row = (month: string, currency: string) => {
    const k = `${month}|${currency}`;
    if (!rows.has(k)) rows.set(k, empty(month, currency));
    return rows.get(k)!;
  };
  const inScope = (m: string) => (opts.months?.length ? opts.months.includes(m) : m <= until);
  for (const o of orders) {
    const paidMonth = monthKey(o.paidAt!);
    if (inScope(paidMonth)) {
      const r = row(paidMonth, o.currency);
      r.receipts += 1;
      r.gross += o.amount;
      r.vat += vatInside(o.amount, rate);
    }
    if (o.status === "REFUNDED") {
      const refundMonth = monthKey(refundDate(o));
      if (inScope(refundMonth)) {
        const r = row(refundMonth, o.currency);
        r.refundsCount += 1;
        r.refunds += o.amount;
        r.vat -= vatInside(o.amount, rate);
      }
    }
  }
  const currencies = [...new Set([...rows.values()].map((r) => r.currency))];
  if (!currencies.length) currencies.push(env().PAYMENT_CURRENCY);
  // Every month from the first with money (or the requested ones), so empty months show too.
  const months = opts.months?.length ? opts.months : monthsBetween([...rows.values()].map((r) => r.month).sort()[0] ?? until, until);
  const out: MonthTotals[] = [];
  for (const m of months) for (const c of currencies) out.push(rows.get(`${m}|${c}`) ?? empty(m, c));
  for (const r of out) {
    r.sales = r.gross - r.refunds;
    r.net = r.sales - r.vat;
  }
  return out.sort((a, b) => (a.month === b.month ? a.currency.localeCompare(b.currency) : b.month.localeCompare(a.month)));
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 240; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Sum of several months (a quarter, a year). */
export function sumTotals(rows: MonthTotals[], label: string, currency: string): MonthTotals {
  const t = empty(label, currency);
  for (const r of rows.filter((x) => x.currency === currency)) {
    t.receipts += r.receipts;
    t.gross += r.gross;
    t.refundsCount += r.refundsCount;
    t.refunds += r.refunds;
    t.sales += r.sales;
    t.vat += r.vat;
    t.net += r.net;
  }
  return t;
}

/** Sales excluding VAT over the last 12 months (for the registration thresholds). */
export async function rollingYearNet(currency = "SAR") {
  const now = monthKey(new Date());
  const months = monthsBetween(addMonths(now, -11), now);
  return sumTotals(await monthlyTotals({ months }), "12 months", currency).net;
}

/** One month's receipts and refunds, line by line (CSV export). */
export async function monthLines(month: string) {
  const rate = vatRate();
  const from = monthStart(month);
  const to = monthStart(addMonths(month, 1));
  const orders = await db.order.findMany({
    where: {
      amount: { gt: 0 },
      status: { in: ["PAID", "REFUNDED"] },
      paidAt: { not: null },
      OR: [{ paidAt: { gte: from, lt: to } }, { refundedAt: { gte: from, lt: to } }, { refundedAt: null, status: "REFUNDED", updatedAt: { gte: from, lt: to } }],
    },
    include: { user: { select: { name: true, email: true } }, event: { select: { title: true } } },
    orderBy: { paidAt: "asc" },
  });
  type Line = { date: Date; kind: "Sale" | "Refund"; order: (typeof orders)[number]; amount: number; vat: number };
  const lines: Line[] = [];
  for (const o of orders) {
    if (o.paidAt! >= from && o.paidAt! < to) lines.push({ date: o.paidAt!, kind: "Sale", order: o, amount: o.amount, vat: vatInside(o.amount, rate) });
    const rd = o.refundedAt ?? o.updatedAt;
    if (o.status === "REFUNDED" && rd >= from && rd < to) lines.push({ date: rd, kind: "Refund", order: o, amount: -o.amount, vat: -vatInside(o.amount, rate) });
  }
  return lines.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function monthCsv(month: string): Promise<string> {
  const lines = await monthLines(month);
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fixed = (minor: number, currency: string) => (minor / 10 ** minorDigits(currency)).toFixed(minorDigits(currency));
  const head = ["Receipt no.", "Date (Riyadh)", "Type", "Customer", "Email", "Event", "Plan", "Amount incl. VAT", `VAT ${vatRate()}%`, "Amount excl. VAT", "Currency", "Provider", "Provider reference", "Order id"];
  const rows = lines.map((l) => {
    const z = utcToZoned(l.date, TAX_TZ);
    const [y, m, d] = z.date.split("-");
    return [
      l.order.receiptNumber ?? "",
      `${d}/${m}/${y} ${z.time}`,
      l.kind,
      l.order.user.name,
      l.order.user.email,
      l.order.event?.title ?? "",
      l.order.plan,
      fixed(l.amount, l.order.currency),
      fixed(l.vat, l.order.currency),
      fixed(l.amount - l.vat, l.order.currency),
      l.order.currency,
      l.order.provider,
      l.order.providerRef ?? "",
      l.order.id,
    ];
  });
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

// ── Monthly statement ───────────────────────────────────────────────────────

async function adminRecipients(): Promise<string[]> {
  const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { email: true } });
  const list = admins.map((a) => a.email.toLowerCase());
  const configured = env().ADMIN_EMAIL?.toLowerCase();
  if (configured) list.push(configured);
  return [...new Set(list)];
}

/**
 * Save last month's statement and email it to the admins (runs hourly in the worker; does
 * its work once, on the first run after a month ends).
 */
export async function closeTaxMonth(now = new Date()) {
  const month = addMonths(monthKey(now), -1);
  if (month < FIRST_STATEMENT_MONTH) return null;
  if (await db.taxStatement.findFirst({ where: { month } })) return null;
  const rate = vatRate();
  const totals = await monthlyTotals({ months: [month], rate });
  const quarterMonths = quarterMonthsUpTo(month);
  const quarter = await monthlyTotals({ months: quarterMonths, rate });
  const saved = [];
  for (const t of totals) {
    try {
      saved.push(
        await db.taxStatement.create({
          data: { month, currency: t.currency, rate, receipts: t.receipts, gross: t.gross, refunds: t.refunds, vat: t.vat, net: t.net },
        }),
      );
    } catch {
      return null; // another worker saved it first
    }
  }
  try {
    const to = await adminRecipients();
    const label = monthLabel(month);
    const q = quarterOf(month);
    const lines = totals.map((t) => {
      const qt = sumTotals(quarter, q, t.currency);
      return {
        text: [
          `Receipts: ${t.receipts}`,
          `Collected (VAT included): ${exactMoney(t.gross, t.currency)}`,
          `Refunded: ${exactMoney(t.refunds, t.currency)}`,
          `VAT ${rate}% owed for ${label}: ${exactMoney(t.vat, t.currency)}`,
          `Your income excluding VAT: ${exactMoney(t.net, t.currency)}`,
          `${q} so far — VAT owed: ${exactMoney(qt.vat, t.currency)}`,
        ],
      };
    });
    const link = appUrl(`/admin/vat?month=${month}`);
    const text = `INVTRA VAT statement — ${label}\n\n${lines.map((l) => l.text.join("\n")).join("\n\n")}\n\nEvery receipt, line by line: ${link}\n`;
    const html = emailLayout(
      `VAT statement — ${label}`,
      lines.map((l) => `<p>${l.text.map((x, i) => (i === 3 ? `<b>${x}</b>` : x)).join("<br>")}</p>`).join("") +
        `<p><a href="${link}" style="color:#84664a">Open the VAT report</a> — every receipt, line by line, and a CSV for your accountant.</p>`,
    );
    for (const address of to) await sendEmail({ to: address, subject: `INVTRA VAT for ${label}: ${totals.map((t) => exactMoney(t.vat, t.currency)).join(" + ")}`, text, html });
    await db.taxStatement.updateMany({ where: { month }, data: { emailedAt: new Date() } });
  } catch (e) {
    await logError("tax:statement-email", e, { month });
  }
  return saved;
}

/** The months of `month`'s quarter, from its first month up to `month`. */
export function quarterMonthsUpTo(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = Math.floor((m - 1) / 3) * 3 + 1;
  return monthsBetween(`${y}-${String(first).padStart(2, "0")}`, month);
}

// ── Starting fresh ──────────────────────────────────────────────────────────

export const RESET_PHRASE = "DELETE ALL PAYMENTS";

/**
 * Delete every order, payment attempt, receipt number and VAT statement (test payments made
 * before going live). Events keep the plans they have. The audit log keeps a summary.
 */
export async function resetPaymentHistory(actorId: string) {
  const result = await db.$transaction(async (tx) => {
    const orders = await tx.order.findMany({ select: { status: true, amount: true, currency: true } });
    const payments = await tx.payment.count();
    const paid: Record<string, number> = {};
    for (const o of orders) if (o.status === "PAID" || o.status === "REFUNDED") paid[o.currency] = (paid[o.currency] ?? 0) + o.amount;
    await tx.payment.deleteMany({});
    await tx.order.deleteMany({});
    await tx.receiptCounter.deleteMany({});
    await tx.taxStatement.deleteMany({});
    await tx.job.updateMany({
      where: { type: { in: ["payment.request", "payment.receipt"] }, status: "PENDING" },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    return { orders: orders.length, payments, paid };
  });
  await audit(actorId, "admin.payments.reset", "payments", "all", result);
  return result;
}
