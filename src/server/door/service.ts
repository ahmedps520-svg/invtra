import type { Event, Guest, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { badRequest, notFound } from "@/server/http";
import { recordActivity } from "@/server/activity";
import { recordScan } from "@/server/invitations/public";
import { generateSecretToken, isWellFormedInvitationToken } from "@/server/security/tokens";

/**
 * Door check-in for staff. The host creates a link (/door/<token>) and sends it to whoever
 * stands at the entrance: they scan guests' QR codes with their phone, or search by name,
 * and check guests in — no account needed. A new link revokes the old one, and links stop
 * working two days after the event.
 */

/** Set by the door page so that a QR scanned with the phone's own camera opens the door view. */
export const DOOR_COOKIE = "invtra_door";
const DOOR_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const OPEN_AFTER_EVENT_MS = 2 * 86_400_000;

export function doorUrl(token: string) {
  return appUrl(`/door/${token}`);
}

/** Create (if missing), replace, or turn off the event's door link. */
export async function setDoorLink(event: Pick<Event, "id" | "doorToken">, action: "create" | "regenerate" | "disable") {
  if (action === "disable") {
    await db.event.update({ where: { id: event.id }, data: { doorToken: null, doorTokenCreatedAt: null } });
    return null;
  }
  if (action === "create" && event.doorToken) return event.doorToken;
  const token = generateSecretToken(18);
  await db.event.update({ where: { id: event.id }, data: { doorToken: token, doorTokenCreatedAt: new Date() } });
  return token;
}

/** When the door link stops working: two days after the event ends. */
export function doorClosesAt(event: Pick<Event, "startsAt" | "endsAt">) {
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 3600_000);
  return new Date(end.getTime() + OPEN_AFTER_EVENT_MS);
}

/** The event behind a door link, while the link can still be used. */
export async function findDoorEvent(token: string | null | undefined): Promise<Event | null> {
  if (!token || !DOOR_TOKEN.test(token)) return null;
  const event = await db.event.findUnique({ where: { doorToken: token } });
  if (!event || event.deletedAt || event.deactivatedAt) return null;
  if (doorClosesAt(event) < new Date()) return null;
  return event;
}

export async function requireDoorEvent(token: string): Promise<Event> {
  const event = await findDoorEvent(token);
  if (!event) throw notFound("Door link");
  return event;
}

/** What the door staff see about a guest (no full phone number). */
export type DoorGuest = {
  id: string;
  name: string;
  groupName: string | null;
  phoneTail: string;
  allowedCount: number;
  attendingCount: number | null;
  rsvpStatus: Guest["rsvpStatus"];
  section: Guest["section"];
  checkedInAt: string | null;
  checkedInCount: number | null;
};

const GUEST_FIELDS = {
  id: true,
  name: true,
  groupName: true,
  phone: true,
  allowedCount: true,
  attendingCount: true,
  rsvpStatus: true,
  section: true,
  checkedInAt: true,
  checkedInCount: true,
} satisfies Prisma.GuestSelect;

type DoorGuestRow = Prisma.GuestGetPayload<{ select: typeof GUEST_FIELDS }>;

function toDoorGuest(g: DoorGuestRow, sectionsEnabled: boolean): DoorGuest {
  return {
    id: g.id,
    name: g.name,
    groupName: g.groupName,
    phoneTail: g.phone.replace(/\D/g, "").slice(-4),
    allowedCount: g.allowedCount,
    attendingCount: g.attendingCount,
    rsvpStatus: g.rsvpStatus,
    section: sectionsEnabled ? g.section : null,
    checkedInAt: g.checkedInAt?.toISOString() ?? null,
    checkedInCount: g.checkedInCount,
  };
}

/** A scanned QR ("https://invtra.store/Q/8F3K92QXHT", an invitation link or the bare code) → invitation token. */
export function tokenFromCode(code: string): string | null {
  let text = code.trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      const parts = new URL(text).pathname.split("/").filter(Boolean);
      text = parts[parts.length - 1] ?? "";
    } catch {
      return null;
    }
  }
  const token = text.toUpperCase();
  return isWellFormedInvitationToken(token) ? token : null;
}

export type ScanResult = { ok: true; guest: DoorGuest } | { ok: false; reason: "unknown" | "other_event" | "revoked" };

/** Look up a scanned QR code for this event and count it as a door scan. */
export async function doorScan(event: Event, code: string): Promise<ScanResult> {
  const token = tokenFromCode(code);
  if (!token) return { ok: false, reason: "unknown" };
  const inv = await db.invitation.findUnique({ where: { token }, select: { eventId: true, status: true, guestId: true, guest: { select: { isTest: true } } } });
  if (!inv) return { ok: false, reason: "unknown" };
  if (inv.eventId !== event.id) return { ok: false, reason: "other_event" };
  if (inv.status === "REVOKED") return { ok: false, reason: "revoked" };
  await recordScan(token, true);
  const guest = await db.guest.findUniqueOrThrow({ where: { id: inv.guestId }, select: GUEST_FIELDS });
  return { ok: true, guest: toDoorGuest(guest, event.sectionsEnabled) };
}

