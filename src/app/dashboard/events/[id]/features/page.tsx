import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { ownerEventOrList } from "@/app/dashboard/_lib/access";
import { orderInReview } from "@/server/orders/service";
import { productPrices, requiredTier } from "@/server/orders/pricing";
import { isUnlocked } from "@/server/render/preview";
import { FeaturesForm } from "@/components/dashboard/wizard/features-form";
import { countryForTimezone } from "@/lib/timezone-country";
import { formatMoney } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { readFeatures } from "@/lib/products";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.orders.features.title };
}

/** Step 4: optional features (skipped for Photo only). */
export default async function FeaturesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/features`);
  const event = await ownerEventOrList(user.id, id);
  if (event.product === "PHOTO_ONLY") redirect(`/dashboard/events/${event.id}/summary`);
  const { locale } = await getI18n();
  const [inReview, prices, account] = await Promise.all([
    orderInReview(event.id),
    productPrices(),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, phone: true, whatsappUpdatesAt: true } }),
  ]);
  const currency = env().PAYMENT_CURRENCY;
  const features = readFeatures(event.features);
  const paid = isUnlocked(event);
  return (
    <FeaturesForm
      eventId={event.id}
      product={event.product}
      initial={features}
      email={account.email}
      whatsappMode={env().WHATSAPP_PROVIDER === "cloud" ? "business" : "own"}
      updates={{ available: env().WHATSAPP_PROVIDER !== "off", enabled: Boolean(account.whatsappUpdatesAt), phone: account.phone ?? "" }}
      tiers={(["BASIC", "PREMIUM"] as const).map((tier) => ({
        tier,
        guests: PLANS[tier].guestLimit ?? 0,
        price: formatMoney(PLANS[tier].prices?.[currency] ?? 0, currency, locale),
      }))}
      premiumRequired={requiredTier(event, "BASIC") === "PREMIUM"}
      customGuests={prices.customDesignGuests}
      locked={Boolean(inReview) || paid}
      nextHref={paid ? `/dashboard/events/${event.id}` : `/dashboard/events/${event.id}/summary`}
      country={countryForTimezone(event.timezone)}
    />
  );
}
