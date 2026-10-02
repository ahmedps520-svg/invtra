import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";

export type ActivityKind =
  | "event.created"
  | "event.updated"
  | "guests.imported"
  | "batch.started"
  | "batch.completed"
  | "guest.message_failed"
  | "guest.accepted"
  | "guest.declined"
  | "guest.changed_to_declined"
  | "guest.changed_to_accepted"
  | "guest.invitation_sent"
  | "guest.invitation_failed"
  | "guest.viewed"
  | "guest.scanned"
  | "guest.checked_in"
  | "plan.purchased";

type Tx = Prisma.TransactionClient | typeof db;

export async function recordActivity(
  tx: Tx,
  eventId: string,
  kind: ActivityKind,
  data?: Record<string, unknown>,
  guestId?: string | null,
) {
  // "Send me a test" guests are the host's own number — keep them out of the feed.
  if (guestId) {
    const g = await tx.guest.findUnique({ where: { id: guestId }, select: { isTest: true } });
    if (g?.isTest) return;
  }
  await tx.activity.create({
    data: { eventId, kind, guestId: guestId ?? null, data: data ? JSON.parse(JSON.stringify(data)) : undefined },
  });
}
