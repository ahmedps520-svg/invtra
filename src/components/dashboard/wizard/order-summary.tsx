"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, PenTool, ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { EventCard } from "@/components/invitation/event-card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import type { CardView } from "@/lib/card/view";
import type { OrderGap } from "@/server/orders/service";
import type { LineKey } from "@/server/orders/pricing";
import { errorMessage } from "../i18n";

export type SummaryRow = { label: string; value: string; href?: string };
type Line = { key: LineKey; amount: number };

/** Step 5: everything the customer chose, the protected preview and the price. */
export function OrderSummary({
  eventId,
  rows,
  preview,
  lines: initialLines,
  currency,
  code: initialCode,
  gaps,
  inReviewHref,
}: {
  eventId: string;
  rows: SummaryRow[];
  /** null: a custom design that INVTRA's designers make after payment. */
  preview: CardView | null;
  lines: Line[];
  currency: string;
  code: string | null;
  gaps: OrderGap[];
  /** The order is already with staff: link to it instead of paying again. */
  inReviewHref: string | null;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.orders.review;
  const router = useRouter();
  const toast = useToast();
  const [lines, setLines] = useState(initialLines);
  const [code, setCode] = useState(initialCode ?? "");
  const [applied, setApplied] = useState(initialCode);
  const [busy, setBusy] = useState<"code" | "continue" | null>(null);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const money = (n: number) => formatMoney(n, currency, locale);

  async function prepare(nextCode: string | null | undefined) {
    const res = await api<{ order: { lines: Line[] } }>(`/api/events/${eventId}/order`, {
      method: "POST",
      body: nextCode === undefined ? {} : { code: nextCode },
    });
    setLines(res.order.lines);
  }

  async function applyCode(value: string | null) {
    setBusy("code");
    try {
      await prepare(value);
      setApplied(value);
      if (!value) setCode("");
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(null);
    }
  }

  async function next() {
    setBusy("continue");
    try {
      await prepare(undefined);
      router.push(`/dashboard/events/${eventId}/payment`);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
      setBusy(null);
    }
  }

  return (
    <div className="animate-fade-up space-y-8 pb-6">
      <div className="max-w-2xl">
        <p className="eyebrow">{d.eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{d.title}</h2>
        <p className="mt-2 text-[15px] text-ink-soft">{d.intro}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <dl className="divide-y divide-line">
              {rows.map((r) => (
                <div key={r.label} className="grid gap-1 px-6 py-4 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4 sm:px-8">
                  <dt className="text-[13px] text-ink-faint">{r.label}</dt>
                  <dd className="min-w-0 whitespace-pre-line break-words text-[15px] text-ink">{r.value}</dd>
                  {r.href ? (
                    <Link href={r.href} className="text-[13px] font-medium text-bronze-700 hover:text-bronze-900">
                      {d.edit}
                    </Link>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-6 sm:p-8">
            <h3 className="font-display text-2xl text-ink">{d.price}</h3>
            <dl className="mt-4 space-y-2.5 text-[15px]">
              {lines.map((l) => (
                <div key={l.key} className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">{d.lines[l.key]}</dt>
                  <dd className={l.amount < 0 ? "text-sage" : "text-ink"}>{money(l.amount)}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <dt className="font-medium text-ink">{d.total}</dt>
                <dd className="font-display text-2xl text-ink" data-testid="order-total">
                  {money(total)}
                </dd>
              </div>
              <p className="text-end text-[12px] text-ink-faint">{d.vat}</p>
            </dl>
            {inReviewHref ? null : (
              <form
                className="mt-5 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.trim()) applyCode(code.trim());
                }}
              >
                <label htmlFor="order-code" className="sr-only">
                  {d.code}
                </label>
                <Input
                  id="order-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={d.codePlaceholder}
                  className="max-w-[12rem] uppercase"
                />
                <Button type="submit" variant="outline" size="sm" loading={busy === "code"} disabled={!code.trim() || code.trim().toUpperCase() === applied}>
                  {d.apply}
                </Button>
                {applied ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => applyCode(null)}>
                    {d.removeCode}
                  </Button>
                ) : null}
              </form>
            )}
          </Card>
        </div>

        <Card className="p-5 sm:p-6">
          <p className="eyebrow">{d.preview}</p>
          <div className="paper-grain mt-4 flex justify-center rounded-2xl bg-sand/70 p-4">
            {preview ? (
              <EventCard view={preview} title={d.preview} qrPlaceholder className="w-full max-w-[300px] rounded-[3px] shadow-lift" />
            ) : (
              <div className="flex aspect-[4/5] w-full max-w-[300px] flex-col items-center justify-center gap-3 rounded-[3px] border border-dashed border-line-strong bg-paper px-6 text-center">
                <PenTool className="size-6 text-bronze-600" />
                <p className="text-[13px] leading-relaxed text-ink-soft">{d.requestPlaceholder}</p>
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{d.previewBadge}</p>
          <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-sage" />
            {d.previewNote}
          </p>
        </Card>
      </div>

      {gaps.length ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-ochre/30 bg-ochre-soft px-5 py-4 text-sm text-ink">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-ochre" />
          <div>
            <p className="font-medium">{d.fix}</p>
            <ul className="mt-1 list-disc ps-5 text-ink-soft">
              {gaps.map((g) => (
                <li key={g}>
                  <Link href={`/dashboard/events/${eventId}/design`} className="underline underline-offset-2">
                    {d.gaps[g]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        {inReviewHref ? (
          <Link href={inReviewHref} className={buttonClasses("primary", "lg")}>
            {dict.dashboard.orders.done.view}
          </Link>
        ) : (
          <Button size="lg" loading={busy === "continue"} disabled={gaps.length > 0} onClick={next}>
            {d.continue}
          </Button>
        )}
      </div>
    </div>
  );
}
