import { Logo } from "@/components/brand/logo";
import { formatDate, formatMoney } from "@/lib/format";
import { planName } from "@/lib/plans";
import { guestsLabel } from "@/server/payments/receipts";
import type { CompanyDetails } from "@/server/legal";
import type { PayCopy } from "@/lib/i18n/pay-copy";
import { cn } from "@/lib/utils";
import { PrintButton } from "./print-button";

export type ReceiptData = {
  receiptNumber: string;
  paidAt: Date;
  plan: string;
  guestLimit: number;
  amount: number;
  currency: string;
  title: string | null;
  customer: { name: string; email: string; phone: string | null };
  event: { title: string; titleAr: string | null; timezone: string } | null;
  payment: { provider: string; reference: string | null; method: string | null } | null;
  refunded: boolean;
};

const METHOD: Record<string, string> = {
  APPLE_PAY: "Apple Pay",
  GOOGLE_PAY: "Google Pay",
  MADA: "mada",
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  AMERICAN_EXPRESS: "American Express",
  AMEX: "American Express",
  STC_PAY: "STC Pay",
  STCPAY: "STC Pay",
};

export function methodLabel(provider: string, method: string | null, ar: boolean): string {
  if (method && METHOD[method.toUpperCase()]) return METHOD[method.toUpperCase()];
  if (provider === "manual") return ar ? "تحويل بنكي" : "Bank transfer";
  if (provider === "mock") return ar ? "دفعة تجريبية" : "Test payment";
  return ar ? "بطاقة" : "Card";
}

/** Printable payment receipt (A4-friendly; the site chrome is hidden when printing). */
export function Receipt({ data, t, ar, company }: { data: ReceiptData; t: PayCopy; ar: boolean; company: CompanyDetails | null }) {
  const locale = ar ? "ar" : "en";
  const tz = data.event?.timezone ?? "Asia/Riyadh";
  const eventTitle = (ar ? data.event?.titleAr || data.event?.title : data.event?.title) ?? "";
  const plan = data.plan === "CUSTOM" ? t.customPlan : `${planName(data.plan)}${ar ? "" : " plan"}`;
  return (
    <article className="receipt rounded-[1.75rem] border border-line bg-paper px-6 py-8 shadow-soft sm:px-10 sm:py-10 print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
        <div>
          <Logo markClassName="h-9" />
          <div className="mt-4 text-[13px] leading-relaxed text-ink-soft">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-faint">{t.from}</p>
            <p className="mt-1 font-medium text-ink">{company?.name ?? "INVTRA"}</p>
            {company?.cr ? <p>CR {company.cr}</p> : null}
            {company?.vat ? <p>VAT {company.vat}</p> : null}
            {company?.address ? <p>{company.address}</p> : null}
            <p dir="ltr" className={cn(ar && "text-end")}>contact@invtra.store · invtra.store</p>
          </div>
        </div>
        <div className="text-end">
          <h1 className="font-display text-3xl text-ink">{t.receipt}</h1>
          <dl className="mt-3 space-y-1 text-[13.5px]">
            <div className="flex justify-end gap-2">
              <dt className="text-ink-faint">{t.receiptNo}</dt>
              <dd className="font-medium text-ink tabular-nums" dir="ltr">
                {data.receiptNumber}
              </dd>
            </div>
            <div className="flex justify-end gap-2">
              <dt className="text-ink-faint">{t.paidOn}</dt>
              <dd className="text-ink">{formatDate(data.paidAt, { locale, timeZone: tz, style: "long" })}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
        <div className="text-[13.5px] leading-relaxed text-ink-soft">
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink-faint">{t.billedTo}</p>
          <p className="mt-1 font-medium text-ink">{data.customer.name}</p>
          <p dir="ltr" className={cn(ar && "text-end")}>
            {data.customer.email}
          </p>
          {data.customer.phone ? (
            <p dir="ltr" className={cn(ar && "text-end")}>
              {data.customer.phone}
            </p>
          ) : null}
        </div>
        {data.payment ? (
          <div className="text-[13.5px] leading-relaxed text-ink-soft sm:text-end">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-faint">{t.method}</p>
            <p className="mt-1 font-medium text-ink">{methodLabel(data.payment.provider, data.payment.method, ar)}</p>
            {data.payment.reference ? (
              <p className="break-all text-[12px]" dir="ltr">
                {t.reference}: {data.payment.reference}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <table className="mt-6 w-full text-[14px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            <th className="pb-3 text-start font-medium">{t.description}</th>
            <th className="pb-3 text-end font-medium">{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-line align-top">
            <td className="py-4 pe-4 text-ink">
              <p className="font-medium">
                INVTRA — {plan}
                {eventTitle ? ` · ${eventTitle}` : ""}
              </p>
              <p className="mt-1 text-[13px] text-ink-soft">{guestsLabel(data.guestLimit, ar)}</p>
              {data.title ? <p dir="auto" className={cn("mt-1 whitespace-pre-line text-[13px] text-ink-soft", ar ? "text-right" : "text-left")}>{data.title}</p> : null}
            </td>
            <td className="py-4 text-end font-medium text-ink tabular-nums">{formatMoney(data.amount, data.currency, locale)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink/80">
            <td className="pt-4 font-display text-xl text-ink">{t.total}</td>
            <td className="pt-4 text-end font-display text-2xl text-ink tabular-nums">{formatMoney(data.amount, data.currency, locale)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-4 text-[12px] text-ink-faint">{t.vat}</p>
      {data.refunded ? <p className="mt-3 rounded-xl bg-rosewood-soft px-4 py-2 text-[13px] text-rosewood">{t.refunded}</p> : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-[12.5px] text-ink-faint">{t.contact}</p>
        <PrintButton label={t.print} />
      </div>
    </article>
  );
}