/** Find guests by name, group or the last digits of their phone. */
export async function doorSearch(event: Event, q: string): Promise<DoorGuest[]> {
  const text = q.trim();
  if (text.length < 2) return [];
  const digits = text.replace(/\D/g, "");
  const guests = await db.guest.findMany({
    where: {
      eventId: event.id,
      isTest: false,
      OR: [
        { name: { contains: text, mode: "insensitive" } },
        { groupName: { contains: text, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phone: { endsWith: digits } }] : []),
      ],
    },
    orderBy: [{ rsvpStatus: "asc" }, { name: "asc" }],
    take: 20,
    select: GUEST_FIELDS,
  });
  return guests.map((g) => toDoorGuest(g, event.sectionsEnabled));
}

export async function doorGuest(event: Event, guestId: string): Promise<DoorGuest> {
  const g = await db.guest.findFirst({ where: { id: guestId, eventId: event.id, isTest: false }, select: GUEST_FIELDS });
  if (!g) throw notFound("Guest");
  return toDoorGuest(g, event.sectionsEnabled);
}

/** Check a guest in (with how many people arrived), or undo it. */
export async function doorCheckIn(event: Event, guestId: string, opts: { count?: number; undo?: boolean }): Promise<DoorGuest> {
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id, isTest: false } });
  if (!guest) throw notFound("Guest");
  if (opts.count !== undefined && (opts.count < 1 || opts.count > 50)) throw badRequest("invalid_count", "Between 1 and 50 people.");
  const updated = await db.guest.update({
    where: { id: guest.id },
    data: opts.undo
      ? { checkedInAt: null, checkedInCount: null }
      : { checkedInAt: guest.checkedInAt ?? new Date(), checkedInCount: opts.count ?? guest.attendingCount ?? guest.allowedCount, lastActivityAt: new Date() },
    select: GUEST_FIELDS,
  });
  if (!opts.undo && !guest.checkedInAt) {
    await recordActivity(db, event.id, "guest.checked_in", { name: guest.name, count: updated.checkedInCount, door: true }, guest.id);
  }
  return toDoorGuest(updated, event.sectionsEnabled);
}

/** Arrivals so far — overall and per section — and the latest arrivals. */
export async function doorSummary(event: Event) {
  const where = { eventId: event.id, isTest: false };
  const [rows, recent] = await Promise.all([
    db.guest.groupBy({
      by: ["section", "rsvpStatus"],
      where,
      _count: { _all: true, checkedInAt: true },
      _sum: { attendingCount: true, allowedCount: true, checkedInCount: true },
    }),
    db.guest.findMany({ where: { ...where, checkedInAt: { not: null } }, orderBy: { checkedInAt: "desc" }, take: 8, select: GUEST_FIELDS }),
  ]);
  // Accepted guests without a head count are expected with everyone they may bring.
  const acceptedNoCount = await db.guest.groupBy({
    by: ["section"],
    where: { ...where, rsvpStatus: "ACCEPTED", attendingCount: null },
    _sum: { allowedCount: true },
  });
  const tally = (filter: (r: (typeof rows)[number]) => boolean, section?: Guest["section"] | "ALL") => {
    const mine = rows.filter(filter);
    const accepted = mine.filter((r) => r.rsvpStatus === "ACCEPTED");
    const fallback = acceptedNoCount.filter((r) => section === "ALL" || r.section === section).reduce((n, r) => n + (r._sum.allowedCount ?? 0), 0);
    return {
      invited: mine.reduce((n, r) => n + r._count._all, 0),
      accepted: accepted.reduce((n, r) => n + r._count._all, 0),
      expected: accepted.reduce((n, r) => n + (r._sum.attendingCount ?? 0), 0) + fallback,
      arrivedGuests: mine.reduce((n, r) => n + r._count.checkedInAt, 0),
      arrived: mine.reduce((n, r) => n + (r._sum.checkedInCount ?? 0), 0),
    };
  };
  return {
    total: tally(() => true, "ALL"),
    sections: event.sectionsEnabled
      ? { MEN: tally((r) => r.section === "MEN", "MEN"), WOMEN: tally((r) => r.section === "WOMEN", "WOMEN") }
      : null,
    recent: recent.map((g) => toDoorGuest(g, event.sectionsEnabled)),
  };
}

export type DoorSummary = Awaited<ReturnType<typeof doorSummary>>;
