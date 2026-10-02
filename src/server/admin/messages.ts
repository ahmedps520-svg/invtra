import type { MessageDirection, MessagePurpose, MessageStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, conflict, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { enqueue } from "@/server/queue/queue";
import { updateGuest } from "@/server/guests/status";
import { eventIsActive } from "@/server/rsvp";
import { dateParam, paging, phoneDigits, type SearchParams, oneOf, str } from "./params";

export const MESSAGE_STATUSES: MessageStatus[] = ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "RECEIVED"];
export const MESSAGE_PURPOSES: MessagePurpose[] = ["INVITATION_REQUEST", "INVITATION_DELIVERY", "DECLINE_ACK", "UPDATE", "REPLY", "OTHER"];
export const MESSAGE_DIRECTIONS: MessageDirection[] = ["OUTBOUND", "INBOUND"];
export const MESSAGE_PROVIDERS = ["cloud", "mock"] as const;

export async function listMessages(sp: SearchParams) {
  const status = oneOf(sp, "status", MESSAGE_STATUSES);
  const purpose = oneOf(sp, "purpose", MESSAGE_PURPOSES);
  const direction = oneOf(sp, "direction", MESSAGE_DIRECTIONS);
  const provider = oneOf(sp, "provider", MESSAGE_PROVIDERS);
  const from = dateParam(sp, "from");
  const to = dateParam(sp, "to", true);
  const eventId = str(sp, "event", 40) || undefined;
  const q = str(sp, "q", 120);
  const { page, pageSize, skip, take } = paging(sp);

  const or: Prisma.WhatsAppMessageWhereInput[] = [];
  if (q) {
    const digits = phoneDigits(q);
    if (digits.length >= 4) or.push({ phone: { contains: digits } });
    if (q.startsWith("wamid.")) or.push({ waMessageId: q });
    or.push({ guest: { name: { contains: q, mode: "insensitive" } } });
  }
  const where: Prisma.WhatsAppMessageWhereInput = {
    ...(status ? { status } : {}),
    ...(purpose ? { purpose } : {}),
    ...(direction ? { direction } : {}),
    ...(provider ? { provider } : {}),
    ...(eventId ? { eventId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(or.length ? { OR: or } : {}),
  };
  const [total, rows, counts, event] = await Promise.all([
    db.whatsAppMessage.count({ where }),
    db.whatsAppMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        guest: { select: { id: true, name: true, rsvpStatus: true, deliveryStatus: true } },
        event: { select: { id: true, title: true } },
      },
    }),
    db.whatsAppMessage.groupBy({ by: ["status"], where: { ...where, status: undefined }, _count: { _all: true } }),
    eventId ? db.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } }) : null,
  ]);
  return {
    total,
    page,
    pageSize,
    rows,
    event,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<MessageStatus, number>>,
  };
}

/** Whether staff may retry this message (same rules as `retryInvitationRequest`, cheap version for the list). */
export function canRetry(m: { status: MessageStatus; purpose: MessagePurpose; direction: MessageDirection; guest: { rsvpStatus: string; deliveryStatus: string } | null }) {
  return (
    m.status === "FAILED" &&
    m.purpose === "INVITATION_REQUEST" &&
    m.direction === "OUTBOUND" &&
    m.guest !== null &&
    m.guest.rsvpStatus === "PENDING" &&
    m.guest.deliveryStatus !== "QUEUED"
  );
}

/**
 * Re-send a failed Accept/Decline request: the guest goes back to QUEUED and a fresh
 * `invitation.request` job is enqueued (the worker re-checks everything before sending).
 */
export async function retryInvitationRequest(actorId: string, messageId: string) {
  const msg = await db.whatsAppMessage.findUnique({ where: { id: messageId }, include: { guest: { include: { event: true } } } });
  if (!msg) throw notFound("Message");
  if (msg.status !== "FAILED" || msg.purpose !== "INVITATION_REQUEST" || msg.direction !== "OUTBOUND") {
    throw badRequest("not_retryable", "Only failed invitation requests can be retried.");
  }
  const guest = msg.guest;
  if (!guest) throw badRequest("guest_deleted", "The guest no longer exists.");
  if (!eventIsActive(guest.event)) throw badRequest("event_inactive", "The event is deleted or deactivated.");
  if (guest.rsvpStatus !== "PENDING") throw conflict("already_responded", "The guest has already responded.");
  if (guest.deliveryStatus === "QUEUED") throw conflict("already_queued", "A message to this guest is already queued.");
  const inFlight = await db.job.findFirst({
    where: { type: "invitation.request", status: { in: ["PENDING", "RUNNING"] }, payload: { path: ["guestId"], equals: guest.id } },
    select: { id: true },
  });
  if (inFlight) throw conflict("already_queued", "A message to this guest is already queued.");
  const newer = await db.whatsAppMessage.findFirst({
    where: { guestId: guest.id, purpose: "INVITATION_REQUEST", direction: "OUTBOUND", status: { in: ["SENT", "DELIVERED", "READ"] }, createdAt: { gt: msg.createdAt } },
    select: { id: true },
  });
  if (newer) throw conflict("already_delivered", "A newer invitation request already reached this guest.");

  await updateGuest(db, guest.id, { deliveryStatus: "QUEUED", deliveryError: null, deliveryErrorCode: null });
  const job = await enqueue("invitation.request", { guestId: guest.id }, { eventId: guest.eventId, priority: 5 });
  await audit(actorId, "admin.message.retry", "message", messageId, {
    guestId: guest.id,
    eventId: guest.eventId,
    jobId: job?.id ?? null,
    previousError: msg.errorCode ?? null,
  });
  return { jobId: job?.id ?? null };
}
