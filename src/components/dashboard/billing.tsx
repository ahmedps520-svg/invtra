"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Receipt } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { plural } from "./i18n";
import { PlanCards, usePlans } from "./plan-picker";
import { stepHref } from "./steps";

type Order = {
  id: string;
  eventId: string | null;
  eventTitle: string | null;
  plan: "BASIC" | "PREMIUM" | "CUSTOM";
  guestLimit: number;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" | "FAILED";
  provider: string;
  createdAt: string;
  paidAt: string | null;
  instructions?: string;
};

const STATUS_TONE: Record<Order["status"], Tone> = { PENDING: "ochre", PAID: "sage", CANCELLED: "neutral", REFUNDED: "slate", FAILED: "rosewood" };

export function BillingPage({
  events,
  highlightOrder,
}: {
  events: { id: string; title: string; plan: "BASIC" | "PREMIUM" | "CUSTOM" | null; guestLimit: number; guests: number }[];
  highlightOrder: string | null;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.billing;
  const plans = usePlans();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersError, setOrdersError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    api<{ orders: Order[] }>("/api/billing/orders")
      .then((r) => {
        if (!alive) return;
        setOrders(r.orders);
        setOrdersError(false);
      })
      .catch(() => alive && setOrdersError(true));
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!highlightOrder || !orders) return;
    document.getElementById(`order-${highlightOrder}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightOrder, orders]);

  const date = (iso: string) => formatDate(new Date(iso), { locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, style: "medium" });

  return (
    <div className="animate-fade-up space-y-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl text-ink sm:text-5xl">{d.title}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{d.intro}</p>
      </div>

      <section aria-labelledby="plans-h">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <h2 id="plans-h" className="font-display text-3xl text-ink">
            {d.plans}
          </h2>
          <p className="text-[13px] text-ink-faint">{d.plansNote}</p>
        </div>
        {plans.data ? (
          <PlanCards plans={plans.data.plans} currency={plans.data.currency} />
        ) : plans.error ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-sm text-ink-soft">
            {d.loadError}
            <Button variant="outline" size="sm" onClick={plans.reload}>
              {dict.common.actions.retry}
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-72 rounded-2xl" />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="events-h">
        <Card>
          <CardHeader title={<span id="events-h">{d.yourEvents}</span>} />
          {events.length ? (
            <ul className="divide-y divide-line">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{e.title}</p>
                    <p className="mt-0.5 text-[13px] text-ink-faint">
                      {e.plan
                        ? `${dict.common.plans[e.plan]} · ${fmt(d.guestLimit, { n: formatNumber(e.guestLimit, locale) })}`
                        : dict.dashboard.header.noPlan}
                      {" · "}
                      {plural(locale, dict.dashboard.events.guests, e.guests)}
                    </p>
                  </div>
                  {e.plan !== "PREMIUM" && e.plan !== "CUSTOM" ? (
                    <Link
                      href={`${stepHref(e.id, "review")}#plan`}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bronze-700 hover:text-bronze-900"
                    >
                      {e.plan ? d.upgrade : d.choosePlan}
                      <ArrowRight className="size-3.5 rtl:rotate-180" />
                    </Link>
                  ) : (
                    <Badge tone="bronze">{dict.common.plans[e.plan]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-8 text-sm text-ink-faint">{d.noEvents}</p>
          )}
        </Card>
      </section>

      <section aria-labelledby="orders-h">
        <Card className="overflow-hidden">
          <CardHeader title={<span id="orders-h">{d.orders}</span>} />
          {orders === null ? (
            ordersError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-sm text-ink-soft">
                {d.loadError}
                <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
                  {dict.common.actions.retry}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 px-6 py-5">
                <div className="skeleton h-10 rounded-xl" />
                <div className="skeleton h-10 rounded-xl" />
              </div>
            )
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full border border-line bg-sand text-bronze-600">
                <Receipt className="size-5" />
              </span>
              <p className="mt-4 text-sm text-ink-faint">{d.ordersEmpty}</p>
            </div>
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-line bg-ivory/70 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                    <th className="px-6 py-3 text-start font-medium">{d.columns.date}</th>
                    <th className="px-3 py-3 text-start font-medium">{d.columns.event}</th>
                    <th className="px-3 py-3 text-start font-medium">{d.columns.plan}</th>
                    <th className="px-3 py-3 text-end font-medium">{d.columns.amount}</th>
                    <th className="px-6 py-3 text-end font-medium">{d.columns.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <OrderRows key={o.id} order={o} highlight={o.id === highlightOrder} date={date} />
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-line md:hidden">
                {orders.map((o) => (
                  <li key={o.id} id={`order-m-${o.id}`} className={cn("px-5 py-4", o.id === highlightOrder && "bg-bronze-50/70")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{o.eventTitle ?? d.deletedEvent}</p>
                        <p className="mt-0.5 text-[13px] text-ink-faint">
                          {date(o.createdAt)} · {dict.common.plans[o.plan]}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-medium text-ink tabular-nums">{formatMoney(o.amount, o.currency, locale)}</p>
                        <Badge tone={STATUS_TONE[o.status]} className="mt-1">
                          {d.status[o.status]}
                        </Badge>
                      </div>
                    </div>
                    {o.instructions ? <Instructions text={o.instructions} /> : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}

function OrderRows({ order: o, highlight, date }: { order: Order; highlight: boolean; date: (iso: string) => string }) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.billing;
  return (
    <>
      <tr id={`order-${o.id}`} className={cn("border-t border-line first:border-t-0", highlight && "bg-bronze-50/70")}>
        <td className="px-6 py-3.5 text-ink-soft">{date(o.createdAt)}</td>
        <td className="px-3 py-3.5">
          {o.eventId && o.eventTitle ? (
            <Link href={stepHref(o.eventId, "overview")} className="font-medium text-ink hover:text-bronze-700">
              {o.eventTitle}
            </Link>
          ) : (
            <span className="text-ink-faint">{o.eventTitle ?? d.deletedEvent}</span>
          )}
        </td>
        <td className="px-3 py-3.5 text-ink-soft">
          {dict.common.plans[o.plan]} · {fmt(d.guestLimit, { n: formatNumber(o.guestLimit, locale) })}
        </td>
        <td className="px-3 py-3.5 text-end font-medium text-ink tabular-nums">{formatMoney(o.amount, o.currency, locale)}</td>
        <td className="px-6 py-3.5 text-end">
          <Badge tone={STATUS_TONE[o.status]}>{d.status[o.status]}</Badge>
        </td>
      </tr>
      {o.instructions ? (
        <tr className={cn(highlight && "bg-bronze-50/70")}>
          <td colSpan={5} className="px-6 pb-4">
            <Instructions text={o.instructions} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Instructions({ text }: { text: string }) {
  const { dict } = useI18n();
  return (
    <div className="mt-2 rounded-xl border border-ochre/25 bg-ochre-soft/60 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ochre">{dict.dashboard.billing.instructions}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-ink-soft" dir="auto">
        {text}
      </p>
    </div>
  );
}
