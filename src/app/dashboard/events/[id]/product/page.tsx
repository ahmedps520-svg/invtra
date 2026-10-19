import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { ownerEventOrList } from "@/app/dashboard/_lib/access";
import { startingPrices } from "@/server/orders/pricing";
import { orderInReview } from "@/server/orders/service";
import { isUnlocked } from "@/server/render/preview";
import { ProductPicker } from "@/components/dashboard/wizard/product-picker";
import { formatMoney } from "@/lib/format";
import { PRODUCTS } from "@/lib/products";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.orders.steps.product };
}

/** Step 1 for an event that exists: change what's being ordered (until it's submitted). */
export default async function ProductStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/product`);
  const event = await ownerEventOrList(user.id, id);
  if (isUnlocked(event)) redirect(`/dashboard/events/${event.id}`);
  const [{ locale }, { currency, prices }, inReview] = await Promise.all([getI18n(), startingPrices(), orderInReview(event.id)]);
  return (
    <ProductPicker
      eventId={event.id}
      selected={event.product}
      locked={Boolean(inReview)}
      options={PRODUCTS.map((p) => ({ product: p, price: formatMoney(prices[p], currency, locale) }))}
    />
  );
}
