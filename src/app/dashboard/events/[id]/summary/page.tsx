import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { ownerEventOrList } from "@/app/dashboard/_lib/access";
import { cardView } from "@/server/events/preview";
import { currentOrder, orderGaps, orderInReview, prepareOrder } from "@/server/orders/service";
import { quoteFor, type OrderLine } from "@/server/orders/pricing";
import { isUnlocked } from "@/server/render/preview";
import { OrderSummary, type SummaryRow } from "@/components/dashboard/wizard/order-summary";
import { themeName } from "@/components/dashboard/i18n";
import { whenLabel } from "@/lib/event-when";
import { fmt } from "@/lib/i18n/config";
import { PLANS } from "@/lib/plans";
import { readFeatures } from "@/lib/products";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.orders.review.title };
}

/** Step 5: review the order, the protected preview and the price. */
export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/summary`);
  const event = await ownerEventOrList(user.id, id);
  if (isUnlocked(event)) redirect(`/dashboard/events/${event.id}`);
  const { dict, locale } = await getI18n();
  const d = dict.dashboard.orders;
  const r = d.review.rows;
  const ar = locale === "ar";
  const base = `/dashboard/events/${event.id}`;

  const [inReview, draft, quote, refs] = await Promise.all([
    orderInReview(event.id),
    currentOrder(event.id),
    quoteFor(event),
    db.upload.count({ where: { eventId: event.id, kind: "REFERENCE" } }),
  ]);
  // An existing draft is brought up to date (the design or features may have changed since).
  const order = inReview ?? (draft && (draft.stage === "DRAFT" || draft.stage === "REJECTED") ? await prepareOrder(user, event) : null);
  const code = order?.promoCodeId ? ((await db.promoCode.findUnique({ where: { id: order.promoCodeId }, select: { code: true } }))?.code ?? null) : null;
  const lines = (order?.lines as OrderLine[] | null) ?? quote.lines;
  const features = readFeatures(event.features);
  const editable = !inReview;

  const design =
    event.designSource === "REQUEST"
      ? d.designSource.REQUEST.title
      : event.designSource === "UPLOAD"
        ? d.designSource.UPLOAD.title
        : `${d.designSource.TEMPLATE.title} · ${themeName(dict, event.themeKey)}`;
  const rows: SummaryRow[] = [
    { label: r.product, value: d.products[event.product], href: editable ? `${base}/product` : undefined },
    { label: r.event, value: (ar && event.titleAr) || event.title, href: editable ? `${base}/details` : undefined },
    { label: r.when, value: whenLabel(event, locale) },
    ...(event.venueName ? [{ label: r.venue, value: (ar && event.venueNameAr) || event.venueName }] : []),
    { label: r.design, value: design, href: editable ? `${base}/design` : undefined },
    ...(event.designSource === "REQUEST" && event.designBrief ? [{ label: r.brief, value: event.designBrief }] : []),
    ...(event.designSource === "REQUEST" && refs ? [{ label: r.references, value: String(refs) }] : []),
  ];
  if (event.product !== "PHOTO_ONLY") {
    rows.push(
      { label: r.qr, value: d.review.qr[features.qr], href: editable ? `${base}/features` : undefined },
      { label: r.whatsapp, value: features.whatsapp ? d.review.yes : d.review.no },
      {
        label: r.package,
        value:
          quote.plan === "CUSTOM"
            ? fmt(d.features.package.customGuests, { count: quote.guestLimit })
            : `${dict.common.plans[quote.plan ?? "BASIC"]} · ${fmt(d.features.package.guests, { count: PLANS[quote.plan ?? "BASIC"].guestLimit ?? quote.guestLimit })}`,
      },
    );
  }

  return (
    <OrderSummary
      eventId={event.id}
      rows={rows}
      preview={event.designSource === "REQUEST" ? null : await cardView(event)}
      lines={lines}
      currency={order?.currency ?? quote.currency}
      code={code}
      gaps={orderGaps(event)}
      inReviewHref={inReview ? `/dashboard/orders/${inReview.id}` : null}
    />
  );
}
