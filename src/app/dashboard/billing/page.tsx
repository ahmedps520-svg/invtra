import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { BillingPage } from "@/components/dashboard/billing";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.billing };
}

export default async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/dashboard/billing");
  const sp = await searchParams;
  const { locale } = await getI18n();
  const events = await db.event.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, titleAr: true, plan: true, guestLimit: true, _count: { select: { guests: { where: { isTest: false } } } } },
  });
  return (
    <BillingPage
      events={events.map((e) => ({
        id: e.id,
        title: locale === "ar" && e.titleAr ? e.titleAr : e.title,
        plan: e.plan,
        guestLimit: e.guestLimit,
        guests: e._count.guests,
      }))}
      highlightOrder={typeof sp.order === "string" ? sp.order : null}
    />
  );
}
