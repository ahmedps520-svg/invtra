import type { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { db } from "@/server/db";
import { findOwnedEvent } from "@/server/events/access";

/**
 * The event, for the pages only its owner uses (overview, details, design, plan, check-in).
 * A co-host who lands on one is sent to their guest list instead; anyone else gets a 404.
 */
export async function ownerEventOrList<I extends Prisma.EventInclude | undefined = undefined>(userId: string, eventId: string, include?: I) {
  const event = await findOwnedEvent(userId, eventId, include);
  if (event) return event;
  const coHost = await db.coHost.findFirst({ where: { eventId, userId, event: { deletedAt: null } }, select: { id: true } });
  if (coHost) redirect(`/dashboard/events/${eventId}/guests`);
  notFound();
}
