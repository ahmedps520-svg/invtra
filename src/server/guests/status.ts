import type { DeliveryStatus, GuestStatus, Prisma, RsvpStatus } from "@prisma/client";
import { db } from "@/server/db";

type StatusInputs = {
  rsvpStatus: RsvpStatus;
  deliveryStatus: DeliveryStatus;
  invitationSentAt: Date | null;
  viewCount: number;
  scanCount: number;
};

/**
 * Single source of truth for the status shown in the dashboard.
 *
 *   DECLINED                      guest declined (wins over everything)
 *   QR_SCANNED > VIEWED > INVITATION_SENT > ACCEPTED   for accepted guests
 *   FAILED                        the Accept/Decline message could not be delivered
 *   MESSAGE_SENT                  message accepted by WhatsApp (sent/delivered/read)
 *   PENDING                       not sent yet (or queued)
 */
export function deriveGuestStatus(g: StatusInputs): GuestStatus {
  if (g.rsvpStatus === "DECLINED") return "DECLINED";
  if (g.rsvpStatus === "ACCEPTED") {
    if (g.scanCount > 0) return "QR_SCANNED";
    if (g.viewCount > 0) return "VIEWED";
    if (g.invitationSentAt) return "INVITATION_SENT";
    return "ACCEPTED";
  }
  if (g.deliveryStatus === "FAILED") return "FAILED";
  if (g.deliveryStatus === "SENT" || g.deliveryStatus === "DELIVERED" || g.deliveryStatus === "READ") return "MESSAGE_SENT";
  return "PENDING";
}

const statusSelect = {
  rsvpStatus: true,
  deliveryStatus: true,
  invitationSentAt: true,
  viewCount: true,
  scanCount: true,
  status: true,
} as const;

type Tx = Prisma.TransactionClient | typeof db;

/**
 * Apply a patch to a guest and recompute the derived status atomically.
 * Counter increments are applied first, then status is recomputed from fresh values.
 */
export async function updateGuest(tx: Tx, guestId: string, data: Prisma.GuestUpdateInput) {
  const updated = await tx.guest.update({ where: { id: guestId }, data, select: { ...statusSelect, id: true } });
  const status = deriveGuestStatus(updated);
  if (status !== updated.status) {
    await tx.guest.update({ where: { id: guestId }, data: { status } });
  }
  return { ...updated, status };
}

/** Delivery statuses only move forward (webhooks can arrive out of order). */
const DELIVERY_RANK: Record<DeliveryStatus, number> = { NOT_SENT: 0, QUEUED: 1, SENT: 2, DELIVERED: 3, READ: 4, FAILED: 5 };

export function isDeliveryProgress(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (to === "FAILED") return from !== "DELIVERED" && from !== "READ";
  if (from === "FAILED") return to === "QUEUED"; // only a resend clears a failure
  return DELIVERY_RANK[to] > DELIVERY_RANK[from];
}
