import type { JobStatus } from "@prisma/client";
import { db } from "@/server/db";

const DAY = 86_400_000;

function utcDayKeys(days: number, now = new Date()): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10));
}

/** Everything on /admin, gathered in parallel. */
export async function getOverview(now = new Date()) {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const chartStart = new Date(Date.parse(utcDayKeys(14, now)[0] + "T00:00:00Z"));

  const [
    customers,
    customers7d,
    events,
    upcoming,
    deactivatedEvents,
    guests,
    sent24h,
    sent7d,
    sent30d,
    failed7d,
    messaged,
    accepted,
    declined,
    views,
    views7d,
    scans,
    scans7d,
    revenue,
    revenue30d,
    pendingOrders,
    jobCounts,
    oldestPending,
    failedJobs,
    unresolvedErrors,
    latestErrors,
    sentByDay,
    acceptedByDay,
  ] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: ago(7 * DAY) } } }),
    db.event.count({ where: { deletedAt: null } }),
    db.event.count({ where: { deletedAt: null, deactivatedAt: null, startsAt: { gt: now } } }),
    db.event.count({ where: { deletedAt: null, deactivatedAt: { not: null } } }),
    db.guest.count({ where: { isTest: false, event: { deletedAt: null } } }),
    db.whatsAppMessage.count({ where: { direction: "OUTBOUND", sentAt: { gte: ago(DAY) } } }),
    db.whatsAppMessage.count({ where: { direction: "OUTBOUND", sentAt: { gte: ago(7 * DAY) } } }),
    db.whatsAppMessage.count({ where: { direction: "OUTBOUND", sentAt: { gte: ago(30 * DAY) } } }),
    db.whatsAppMessage.count({ where: { direction: "OUTBOUND", status: "FAILED", createdAt: { gte: ago(7 * DAY) } } }),
    db.guest.count({ where: { isTest: false, requestSentAt: { not: null } } }),
    db.guest.count({ where: { isTest: false, rsvpStatus: "ACCEPTED" } }),
    db.guest.count({ where: { isTest: false, rsvpStatus: "DECLINED" } }),
    db.invitationView.count(),
    db.invitationView.count({ where: { createdAt: { gte: ago(7 * DAY) } } }),
    db.qRScan.count(),
    db.qRScan.count({ where: { createdAt: { gte: ago(7 * DAY) } } }),
    db.order.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
    db.order.groupBy({ by: ["currency"], where: { status: "PAID", paidAt: { gte: ago(30 * DAY) } }, _sum: { amount: true }, _count: { _all: true } }),
    db.order.count({ where: { status: "PENDING" } }),
    db.job.groupBy({ by: ["status"], _count: { _all: true } }),
    db.job.findFirst({ where: { status: "PENDING", runAt: { lte: now } }, orderBy: { runAt: "asc" }, select: { runAt: true, type: true } }),
    db.job.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 6 }),
    db.errorLog.count({ where: { resolvedAt: null } }),
    db.errorLog.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.$queryRaw<{ d: string; c: number }[]>`
      SELECT to_char("sentAt", 'YYYY-MM-DD') AS d, count(*)::int AS c
      FROM "WhatsAppMessage"
      WHERE "direction" = 'OUTBOUND'::"MessageDirection" AND "sentAt" >= ${chartStart}
      GROUP BY 1`,
    db.$queryRaw<{ d: string; c: number }[]>`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS d, count(*)::int AS c
      FROM "Rsvp"
      WHERE "response" = 'ACCEPTED'::"RsvpStatus" AND "createdAt" >= ${chartStart}
      GROUP BY 1`,
  ]);

  const jobs: Record<JobStatus, number> = { PENDING: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0 };
  for (const j of jobCounts) jobs[j.status] = j._count._all;

  const sentMap = new Map(sentByDay.map((r) => [r.d, Number(r.c)]));
  const accMap = new Map(acceptedByDay.map((r) => [r.d, Number(r.c)]));
  const chart = utcDayKeys(14, now).map((date) => ({ date, sent: sentMap.get(date) ?? 0, accepted: accMap.get(date) ?? 0 }));

  return {
    customers: { total: customers, new7d: customers7d },
    events: { total: events, upcoming, deactivated: deactivatedEvents },
    guests,
    messages: { sent24h, sent7d, sent30d, failed7d },
    rsvp: { messaged, accepted, declined, noResponse: Math.max(0, messaged - accepted - declined) },
    engagement: { views, views7d, scans, scans7d },
    revenue: revenue
      .map((r) => ({ currency: r.currency, amount: r._sum.amount ?? 0, orders: r._count._all }))
      .sort((a, b) => b.orders - a.orders),
    revenue30d: revenue30d.map((r) => ({ currency: r.currency, amount: r._sum.amount ?? 0, orders: r._count._all })),
    pendingOrders,
    queue: { counts: jobs, oldestPendingMs: oldestPending ? now.getTime() - oldestPending.runAt.getTime() : null, oldestPendingType: oldestPending?.type ?? null, failed: failedJobs },
    errors: { unresolved: unresolvedErrors, latest: latestErrors },
    chart,
  };
}

/** Counts shown as badges in the admin navigation. */
export async function getNavBadges() {
  const [errors, failedJobs, pendingOrders, pendingTemplates] = await Promise.all([
    db.errorLog.count({ where: { resolvedAt: null } }),
    db.job.count({ where: { status: "FAILED" } }),
    db.order.count({ where: { status: "PENDING", provider: "manual" } }),
    db.messageTemplate.count({ where: { status: "PENDING" } }),
  ]);
  return { errors, failedJobs, pendingOrders, pendingTemplates };
}
