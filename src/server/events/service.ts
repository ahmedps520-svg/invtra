import type { Event, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { recordActivity } from "@/server/activity";
import { cancelPendingJobs } from "@/server/queue/queue";
import { zonedToUtc, utcToZoned } from "@/lib/time";
import { DEFAULT_THEME, getTheme } from "@/lib/themes/registry";
import type { EventInput } from "@/lib/validation/event";

/** Fields printed on the invitation image — changing them requires re-sending updates. */
const CARD_FIELDS = ["title", "titleAr", "hostNames", "hostNamesAr", "startsAt", "timezone", "venueName", "venueNameAr", "address", "addressAr", "type", "language"] as const;

function toEventData(input: EventInput) {
  const startsAt = zonedToUtc(input.date, input.time, input.timezone);
  let endsAt: Date | null = null;
  if (input.endTime) {
    endsAt = zonedToUtc(input.date, input.endTime, input.timezone);
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86_400_000); // ends after midnight
  }
  return {
    type: input.type,
    language: input.language,
    title: input.title,
    titleAr: input.titleAr,
    hostNames: input.hostNames,
    hostNamesAr: input.hostNamesAr,
    startsAt,
    endsAt,
    timezone: input.timezone,
    venueName: input.venueName,
    venueNameAr: input.venueNameAr,
    address: input.address,
    addressAr: input.addressAr,
    mapsUrl: input.mapsUrl,
    dressCode: input.dressCode,
    dressCodeAr: input.dressCodeAr,
    notes: input.notes,
    notesAr: input.notesAr,
    parkingInfo: input.parkingInfo,
    accommodationInfo: input.accommodationInfo,
    specialInstructions: input.specialInstructions,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail,
    rsvpDeadline: input.rsvpDeadline ? zonedToUtc(input.rsvpDeadline, "12:00", input.timezone) : null,
    allowWebRsvp: input.allowWebRsvp,
  };
}

export async function createEvent(userId: string, input: EventInput) {
  const themeKey = input.language === "AR" ? "arabic" : input.language === "BILINGUAL" ? "bilingual" : DEFAULT_THEME;
  const theme = getTheme(themeKey);
  return db.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        userId,
        ...toEventData(input),
        themeKey,
        design: theme.defaults as unknown as Prisma.InputJsonValue,
        scheduleItems: {
          create: input.schedule.map((s, i) => ({ ...s, sortOrder: i })),
        },
      },
    });
    await recordActivity(tx, event.id, "event.created", { title: event.title });
    return event;
  });
}

/** Update event details. Returns whether anything printed on the invitation changed. */
export async function updateEvent(event: Event, input: EventInput) {
  const data = toEventData(input);
  const cardChanged = CARD_FIELDS.some((k) => {
    const a = (event as Record<string, unknown>)[k];
    const b = (data as Record<string, unknown>)[k];
    return a instanceof Date || b instanceof Date ? (a as Date | null)?.getTime() !== (b as Date | null)?.getTime() : (a ?? null) !== (b ?? null);
  });
  const updated = await db.$transaction(async (tx) => {
    await tx.scheduleItem.deleteMany({ where: { eventId: event.id } });
    const e = await tx.event.update({
      where: { id: event.id },
      data: {
        ...data,
        ...(cardChanged ? { contentVersion: { increment: 1 } } : {}),
        scheduleItems: { create: input.schedule.map((s, i) => ({ ...s, sortOrder: i })) },
      },
    });
    return e;
  });
  return { event: updated, cardChanged };
}

/** Event → form values (wall-clock in the event's timezone). */
export function eventToInput(event: Event & { scheduleItems: { time: string; title: string; titleAr: string | null; description: string | null }[] }): EventInput {
  const start = utcToZoned(event.startsAt, event.timezone);
  return {
    type: event.type,
    language: event.language,
    title: event.title,
    titleAr: event.titleAr,
    hostNames: event.hostNames,
    hostNamesAr: event.hostNamesAr,
    date: start.date,
    time: start.time,
    endTime: event.endsAt ? utcToZoned(event.endsAt, event.timezone).time : "",
    timezone: event.timezone,
    venueName: event.venueName,
    venueNameAr: event.venueNameAr,
    address: event.address,
    addressAr: event.addressAr,
    mapsUrl: event.mapsUrl,
    dressCode: event.dressCode,
    dressCodeAr: event.dressCodeAr,
    notes: event.notes,
    notesAr: event.notesAr,
    parkingInfo: event.parkingInfo,
    accommodationInfo: event.accommodationInfo,
    specialInstructions: event.specialInstructions,
    contactName: event.contactName,
    contactPhone: event.contactPhone,
    contactEmail: event.contactEmail,
    rsvpDeadline: event.rsvpDeadline ? utcToZoned(event.rsvpDeadline, event.timezone).date : "",
    allowWebRsvp: event.allowWebRsvp,
    schedule: event.scheduleItems.map((s) => ({ time: s.time, title: s.title, titleAr: s.titleAr, description: s.description })),
  };
}

/**
 * Soft-delete: invitation links stop working immediately, queued messages are
 * cancelled, and all data + files are purged after 30 days (src/server/maintenance.ts).
 */
export async function deleteEvent(eventId: string) {
  await db.event.update({ where: { id: eventId }, data: { deletedAt: new Date() } });
  await cancelPendingJobs({ eventId });
  await db.sendBatch.updateMany({ where: { eventId, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "CANCELLED", completedAt: new Date() } });
}

/** Headline numbers for the event overview (test guests excluded). */
export async function eventStats(eventId: string) {
  const where = { eventId, isTest: false };
  const [byStatus, total, sent, views, scans, attending] = await Promise.all([
    db.guest.groupBy({ by: ["rsvpStatus"], where, _count: true }),
    db.guest.count({ where }),
    db.guest.count({ where: { ...where, requestSentAt: { not: null } } }),
    db.invitationView.count({ where: { eventId } }),
    db.qRScan.count({ where: { eventId } }),
    db.guest.aggregate({ where: { ...where, rsvpStatus: "ACCEPTED" }, _sum: { attendingCount: true } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b.rsvpStatus === s)?._count ?? 0;
  const failed = await db.guest.count({ where: { ...where, status: "FAILED" } });
  const viewedGuests = await db.guest.count({ where: { ...where, viewCount: { gt: 0 } } });
  const scannedGuests = await db.guest.count({ where: { ...where, scanCount: { gt: 0 } } });
  const checkedIn = await db.guest.count({ where: { ...where, checkedInAt: { not: null } } });
  return {
    total,
    sent,
    accepted: count("ACCEPTED"),
    declined: count("DECLINED"),
    pending: count("PENDING"),
    failed,
    attending: attending._sum.attendingCount ?? 0,
    views,
    scans,
    viewedGuests,
    scannedGuests,
    checkedIn,
  };
}

export type EventStats = Awaited<ReturnType<typeof eventStats>>;
