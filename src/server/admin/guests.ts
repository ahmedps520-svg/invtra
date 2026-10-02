import type { DeliveryStatus, GuestStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { paging, phoneDigits, type SearchParams, oneOf, str } from "./params";

export const GUEST_STATUSES: GuestStatus[] = ["PENDING", "MESSAGE_SENT", "ACCEPTED", "DECLINED", "INVITATION_SENT", "VIEWED", "QR_SCANNED", "FAILED"];
export const DELIVERY_STATUSES: DeliveryStatus[] = ["NOT_SENT", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED"];

/**
 * Find guests across every event by name, phone (any formatting — matched on digits)
 * or invitation token.
 */
export async function searchGuests(sp: SearchParams) {
  const q = str(sp, "q", 120);
  const eventId = str(sp, "event", 40) || undefined;
  const status = oneOf(sp, "status", GUEST_STATUSES);
  const delivery = oneOf(sp, "delivery", DELIVERY_STATUSES);
  const { page, pageSize, skip, take } = paging(sp);

  const or: Prisma.GuestWhereInput[] = [];
  if (q) {
    or.push({ name: { contains: q, mode: "insensitive" } });
    const digits = phoneDigits(q);
    if (digits.length >= 4) or.push({ phone: { contains: digits } });
    const token = q.replace(/\s+/g, "").toUpperCase();
    if (/^[A-Z0-9]{6,16}$/.test(token)) or.push({ invitation: { token } });
    if (/^c[a-z0-9]{20,30}$/.test(q)) or.push({ id: q });
  }
  const where: Prisma.GuestWhereInput = {
    isTest: false,
    ...(eventId ? { eventId } : {}),
    ...(status ? { status } : {}),
    ...(delivery ? { deliveryStatus: delivery } : {}),
    ...(or.length ? { OR: or } : {}),
  };
  const [total, rows, event] = await Promise.all([
    db.guest.count({ where }),
    db.guest.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      skip,
      take,
      include: {
        event: { select: { id: true, title: true, timezone: true, deactivatedAt: true, deletedAt: true } },
        invitation: { select: { token: true, status: true } },
      },
    }),
    eventId ? db.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } }) : null,
  ]);
  return { total, page, pageSize, rows, q, event };
}
