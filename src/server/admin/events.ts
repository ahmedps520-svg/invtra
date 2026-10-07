import type { PlanTier, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, conflict, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { cancelPendingJobs } from "@/server/queue/queue";
import { cancelBatch } from "@/server/sending/batch";
import { grantPlan } from "@/server/payments/service";
import { THEME_KEYS } from "@/lib/themes/registry";
import { paging, type SearchParams, oneOf, str } from "./params";
import { walletChanged } from "@/server/apple/push";

export const EVENT_FILTERS = ["upcoming", "past", "deactivated", "deleted"] as const;
export type EventFilter = (typeof EVENT_FILTERS)[number];

/** Prefix on Event.deactivatedReason when the owner's account was deactivated with its events. */
export const ACCOUNT_DEACTIVATION_PREFIX = "Account deactivated: ";

export async function listEvents(sp: SearchParams) {
  const q = str(sp, "q");
  const filter = oneOf(sp, "filter", EVENT_FILTERS);
  const plan = oneOf(sp, "plan", ["BASIC", "PREMIUM", "CUSTOM", "NONE"] as const);
  const theme = oneOf(sp, "theme", THEME_KEYS);
  const { page, pageSize, skip, take } = paging(sp);
  const now = new Date();

  const where: Prisma.EventWhereInput = {
    ...(filter === "deleted" ? { deletedAt: { not: null } } : { deletedAt: null }),
    ...(filter === "upcoming" ? { startsAt: { gt: now }, deactivatedAt: null } : {}),
    ...(filter === "past" ? { startsAt: { lte: now } } : {}),
    ...(filter === "deactivated" ? { deactivatedAt: { not: null } } : {}),
    ...(plan ? { plan: plan === "NONE" ? null : plan } : {}),
    ...(theme ? { themeKey: theme } : {}),
    ...(q
      ? {
          OR: [
            { id: q },
            { title: { contains: q, mode: "insensitive" } },
            { titleAr: { contains: q, mode: "insensitive" } },
            { hostNames: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, events] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where,
      orderBy: filter === "past" || filter === "deleted" ? { startsAt: "desc" } : filter === "upcoming" ? { startsAt: "asc" } : { createdAt: "desc" },
      skip,
      take,
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
    }),
  ]);
  const stats = await guestStats(events.map((e) => e.id));
  return { total, page, pageSize, rows: events.map((e) => ({ ...e, stats: stats.get(e.id) ?? emptyStats() })), filter, q, plan };
}

export type GuestStats = { total: number; accepted: number; declined: number; pending: number; sent: number; failed: number };
const emptyStats = (): GuestStats => ({ total: 0, accepted: 0, declined: 0, pending: 0, sent: 0, failed: 0 });

export async function guestStats(eventIds: string[]): Promise<Map<string, GuestStats>> {
  const map = new Map<string, GuestStats>();
  if (!eventIds.length) return map;
  const [byRsvp, sent, failed] = await Promise.all([
    db.guest.groupBy({ by: ["eventId", "rsvpStatus"], where: { eventId: { in: eventIds }, isTest: false }, _count: { _all: true } }),
    db.guest.groupBy({ by: ["eventId"], where: { eventId: { in: eventIds }, isTest: false, requestSentAt: { not: null } }, _count: { _all: true } }),
    db.guest.groupBy({ by: ["eventId"], where: { eventId: { in: eventIds }, isTest: false, deliveryStatus: "FAILED" }, _count: { _all: true } }),
  ]);
  const get = (id: string) => map.get(id) ?? (map.set(id, emptyStats()), map.get(id)!);
  for (const r of byRsvp) {
    const s = get(r.eventId);
    s.total += r._count._all;
    if (r.rsvpStatus === "ACCEPTED") s.accepted += r._count._all;
    else if (r.rsvpStatus === "DECLINED") s.declined += r._count._all;
    else s.pending += r._count._all;
  }
  for (const r of sent) get(r.eventId).sent = r._count._all;
  for (const r of failed) get(r.eventId).failed = r._count._all;
  return map;
}

export async function getEventDetail(id: string) {
  const event = await db.event.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
      messageTemplate: { select: { id: true, name: true, metaName: true, language: true } },
      orders: { orderBy: { createdAt: "desc" }, include: { payments: { orderBy: { createdAt: "desc" } } } },
      sendBatches: { orderBy: { createdAt: "desc" }, take: 10 },
      activities: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (!event) return null;
  const [stats, messages, views, scans, pendingJobs, auditEntries] = await Promise.all([
    guestStats([id]),
    db.whatsAppMessage.groupBy({ by: ["status"], where: { eventId: id, direction: "OUTBOUND" }, _count: { _all: true } }),
    db.invitationView.count({ where: { eventId: id } }),
    db.qRScan.count({ where: { eventId: id } }),
    db.job.count({ where: { eventId: id, status: { in: ["PENDING", "RUNNING"] } } }),
    db.auditLog.findMany({ where: { targetType: "event", targetId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return {
    event,
    stats: stats.get(id) ?? emptyStats(),
    messages: Object.fromEntries(messages.map((m) => [m.status, m._count._all])) as Record<string, number>,
    views,
    scans,
    pendingJobs,
    auditEntries,
  };
}

/**
 * Stop everything in flight for an event: running batches are cancelled (their queued
 * guests return to "not sent") and every other pending job for the event is cancelled.
 */
export async function haltEventSending(eventId: string) {
  const batches = await db.sendBatch.findMany({ where: { eventId, status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true } });
  for (const b of batches) await cancelBatch(b.id, "Event deactivated by INVTRA");
  const jobs = await cancelPendingJobs({ eventId });
  return { batches: batches.length, jobs: jobs.count };
}

export async function deactivateEvent(actorId: string, eventId: string, reason: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, deactivatedAt: true, deletedAt: true, title: true } });
  if (!event) throw notFound("Event");
  if (event.deactivatedAt) throw conflict("already_deactivated", "This event is already deactivated.");
  await db.event.update({ where: { id: eventId }, data: { deactivatedAt: new Date(), deactivatedReason: reason } });
  const halted = await haltEventSending(eventId);
  await walletChanged({ eventId });
  await audit(actorId, "admin.event.deactivate", "event", eventId, { reason, title: event.title, ...halted });
  return halted;
}

export async function reactivateEvent(actorId: string, eventId: string, reason: string) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, deactivatedAt: true, deactivatedReason: true, deletedAt: true, title: true } });
  if (!event) throw notFound("Event");
  if (!event.deactivatedAt) throw conflict("not_deactivated", "This event is active.");
  if (event.deletedAt) throw badRequest("event_deleted", "The customer deleted this event — it can't be reactivated.");
  await db.event.update({ where: { id: eventId }, data: { deactivatedAt: null, deactivatedReason: null } });
  await audit(actorId, "admin.event.reactivate", "event", eventId, { reason, title: event.title, previousReason: event.deactivatedReason });
}

export async function grantEventPlan(actorId: string, eventId: string, input: { plan: PlanTier; guestLimit: number; note: string }) {
  const r = await grantPlan({ eventId, plan: input.plan, guestLimit: input.guestLimit, note: input.note, actorId });
  await audit(actorId, "admin.event.grant_plan", "event", eventId, {
    plan: input.plan,
    guestLimit: input.guestLimit,
    note: input.note,
    orderId: r.order.id,
    previous: r.previous,
  });
  return r;
}
