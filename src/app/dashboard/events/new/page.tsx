import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Product } from "@prisma/client";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { startingPrices } from "@/server/orders/pricing";
import { EventForm } from "@/components/dashboard/event-form";
import { ProductPicker } from "@/components/dashboard/wizard/product-picker";
import { ORDER_STEP_KEYS, ORDER_STEP_LABEL } from "@/components/dashboard/order-steps";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { isThemeKey } from "@/lib/themes/registry";
import { EVENT_TYPES } from "@/lib/events/types";
import { PRODUCTS, isProduct } from "@/lib/products";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.newEvent };
}

/** Steps 1 and 2 of the order wizard: choose the product, then fill in the details. */
export default async function NewEventPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const theme = typeof sp.theme === "string" && isThemeKey(sp.theme) ? sp.theme : null;
  // Occasion chosen on a marketing landing page (/invitations/newborn → ?occasion=NEWBORN).
  const occasion = EVENT_TYPES.find((t) => t === sp.occasion) ?? null;
  const product: Product | null = isProduct(sp.product) ? sp.product : null;
  const keep = { ...(theme ? { theme } : {}), ...(occasion ? { occasion } : {}) };
  const query = new URLSearchParams({ ...keep, ...(product ? { product } : {}) }).toString();
  await requireUser(`/dashboard/events/new${query ? `?${query}` : ""}`);
  const { dict, locale } = await getI18n();
  const d = dict.dashboard;
  const current = product ? 1 : 0;
  const steps = ORDER_STEP_KEYS.filter((k) => !(product === "PHOTO_ONLY" && k === "features"));

  let picker: React.ReactNode = null;
  if (!product) {
    const { currency, prices } = await startingPrices();
    const href = (p: Product) => `/dashboard/events/new?${new URLSearchParams({ ...keep, product: p }).toString()}`;
    picker = (
      <ProductPicker
        options={PRODUCTS.map((p) => ({ product: p, price: formatMoney(prices[p], currency, locale) }))}
        createHref={{ INVITATION: href("INVITATION"), CUSTOM_DESIGN: href("CUSTOM_DESIGN"), PHOTO_ONLY: href("PHOTO_ONLY") }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={product ? `/dashboard/events/new${Object.keys(keep).length ? `?${new URLSearchParams(keep).toString()}` : ""}` : "/dashboard"}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition hover:text-ink">
        <ArrowLeft className="size-3.5 rtl:rotate-180" />
        {product ? d.orders.productStep.change : d.header.back}
      </Link>
      <ol className="mb-10 mt-6 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={d.orders.steps.label}>
        {steps.map((k, i) => (
          <li key={k} className="flex items-center gap-3">
            {i > 0 ? <span className="h-px w-5 bg-line" aria-hidden /> : null}
            <span className={cn("flex items-center gap-2 text-[13px]", i === current ? "font-medium text-ink" : "text-ink-faint")} aria-current={i === current ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[12px]",
                  i === current ? "bg-ink text-ivory" : i < current ? "bg-bronze-600 text-white" : "border border-line-strong bg-paper",
                )}
              >
                {i + 1}
              </span>
              {d.orders.steps[ORDER_STEP_LABEL[k]]}
            </span>
          </li>
        ))}
      </ol>
      {product ? <EventForm mode="create" themeKey={theme} occasion={occasion} product={product} /> : picker}
    </div>
  );
}
