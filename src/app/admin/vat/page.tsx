import type { Metadata } from "next";
import Link from "next/link";
import { Download, Mail } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { companyDetails } from "@/server/legal";
import { type SearchParams, str } from "@/server/admin/params";
import {
  addMonths,
  exactMoney,
  monthKey,
  monthLabel,
  monthLines,
  monthlyTotals,
  quarterMonthsUpTo,
  quarterOf,
  rollingYearNet,
  sumTotals,
  TAX_TZ,
  VAT_MANDATORY_SAR,
  VAT_VOLUNTARY_SAR,
  vatRate,
  type MonthTotals,
} from "@/server/admin/tax";
import { DataTable, Muted, PageHeader, SectionTitle, StatTile } from "@/components/admin/ui";
import { dt, eventDateTime, num } from "@/components/admin/format";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "VAT" };

/**
 * VAT owed per month, to the halala. Prices include VAT, so each receipt carries
 * rate/(100+rate) of its amount as VAT; refunds give it back in the month they're made.
 */
export default async function VatPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const rate = vatRate();
  const now = monthKey(new Date());
  const last = addMonths(now, -1);
  const selected = /^\d{4}-(0[1-9]|1[0-2])$/.test(str(sp, "month") ?? "") ? str(sp, "month")! : null;

  const [rows, statements, yearNet, lines] = await Promise.all([
    monthlyTotals(),
    db.taxStatement.findMany(),
    rollingYearNet("SAR"),
    selected ? monthLines(selected) : null,
  ]);
  const currencies = [...new Set(rows.map((r) => r.currency))];
  const main = currencies[0];
  const pick = (m: string) => rows.find((r) => r.month === m && r.currency === main) ?? sumTotals([], m, main);
  const thisQuarter = sumTotals(rows.filter((r) => quarterMonthsUpTo(now).includes(r.month)), quarterOf(now), main);
  const statementFor = (r: MonthTotals) => statements.find((s) => s.month === r.month && s.currency === r.currency);
  const quarters = [...new Set(rows.map((r) => quarterOf(r.month)))].map((q) => ({
    q,
    totals: currencies.map((c) => sumTotals(rows.filter((r) => quarterOf(r.month) === q), q, c)),
  }));
  const registered = Boolean(companyDetails()?.vat);
  const money = (minor: number, currency = main) => exactMoney(minor, currency);

  return (
    <>
      <PageHeader
        eyebrow="Business"
        title="VAT"
        description={`What you owe each month, to the halala. Prices include VAT, so ${rate}% VAT is the ${rate}/${100 + rate} share of every payment; refunds give it back in the month they're made. On the 1st of each month last month's statement is saved and emailed to the admins.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label={`VAT owed · ${monthLabel(last)}`} tone="bronze" value={money(pick(last).vat)} hint={`${num(pick(last).receipts)} receipts · ${money(pick(last).sales)} collected`} href={`/admin/vat?month=${last}`} />
        <StatTile label={`So far · ${monthLabel(now)}`} tone="ochre" value={money(pick(now).vat)} hint={`${num(pick(now).receipts)} receipts · ${money(pick(now).sales)} collected`} href={`/admin/vat?month=${now}`} />
        <StatTile label={`VAT owed · ${quarterOf(now)} so far`} value={money(thisQuarter.vat)} hint="Saudi VAT returns are filed per quarter for most small businesses" />
        <StatTile
          label="Sales excl. VAT · last 12 months"
          tone={yearNet >= VAT_MANDATORY_SAR ? "rosewood" : yearNet >= VAT_VOLUNTARY_SAR ? "ochre" : "sage"}
          value={exactMoney(yearNet, "SAR")}
          hint={
            yearNet >= VAT_MANDATORY_SAR
              ? "Above SAR 375,000 — VAT registration is mandatory"
              : yearNet >= VAT_VOLUNTARY_SAR
                ? "Above SAR 187,500 — you may register voluntarily"
                : "Registration becomes mandatory above SAR 375,000"
          }
        />
      </div>

      {!registered ? (
        <p className="mt-6 rounded-2xl border border-ochre/25 bg-ochre-soft px-5 py-3.5 text-[13.5px] leading-relaxed text-ink-soft">
          These figures assume {rate}% VAT is included in your prices. VAT is owed to ZATCA once you&apos;re registered for VAT (mandatory above SAR 375,000 of
          sales a year) — until then, treat it as the amount to set aside. When you register, add your VAT number as <code>LEGAL_VAT_NUMBER</code> on Render so
          receipts show the VAT.
        </p>
      ) : null}

      {selected && lines ? (
        <section className="mt-10">
          <SectionTitle
            title={`${monthLabel(selected)} — every receipt`}
            description="Each line's VAT is rounded to the halala; the month's VAT is the sum of the lines."
            action={
              <div className="flex gap-2">
                <a href={`/api/admin/vat/csv?month=${selected}`} className={buttonClasses("outline", "sm")} download>
                  <Download className="size-3.5" />
                  CSV
                </a>
                <Link href="/admin/vat" className={buttonClasses("ghost", "sm")}>
                  All months
                </Link>
              </div>
            }
          />
          <DataTable
            caption={`Receipts ${selected}`}
            rows={lines.map((l, i) => ({ ...l, key: `${l.order.id}-${l.kind}-${i}` }))}
            rowKey={(l) => l.key}
            empty="No receipts or refunds this month."
            columns={[
              { key: "date", header: "Date (Riyadh)", cell: (l) => <span className="whitespace-nowrap">{eventDateTime(l.date, TAX_TZ)}</span> },
              {
                key: "receipt",
                header: "Receipt",
                cell: (l) => (
                  <div>
                    <p className="text-ink">{l.order.receiptNumber ?? <Muted>—</Muted>}</p>
                    <p className={cn("text-[12px]", l.kind === "Refund" ? "text-rosewood" : "text-ink-faint")}>{l.kind}</p>
                  </div>
                ),
              },
              { key: "customer", header: "Customer", cell: (l) => l.order.user.name, hideBelow: "md" },
              { key: "amount", header: "Incl. VAT", align: "end", cell: (l) => <span className="whitespace-nowrap tabular-nums">{exactMoney(l.amount, l.order.currency)}</span> },
              { key: "vat", header: `VAT ${rate}%`, align: "end", cell: (l) => <span className="whitespace-nowrap font-medium tabular-nums text-ink">{exactMoney(l.vat, l.order.currency)}</span> },
              { key: "net", header: "Excl. VAT", align: "end", cell: (l) => <span className="whitespace-nowrap tabular-nums">{exactMoney(l.amount - l.vat, l.order.currency)}</span>, hideBelow: "sm" },
            ]}
          />
          {currencies.map((c) => {
            const t = rows.find((r) => r.month === selected && r.currency === c);
            return t ? (
              <p key={c} className="mt-3 text-end text-[14px] text-ink-soft">
                Total: {exactMoney(t.sales, c)} collected · <b className="text-ink">VAT owed {exactMoney(t.vat, c)}</b> · income excl. VAT {exactMoney(t.net, c)}
              </p>
            ) : null;
          })}
        </section>
      ) : null}

      <section className="mt-10">
        <SectionTitle title="By month" description="Riyadh time. Refunds count in the month they're made." />
        <DataTable
          caption="VAT by month"
          rows={rows}
          rowKey={(r) => `${r.month}-${r.currency}`}
          columns={[
            {
              key: "month",
              header: "Month",
              cell: (r) => (
                <Link href={`/admin/vat?month=${r.month}`} className="whitespace-nowrap text-ink underline-offset-4 hover:underline">
                  {monthLabel(r.month)}
                  {currencies.length > 1 ? <span className="text-ink-faint"> · {r.currency}</span> : null}
                </Link>
              ),
            },
            { key: "receipts", header: "Receipts", align: "end", cell: (r) => num(r.receipts), hideBelow: "sm" },
            { key: "gross", header: "Collected", align: "end", cell: (r) => <span className="whitespace-nowrap tabular-nums">{exactMoney(r.gross, r.currency)}</span>, hideBelow: "md" },
            { key: "refunds", header: "Refunded", align: "end", cell: (r) => <span className="whitespace-nowrap tabular-nums">{exactMoney(r.refunds, r.currency)}</span>, hideBelow: "lg" },
            { key: "vat", header: `VAT ${rate}% owed`, align: "end", cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums text-ink">{exactMoney(r.vat, r.currency)}</span> },
            { key: "net", header: "Income excl. VAT", align: "end", cell: (r) => <span className="whitespace-nowrap tabular-nums">{exactMoney(r.net, r.currency)}</span>, hideBelow: "sm" },
            {
              key: "statement",
              header: "Statement",
              cell: (r) => {
                const s = statementFor(r);
                if (r.month === now) return <Muted>In progress</Muted>;
                if (!s) return <Muted>—</Muted>;
                return (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-sage" title={s.vat !== r.vat ? `Saved as ${exactMoney(s.vat, s.currency)}` : undefined}>
                    <Mail className="size-3.5" />
                    {s.emailedAt ? `Sent ${dt(s.emailedAt)}` : "Saved"}
                    {s.vat !== r.vat ? <span className="text-ochre">· changed since</span> : null}
                  </span>
                );
              },
              hideBelow: "lg",
            },
            {
              key: "csv",
              header: <span className="sr-only">CSV</span>,
              align: "end",
              cell: (r) => (
                <a href={`/api/admin/vat/csv?month=${r.month}`} className="text-[12.5px] font-medium text-bronze-700 hover:text-bronze-900" download>
                  CSV
                </a>
              ),
            },
          ]}
        />
      </section>

      <section className="mt-10">
        <SectionTitle title="By quarter" description="What a quarterly VAT return covers." />
        <DataTable
          caption="VAT by quarter"
          rows={quarters.flatMap((q) => q.totals)}
          rowKey={(t) => `${t.month}-${t.currency}`}
          columns={[
            { key: "q", header: "Quarter", cell: (t) => t.month + (currencies.length > 1 ? ` · ${t.currency}` : "") },
            { key: "receipts", header: "Receipts", align: "end", cell: (t) => num(t.receipts), hideBelow: "sm" },
            { key: "sales", header: "Collected − refunds", align: "end", cell: (t) => <span className="tabular-nums">{exactMoney(t.sales, t.currency)}</span>, hideBelow: "md" },
            { key: "vat", header: `VAT ${rate}% owed`, align: "end", cell: (t) => <span className="font-medium tabular-nums text-ink">{exactMoney(t.vat, t.currency)}</span> },
            { key: "net", header: "Income excl. VAT", align: "end", cell: (t) => <span className="tabular-nums">{exactMoney(t.net, t.currency)}</span> },
          ]}
        />
      </section>
    </>
  );
}
