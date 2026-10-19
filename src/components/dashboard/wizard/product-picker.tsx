"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Gift, Image as ImageIcon, PenTool } from "lucide-react";
import type { Product } from "@prisma/client";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { errorMessage } from "../i18n";

const ICONS: Record<Product, React.ReactNode> = {
  INVITATION: <Gift className="size-5" />,
  CUSTOM_DESIGN: <PenTool className="size-5" />,
  PHOTO_ONLY: <ImageIcon className="size-5" />,
};

/**
 * Step 1: what the customer wants to buy. Creating: each card links on to the details form.
 * Changing an existing event: saves the choice and continues to the details.
 */
export function ProductPicker({
  options,
  selected,
  eventId,
  createHref,
  locked,
}: {
  options: { product: Product; price: string }[];
  selected?: Product | null;
  /** Changing the product of an existing event (otherwise creating one). */
  eventId?: string;
  /** For creating: the details form's URL for a product. */
  createHref?: Record<Product, string>;
  /** An order is with staff: the product can't change. */
  locked?: boolean;
}) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders;
  const router = useRouter();
  const toast = useToast();
  const [choice, setChoice] = useState<Product | null>(selected ?? null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!eventId || !choice) return;
    if (choice === selected) return router.push(`/dashboard/events/${eventId}/details`);
    setSaving(true);
    try {
      await api(`/api/events/${eventId}/setup`, { method: "PATCH", body: { product: choice } });
      router.push(`/dashboard/events/${eventId}/details`);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="max-w-2xl">
        <p className="eyebrow">{d.productStep.eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{d.productStep.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{d.productStep.intro}</p>
      </div>
      {locked ? <p className="mt-6 rounded-2xl border border-line bg-sand/70 px-5 py-4 text-sm text-ink-soft">{d.productStep.locked}</p> : null}
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {options.map(({ product, price }) => {
          const o = d.productStep.options[product];
          const active = choice === product;
          const body = (
            <>
              <span className="flex items-center justify-between gap-3">
                <span className={cn("flex size-11 items-center justify-center rounded-full", active ? "bg-ink text-ivory" : "bg-sand text-bronze-700")}>
                  {ICONS[product]}
                </span>
                {active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-bronze-600 px-2.5 py-1 text-[12px] font-medium text-white">
                    <Check className="size-3.5" strokeWidth={2.5} />
                    {d.productStep.chosen}
                  </span>
                ) : null}
              </span>
              <span className="mt-5 block font-display text-2xl text-ink">{d.products[product]}</span>
              <span className="mt-1 block text-sm font-medium text-bronze-700">{fmt(d.productStep.from, { price })}</span>
              <span className="mt-3 block text-[14px] leading-relaxed text-ink-soft">{o.description}</span>
              <ul className="mt-4 space-y-2 text-[13px] text-ink-soft">
                {o.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-sage" strokeWidth={2.5} />
                    {p}
                  </li>
                ))}
              </ul>
            </>
          );
          const cls = cn(
            "flex h-full w-full flex-col rounded-3xl border bg-paper p-6 text-start shadow-soft transition-all duration-300 ease-luxe",
            active ? "border-bronze-500 ring-2 ring-bronze-400/40" : "border-line hover:-translate-y-0.5 hover:border-bronze-300 hover:shadow-lift",
            locked && "pointer-events-none opacity-60",
          );
          return (
            <li key={product}>
              {createHref ? (
                <Link href={createHref[product]} className={cls} data-product={product}>
                  {body}
                  <span className="mt-6 inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-ivory">
                    {d.productStep.choose}
                  </span>
                </Link>
              ) : (
                <button type="button" onClick={() => setChoice(product)} aria-pressed={active} className={cls} disabled={locked} data-product={product}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {eventId ? (
        <div className="mt-8 flex justify-end">
          <Button size="lg" loading={saving} disabled={!choice || locked} onClick={save}>
            {d.productStep.continue}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
