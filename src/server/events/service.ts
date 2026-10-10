import type { Event, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { recordActivity } from "@/server/activity";
import { cancelPendingJobs } from "@/server/queue/queue";
import { zonedToUtc, utcToZoned } from "@/lib/time";
import { DEFAULT_THEME, getTheme, isThemeKey, type ThemeKey } from "@/lib/themes/registry";
import type { EventInput } from "@/lib/validation/event";
import { parseSections, sectionDiffers, SECTION_KEYS } from "@/lib/sections";
import { walletChanged } from "@/server/apple/push";

/** Fields printed on the invitation image — changing them requires re-sending updates. */
const CARD_FIELDS = ["title", "titleAr", "hostNames", "hostNamesAr", "startsAt", "dateTbd", "timeTbd", "timezone", "venueName", "venueNameAr", "address", "addressAr", "type", "language"] as const;

/** Event details as saved; the date / time may be "to be announced" (older callers omit the flags). */
export type EventDetails = Omit<EventInput, "dateTbd" | "timeTbd"> & Partial<Pick<EventInput, "dateTbd" | "timeTbd">>;

/** How far ahead an unknown date is parked, so replies stay open and nothing treats it as past. */
const TBD_AHEAD_MS = 365 * 86_400_000;

/**
 * When the event starts. An unknown time is kept as 12:00; an unknown date as a placeholder about a
 * year ahead — the same one on every save while the date stays unknown, so nothing re-renders.
 */
function startOf(input: EventDetails, prev?: Pick<Event, "startsAt" | "dateTbd" | "timezone"> | null) {
  const dateTbd = Boolean(input.dateTbd) || !input.date;
  const timeTbd = Boolean(input.timeTbd) || !input.time;
  const time = timeTbd ? "12:00" : input.time;
  let date = input.date;
  if (dateTbd) {
    const keep = prev?.dateTbd && prev.timezone === input.timezone && prev.startsAt.getTime() > Date.now() + 30 * 86_400_000;
    date = utcToZoned(keep ? prev.startsAt : new Date(Date.now() + TBD_AHEAD_MS), input.timezone).date;
  }
  return { startsAt: zonedToUtc(date, time, input.timezone), date, dateTbd, timeTbd };
}

function toEventData(input: EventDetails, prev?: Pick<Event, "startsAt" | "dateTbd" | "timezone"> | null) {
  const { startsAt, date, dateTbd, timeTbd } = startOf(input, prev);
  let endsAt: Date | null = null;
  if (input.endTime && !timeTbd) {
    endsAt = zonedToUtc(date, input.endTime, input.timezone);
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
    dateTbd,
    timeTbd,
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
    sectionsEnabled: input.sectionsEnabled,
    // Kept while sections are off, so turning them back on restores the details.
    sections: input.sections ? (input.sections as unknown as Prisma.InputJsonValue) : undefined,
    autoReminder: input.autoReminder,
  };
}

/** What the sections print on guests' cards (their time and place) — a change means new cards. */
function cardSections(e: { sectionsEnabled: boolean; sections: unknown }) {
  if (!e.sectionsEnabled) return null;
  const s = parseSections(e.sections);
  return SECTION_KEYS.map((k) => (sectionDiffers(s[k]) ? [s[k].time, s[k].venueName, s[k].venueNameAr, s[k].address, s[k].addressAr] : null));
}

/** The design a new event starts with when the customer hasn't picked one yet. */
const OCCASION_THEME: Partial<Record<EventInput["type"], ThemeKey>> = {
  NEWBORN: "teddy",
  BABY_SHOWER: "clouds",
  AQIQAH: "moonlight",
  HENNA: "henna",
  RAMADAN: "lantern",
  BIRTHDAY: "confetti",
  GRADUATION: "confetti",
};

export async function createEvent(userId: string, input: EventDetails, preferredTheme?: string | null) {
  const byLanguage: ThemeKey = input.language === "AR" ? "arabic" : input.language === "BILINGUAL" ? "bilingual" : DEFAULT_THEME;
  const themeKey: ThemeKey = isThemeKey(preferredTheme) ? preferredTheme : (OCCASION_THEME[input.type] ?? byLanguage);
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
export async function updateEvent(event: Event, input: EventDetails) {
  const data = toEventData(input, event);
  const cardChanged = CARD_FIELDS.some((k) => {
    const a = (event as Record<string, unknown>)[k];
    const b = (data as Record<string, unknown>)[k];
    return a instanceof Date || b instanceof Date ? (a as Date | null)?.getTime() !== (b as Date | null)?.getTime() : (a ?? null) !== (b ?? null);
  }) || JSON.stringify(cardSections(event)) !== JSON.stringify(cardSections({ sectionsEnabled: data.sectionsEnabled ?? event.sectionsEnabled, sections: data.sections ?? event.sections }));
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
    // A new date or time: everyone gets the day-before reminder for the new start.
    if ((e.startsAt.getTime() !== event.startsAt.getTime() || e.dateTbd !== event.dateTbd) && e.startsAt > new Date()) {
      await tx.guest.updateMany({ where: { eventId: event.id, reminderSentAt: { not: null } }, data: { reminderSentAt: null } });
    }
    return e;
  });
  await walletChanged({ eventId: event.id });
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
    date: event.dateTbd ? "" : start.date,
    time: event.timeTbd ? "" : start.time,
    dateTbd: event.dateTbd,
    timeTbd: event.timeTbd,
    endTime: event.endsAt && !event.timeTbd ? utcToZoned(event.endsAt, event.timezone).time : "",
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
    sectionsEnabled: event.sectionsEnabled,
    sections: parseSections(event.sections),
    autoReminder: event.autoReminder,
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
  await walletChanged({ eventId });
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
  const event = await db.event.findUnique({ where: { id: eventId }, select: { sectionsEnabled: true } });
  return {
    sections: event?.sectionsEnabled ? await sectionStats(eventId) : null,
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

/** Per section (men's / women's): guests, accepted, people attending and arrivals. */
async function sectionStats(eventId: string) {
  const rows = await db.guest.groupBy({
    by: ["section", "rsvpStatus"],
    where: { eventId, isTest: false },
    _count: true,
    _sum: { attendingCount: true, checkedInCount: true },
  });
  const one = (section: "MEN" | "WOMEN") => {
    const mine = rows.filter((r) => r.section === section);
    const accepted = mine.find((r) => r.rsvpStatus === "ACCEPTED");
    return {
      total: mine.reduce((n, r) => n + r._count, 0),
      accepted: accepted?._count ?? 0,
      attending: accepted?._sum.attendingCount ?? 0,
      arrived: mine.reduce((n, r) => n + (r._sum.checkedInCount ?? 0), 0),
    };
  };
  return { MEN: one("MEN"), WOMEN: one("WOMEN") };
}

export type EventStats = Awaited<ReturnType<typeof eventStats>>;
