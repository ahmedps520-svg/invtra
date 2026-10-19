import { notFound } from "next/navigation";
import { guestPagesOrOverview } from "@/app/dashboard/_lib/access";
import type { GuestStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getI18n } from "@/server/i18n";
import { coHostViews, findGuestAccess, MAX_COHOSTS } from "@/server/events/cohosts";
import { defaultCountryFor } from "@/server/guests/service";
import { invitationUrl } from "@/server/invitations";
import { sectionCounts } from "@/server/guests/sections";
import { GuestsManager } from "@/components/dashboard/guests/guests-manager";
import { CoHostsPanel } from "@/components/dashboard/guests/cohosts-panel";
import { CoHostNote } from "@/components/dashboard/guests/cohost-note";
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
  // The owner sees every list; a co-host only their own.
  const access = await findGuestAccess(user, id);
  if (!access) notFound();
  guestPagesOrOverview(access.event);
  const { event, coHost, scope } = access;

  const raw = typeof sp.status === "string" ? sp.status : null;
  const status = raw && (GUEST_STATUSES as readonly string[]).includes(raw) ? (raw as GuestStatusKey) : null;
  const base = { eventId: event.id, isTest: false, ...scope };
  const where = { ...base, ...(status ? { status: status as GuestStatus } : {}) };
  const [total, guests, counts, bySection, coHosts, owner] = await Promise.all([
    db.guest.count({ where }),
    db.guest.findMany({ where, orderBy: { createdAt: "asc" }, take: 50, include: { invitation: { select: { token: true } } } }),
    db.guest.groupBy({ by: ["status"], where: base, _count: true }),
    db.guest.groupBy({ by: ["section"], where: base, _count: true }),
    coHost ? null : coHostViews(event.id),
    coHost ? db.user.findUnique({ where: { id: event.userId }, select: { name: true, email: true } }) : null,
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
  const listed = counts.reduce((n, c) => n + c._count, 0);

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
      lists={coHosts?.length ? coHosts.map((c) => ({ id: c.id, label: c.label })) : undefined}
      coHost={Boolean(coHost)}
      aside={
        coHost ? (
          <CoHostNote label={coHost.label} owner={owner?.name || owner?.email || ""} count={listed} limit={coHost.guestLimit} />
        ) : (
          <CoHostsPanel
            eventId={event.id}
            initial={coHosts ?? []}
            ownCount={listed - (coHosts ?? []).reduce((n, c) => n + c.guests, 0)}
            max={MAX_COHOSTS}
          />
        )
      }
    />
  );
}
