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

/** Same as getOwnedEvent but returns null instead of throwing (for pages). */
export async function findOwnedEvent<I extends Prisma.EventInclude | undefined = undefined>(
  userId: string,
  eventId: string,
  include?: I,
) {
  const event = await db.event.findFirst({ where: { id: eventId, userId, deletedAt: null }, include: include as I });
  return event as Prisma.EventGetPayload<{ include: I }> | null;
}
