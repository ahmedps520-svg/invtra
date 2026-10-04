import { notFound } from "next/navigation";
import type { GuestStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { findOwnedEvent } from "@/server/events/access";
import { defaultCountryFor } from "@/server/guests/service";
import { invitationUrl } from "@/server/invitations";
import { sectionCounts } from "@/server/guests/sections";
import { GuestsManager } from "@/components/dashboard/guests/guests-manager";
import { GUEST_STATUSES, type GuestList, type GuestStatusKey } from "@/components/dashboard/guests/types";

export async function generateMetadata() {
  const { dict } = await getI18n();
  return { title: dict.dashboard.meta.guests };
}

export default async function GuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/dashboard/events/${id}/guests`);
  const event = await findOwnedEvent(user.id, id);
  if (!event) notFound();

  const raw = typeof sp.status === "string" ? sp.status : null;
  const status = raw && (GUEST_STATUSES as readonly string[]).includes(raw) ? (raw as GuestStatusKey) : null;
  const where = { eventId: event.id, isTest: false, ...(status ? { status: status as GuestStatus } : {}) };
  const [total, guests, counts, bySection] = await Promise.all([
    db.guest.count({ where }),
    db.guest.findMany({ where, orderBy: { createdAt: "asc" }, take: 50, include: { invitation: { select: { token: true } } } }),
    db.guest.groupBy({ by: ["status"], where: { eventId: event.id, isTest: false }, _count: true }),
    db.guest.groupBy({ by: ["section"], where: { eventId: event.id, isTest: false }, _count: true }),
  ]);
  const initial = JSON.parse(
    JSON.stringify({
      total,
      page: 1,
      pageSize: 50,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
      sectionCounts: sectionCounts(bySection),
      guests: guests.map(({ invitation, ...g }) => ({ ...g, invitationUrl: invitation ? invitationUrl(invitation.token) : null })),
    }),
  ) as GuestList;

  return (
    <GuestsManager
      eventId={event.id}
      eventLanguage={event.language}
      sectionsEnabled={event.sectionsEnabled}
      defaultCountry={defaultCountryFor(event.timezone)}
      initial={initial}
      initialStatus={status}
      // eslint-disable-next-line react-hooks/purity -- request time for relative timestamps
      serverNow={Date.now()}
    />
  );
}
