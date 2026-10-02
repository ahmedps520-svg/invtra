import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, conflict, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { paging, type SearchParams, oneOf, str } from "./params";
import { ACCOUNT_DEACTIVATION_PREFIX, guestStats, haltEventSending } from "./events";

export async function listCustomers(sp: SearchParams) {
  const q = str(sp, "q");
  const status = oneOf(sp, "status", ["ACTIVE", "DEACTIVATED"] as const);
  const role = oneOf(sp, "role", ["CUSTOMER", "ADMIN"] as const);
  const { page, pageSize, skip, take } = paging(sp);
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? { OR: [{ id: q }, { name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/[^\d+]/g, "") || q } }] }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        lastLoginAt: true,
        deactivatedAt: true,
        _count: { select: { events: { where: { deletedAt: null } }, orders: { where: { status: "PAID" } } } },
      },
    }),
  ]);
  return { total, page, pageSize, rows, q, status, role };
}

export async function getCustomer(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      locale: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      deactivatedAt: true,
      deactivationNote: true,
      events: { orderBy: { startsAt: "desc" } },
      orders: { orderBy: { createdAt: "desc" }, include: { event: { select: { id: true, title: true } } } },
      _count: { select: { sessions: true } },
    },
  });
  if (!user) return null;
  const [stats, auditEntries] = await Promise.all([
    guestStats(user.events.map((e) => e.id)),
    db.auditLog.findMany({ where: { targetType: "user", targetId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return { user, stats, auditEntries };
}

/**
 * Deactivate an account: the customer is signed out everywhere and can't sign in.
 * Optionally their events are deactivated too (guests see the invitation as unavailable
 * and all sending stops).
 */
export async function deactivateCustomer(actorId: string, userId: string, input: { reason: string; alsoEvents: boolean }) {
  if (userId === actorId) throw badRequest("cannot_deactivate_self", "You can't deactivate your own account.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, status: true, email: true } });
  if (!user) throw notFound("Customer");
  if (user.status === "DEACTIVATED") throw conflict("already_deactivated", "This account is already deactivated.");

  const now = new Date();
  const { sessions, eventIds } = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: "DEACTIVATED", deactivatedAt: now, deactivationNote: input.reason } });
    const sessions = await tx.session.deleteMany({ where: { userId } });
    let eventIds: string[] = [];
    if (input.alsoEvents) {
      const events = await tx.event.findMany({ where: { userId, deletedAt: null, deactivatedAt: null }, select: { id: true } });
      eventIds = events.map((e) => e.id);
      if (eventIds.length) {
        await tx.event.updateMany({
          where: { id: { in: eventIds } },
          data: { deactivatedAt: now, deactivatedReason: `${ACCOUNT_DEACTIVATION_PREFIX}${input.reason}`.slice(0, 500) },
        });
      }
    }
    return { sessions: sessions.count, eventIds };
  });
  for (const id of eventIds) await haltEventSending(id);
  await audit(actorId, "admin.user.deactivate", "user", userId, {
    reason: input.reason,
    email: user.email,
    sessionsRevoked: sessions,
    eventsDeactivated: eventIds,
  });
  return { sessions, events: eventIds.length };
}

/** Reactivate an account; optionally also the events that were deactivated with it. */
export async function reactivateCustomer(actorId: string, userId: string, input: { reason: string; alsoEvents: boolean }) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, status: true, email: true } });
  if (!user) throw notFound("Customer");
  if (user.status === "ACTIVE") throw conflict("already_active", "This account is active.");
  const { eventIds } = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: "ACTIVE", deactivatedAt: null, deactivationNote: null } });
    let eventIds: string[] = [];
    if (input.alsoEvents) {
      const events = await tx.event.findMany({
        where: { userId, deletedAt: null, deactivatedAt: { not: null }, deactivatedReason: { startsWith: ACCOUNT_DEACTIVATION_PREFIX } },
        select: { id: true },
      });
      eventIds = events.map((e) => e.id);
      if (eventIds.length) await tx.event.updateMany({ where: { id: { in: eventIds } }, data: { deactivatedAt: null, deactivatedReason: null } });
    }
    return { eventIds };
  });
  await audit(actorId, "admin.user.reactivate", "user", userId, { reason: input.reason, email: user.email, eventsReactivated: eventIds });
  return { events: eventIds.length };
}
