import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  FlaskConical,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { companyDetails } from "@/server/legal";
import { confirmTapOrder } from "@/server/payments/tap-webhook";
import { ensureReceiptNumber, guestsLabel } from "@/server/payments/receipts";
import { PAY_COPY } from "@/lib/i18n/pay-copy";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/config";
import { formatDate, formatMoney, formatTime } from "@/lib/format";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { PayButton } from "@/components/billing/pay-button";
import { Receipt, type ReceiptData } from "@/components/billing/receipt";
import { AutoRefresh } from "@/components/billing/auto-refresh";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const METHODS = ["Apple Pay", "Google Pay", "mada", "Visa", "Mastercard"];

async function load(token: string) {
  return db.order.findUnique({
    where: { payToken: token },
    include: {
      user: { select: { name: true, email: true, phone: true, locale: true } },
      event: {
        select: {
          id: true,
          title: true,
          titleAr: true,
          startsAt: true,
          timezone: true,
          venueName: true,
          venueNameAr: true,
        },
      },
      payments: {
        where: { status: { in: ["SUCCEEDED", "REFUNDED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

/** Public payment link for a custom package: the quote, then the receipt once paid. */
export default async function PayPage({ params, searchParams }: Props) {
  const { token } = await params;
  const sp = await searchParams;
  let order = await load(token);
  const lang =
    sp.lang === "ar" || sp.lang === "en"
      ? sp.lang
      : order?.user.locale === "ar"
        ? "ar"
        : "en";
  const ar = lang === "ar";
  const t = PAY_COPY[lang];
  const otherLang = `/pay/${token}?lang=${ar ? "en" : "ar"}`;

  let note: "notCompleted" | "processing" | null = null;
  if (order && order.status === "PENDING") {
    if (sp.checkout === "return") {
      const r = await confirmTapOrder(order);
      if (r === "success") order = await load(token);
      else note = r === "cancelled" ? "notCompleted" : "processing";
    } else if (sp.checkout === "success")
      note = "processing"; // waiting for the provider's webhook
    else if (sp.checkout === "cancelled") note = "notCompleted";
  }

  const shell = (children: React.ReactNode) => (
    <div
      dir={ar ? "rtl" : "ltr"}
      lang={lang}
      className="min-h-dvh bg-ivory bg-[radial-gradient(60%_40%_at_50%_0%,var(--color-bronze-100),transparent)] print:bg-white"
    >
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12 print:max-w-none print:p-0">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <Link href="/" aria-label="INVTRA">
            <Logo markClassName="h-8" />
          </Link>
          <Link
            href={otherLang}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-sand hover:text-ink"
            lang={ar ? "en" : "ar"}
          >
            {t.otherLanguage}
          </Link>
        </div>
        {children}
      </div>
    </div>
  );

  if (!order)
    return shell(
      <p className="rounded-2xl border border-line bg-paper px-6 py-10 text-center text-ink-soft">
        {t.notFound}
      </p>,
    );

  const locale = ar ? "ar" : "en";
  const amount = formatMoney(order.amount, order.currency, locale);
  const tz = order.event?.timezone ?? "Asia/Riyadh";

  if (order.status === "PAID" || order.status === "REFUNDED") {
    const receiptNumber =
      order.receiptNumber ?? (await ensureReceiptNumber(order.id)) ?? "—";
    const pay = order.payments[0];
    const raw = (pay?.raw ?? {}) as { method?: string | null };
    const data: ReceiptData = {
      receiptNumber,
      paidAt: order.paidAt ?? order.updatedAt,
      plan: order.plan,
      promo: order.promo,
      guestLimit: order.guestLimit,
      amount: order.amount,
      currency: order.currency,
      title: order.title,
      customer: {
        name: order.user.name,
        email: order.user.email,
        phone: order.user.phone,
      },
      event: order.event
        ? {
            title: order.event.title,
            titleAr: order.event.titleAr,
            timezone: tz,
          }
        : null,
      payment: pay
        ? {
            provider: pay.provider,
            reference: pay.providerPaymentId,
            method: raw.method ?? null,
          }
        : null,
      refunded: order.status === "REFUNDED",
    };
    return shell(
      <>
        {order.status === "PAID" ? (
          <div className="mb-6 rounded-2xl border border-sage/30 bg-sage-soft px-5 py-4 print:hidden">
            <p className="flex items-center gap-2 font-display text-xl text-ink">
              <Check className="size-5 text-sage" /> {t.paidTitle}
            </p>
            <p className="mt-1 text-[14px] text-ink-soft">{t.paidIntro}</p>
          </div>
        ) : null}
        <Receipt data={data} t={t} ar={ar} company={companyDetails()} />
        {order.eventId ? (
          <div className="mt-6 text-center print:hidden">
            <Link
              href={`/login?next=${encodeURIComponent(`/dashboard/events/${order.eventId}`)}`}
              className={buttonClasses("primary", "lg")}
            >
              {t.dashboard}
            </Link>
          </div>
        ) : null}
      </>,
    );
  }

  if (order.status !== "PENDING") {
    return shell(
      <p className="rounded-2xl border border-line bg-paper px-6 py-10 text-center leading-relaxed text-ink-soft">
        {t.cancelled}
      </p>,
    );
  }

  const ev = order.event;
  const test = env().PAYMENT_PROVIDER === "mock";
  return shell(
    <>
      {note === "processing" ? <AutoRefresh /> : null}
      <section className="overflow-hidden rounded-[1.75rem] border border-line bg-paper shadow-soft">
        {test ? (
          <p className="flex items-center justify-center gap-2 bg-ochre-soft px-4 py-2 text-center text-[12px] font-medium text-ochre">
            <FlaskConical className="size-3.5" /> {t.testMode}
          </p>
        ) : null}
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <p className="eyebrow rtl:text-[13px]">{t.metaTitle}</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-5 text-[15.5px] text-ink">
            {fmt(t.hello, { name: order.user.name })}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            {t.intro}
          </p>

          {note ? (
            <p
              className={cn(
                "mt-6 rounded-xl px-4 py-3 text-[14px]",
                note === "processing"
                  ? "bg-sand text-ink-soft"
                  : "bg-rosewood-soft text-rosewood",
              )}
              role="status"
            >
              {t[note]}
            </p>
          ) : null}

          <dl className="mt-8 divide-y divide-line rounded-2xl border border-line">
            {ev ? (
              <>
                <Row
                  icon={<Sparkles />}
                  label={t.event}
                  value={ar ? ev.titleAr || ev.title : ev.title}
                />
                <Row
                  icon={<CalendarDays />}
                  label={t.date}
                  value={`${formatDate(ev.startsAt, { locale, timeZone: tz, style: "full" })} · ${formatTime(ev.startsAt, { locale, timeZone: tz })}`}
                />
                <Row
                  icon={<MapPin />}
                  label={t.venue}
                  value={ar ? ev.venueNameAr || ev.venueName : ev.venueName}
                />
              </>
            ) : null}
            <Row
              icon={<Users />}
              label={t.package}
              value={`${t.customPlan} · ${guestsLabel(order.guestLimit, ar)}`}
            />
          </dl>

          {order.title ? (
            <div className="mt-6">
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink-faint rtl:tracking-normal">
                {t.included}
              </p>
              <p dir="auto" className={cn("mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft", ar ? "text-right" : "text-left")}>
                {order.title}
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex items-end justify-between gap-4 border-t border-line pt-6">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink-faint rtl:tracking-normal">
                {t.total}
              </p>
              <p className="text-[12px] text-ink-faint">{t.vat}</p>
            </div>
            <p className="font-display text-4xl text-ink tabular-nums">
              {amount}
            </p>
          </div>
          {order.dueAt ? (
            <p className="mt-3 text-[13px] text-ink-soft">
              {fmt(t.due, {
                date: formatDate(order.dueAt, {
                  locale,
                  timeZone: tz,
                  style: "long",
                }),
              })}
            </p>
          ) : null}

          <div className="mt-8">
            <PayButton
              token={token}
              lang={lang}
              label={fmt(test ? t.payTest : t.pay, { amount })}
              redirecting={t.redirecting}
              errorText={t.notCompleted}
            />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[12px] font-medium text-ink-soft">
                {t.secure}
              </span>
              {METHODS.map((m) => (
                <span
                  key={m}
                  lang="en"
                  className="rounded-md border border-line bg-paper px-2 py-0.5 text-[11.5px] font-medium text-ink-soft"
                >
                  {m}
                </span>
              ))}
            </div>
            <p className="mt-3 text-center text-[12px] text-ink-faint">
              {t.agree}{" "}
              <Link
                href={localePath(lang, "/terms")}
                target="_blank"
                className="underline underline-offset-2 hover:text-ink"
              >
                {t.terms}
              </Link>{" "}
              {t.and}{" "}
              <Link
                href={`${localePath(lang, "/terms")}#refunds`}
                target="_blank"
                className="underline underline-offset-2 hover:text-ink"
              >
                {t.refunds}
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
      <p className="mt-6 text-center text-[12.5px] text-ink-faint">
        {t.contact}
      </p>
    </>,
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-bronze-500">
      {icon}
      <dt className="w-24 shrink-0 text-[13px] text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-[14.5px] text-ink">{value}</dd>
    </div>
  );
}
