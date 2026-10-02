import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { paging, type SearchParams, str } from "./params";

const DAY = 86_400_000;

/** QR scans and invitation-page views across all events (optionally one event). */
export async function getScanOverview(sp: SearchParams, now = new Date()) {
  const eventId = str(sp, "event", 40) || undefined;
  const { page, pageSize, skip, take } = paging(sp);
  const scanWhere: Prisma.QRScanWhereInput = eventId ? { eventId } : {};
  const viewWhere: Prisma.InvitationViewWhereInput = eventId ? { eventId } : {};
  const weekAgo = new Date(now.getTime() - 7 * DAY);

  const [
    scans,
    scans7d,
    hostScans,
    scannedInvitations,
    views,
    views7d,
    viewsBySource,
    viewsByDevice,
    viewedInvitations,
    recent,
    topScanned,
    topViewedEvents,
    event,
  ] = await Promise.all([
    db.qRScan.count({ where: scanWhere }),
    db.qRScan.count({ where: { ...scanWhere, createdAt: { gte: weekAgo } } }),
    db.qRScan.count({ where: { ...scanWhere, byHost: true } }),
    db.qRScan.groupBy({ by: ["invitationId"], where: scanWhere }).then((r) => r.length),
    db.invitationView.count({ where: viewWhere }),
    db.invitationView.count({ where: { ...viewWhere, createdAt: { gte: weekAgo } } }),
    db.invitationView.groupBy({ by: ["source"], where: viewWhere, _count: { _all: true } }),
    db.invitationView.groupBy({ by: ["device"], where: viewWhere, _count: { _all: true } }),
    db.invitationView.groupBy({ by: ["invitationId"], where: viewWhere }).then((r) => r.length),
    db.qRScan.findMany({
      where: scanWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { event: { select: { id: true, title: true, timezone: true } }, invitation: { select: { token: true, guest: { select: { id: true, name: true, allowedCount: true, checkedInAt: true } } } } },
    }),
    db.qRScan.groupBy({ by: ["invitationId"], where: scanWhere, _count: { _all: true }, orderBy: { _count: { invitationId: "desc" } }, take: 8 }),
    eventId ? Promise.resolve([]) : db.invitationView.groupBy({ by: ["eventId"], _count: { _all: true }, orderBy: { _count: { eventId: "desc" } }, take: 6 }),
    eventId ? db.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } }) : null,
  ]);

  const invs = await db.invitation.findMany({
    where: { id: { in: topScanned.map((t) => t.invitationId) } },
    select: { id: true, token: true, guest: { select: { name: true, scanCount: true, checkedInAt: true } }, event: { select: { id: true, title: true } } },
  });
  const invMap = new Map(invs.map((i) => [i.id, i]));
  const evs = topViewedEvents.length
    ? await db.event.findMany({ where: { id: { in: topViewedEvents.map((t) => t.eventId) } }, select: { id: true, title: true } })
    : [];
  const evMap = new Map(evs.map((e) => [e.id, e]));

  return {
    event,
    totals: { scans, scans7d, hostScans, guestScans: scans - hostScans, scannedInvitations, views, views7d, viewedInvitations },
    viewsBySource: Object.fromEntries(viewsBySource.map((v) => [v.source, v._count._all])) as Record<string, number>,
    viewsByDevice: Object.fromEntries(viewsByDevice.map((v) => [v.device ?? "unknown", v._count._all])) as Record<string, number>,
    recent: { rows: recent, total: scans, page, pageSize },
    topScanned: topScanned.map((t) => ({ count: t._count._all, invitation: invMap.get(t.invitationId) ?? null, invitationId: t.invitationId })),
    topViewedEvents: topViewedEvents.map((t) => ({ count: t._count._all, event: evMap.get(t.eventId) ?? null, eventId: t.eventId })),
  };
}
