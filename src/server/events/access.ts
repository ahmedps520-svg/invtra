import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import type { SessionUser } from "@/server/auth/session";

/**
 * Load an event the user owns. Missing, deleted and other people's events are all
 * reported as "not found" so ids cannot be probed.
 */
export async function getOwnedEvent<I extends Prisma.EventInclude | undefined = undefined>(
  user: Pick<SessionUser, "id">,
  eventId: string,
  include?: I,
) {
  const event = await db.event.findFirst({
    where: { id: eventId, userId: user.id, deletedAt: null },
    include: include as I,
  });
  if (!event) throw notFound("Event");
  return event as Prisma.EventGetPayload<{ include: I }>;
}

/**
 * An event whose design this user may edit: their own, or any event for INVTRA staff
 * (custom events are designed by staff for the host). Only the design routes use this —
 * guests, sending and billing stay owner-only.
 */
export async function getEditableEvent<I extends Prisma.EventInclude | undefined = undefined>(
  user: Pick<SessionUser, "id" | "role">,
  eventId: string,
  include?: I,
) {
  const event = await findEditableEvent(user, eventId, include);
  if (!event) throw notFound("Event");
  return event;
}

export async function findEditableEvent<I extends Prisma.EventInclude | undefined = undefined>(
  user: Pick<SessionUser, "id" | "role">,
  eventId: string,
  include?: I,
) {
  const event = await db.event.findFirst({
    where: { id: eventId, deletedAt: null, ...(user.role === "ADMIN" ? {} : { userId: user.id }) },
    include: include as I,
  });
  return event as Prisma.EventGetPayload<{ include: I }> | null;
}

/** Same as getOwnedEvent but returns null instead of throwing (for pages). */
export async function findOwnedEvent<I extends Prisma.EventInclude | undefined = undefined>(
  userId: string,
  eventId: string,
  include?: I,
) {
  const event = await db.event.findFirst({ where: { id: eventId, userId, deletedAt: null }, include: include as I });
  return event as Prisma.EventGetPayload<{ include: I }> | null;
}
