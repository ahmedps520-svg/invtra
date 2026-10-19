import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { guestPagesOrOverview, ownerEventOrList } from "@/app/dashboard/_lib/access";
import { checkinDashboard } from "@/server/door/dashboard";
import { CheckinDashboard } from "@/components/dashboard/checkin/checkin-dashboard";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.door.checkin.meta };
}

/** The night itself: arrivals, the guest list at the door, and every scan as it happens. */
export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/checkin`);
  const event = await ownerEventOrList(user.id, id);
  guestPagesOrOverview(event);
  const { locale } = await getI18n();
  const data = await checkinDashboard(event);
  return (
    <CheckinDashboard
      eventId={event.id}
      eventTitle={locale === "ar" && event.titleAr ? event.titleAr : event.title}
      timeZone={event.timezone}
      initial={JSON.parse(JSON.stringify(data))}
    />
  );
}
