import type { Event } from "@prisma/client";
import type { PageLang } from "@/components/invitation/types";
import { utcToZoned } from "@/lib/time";

/**
 * "Add to calendar": one event in the guest's language, at their own section's time and place.
 * Google Calendar gets a prefilled link; Apple Calendar and Outlook get an .ics file.
 */

type CalendarSource = Pick<Event, "title" | "titleAr" | "startsAt" | "endsAt" | "venueName" | "venueNameAr" | "address" | "addressAr"> &
  Partial<Pick<Event, "timezone" | "timeTbd">>;

/** An event whose time isn't known yet is entered as an all-day event on its date. */
function allDay(event: CalendarSource): { first: string; next: string } | null {
  if (!event.timeTbd || !event.timezone) return null;
  const day = utcToZoned(event.startsAt, event.timezone).date;
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { first: day.replace(/-/g, ""), next: next.toISOString().slice(0, 10).replace(/-/g, "") };
}
type SectionNote = { label: { en: string; ar: string }; note: string | null; noteAr: string | null } | null;

/** Events without an end time are entered as four hours long. */
const DEFAULT_LENGTH_MS = 4 * 3600_000;

export function calendarEntry(event: CalendarSource, opts: { lang: PageLang; url: string; section?: SectionNote }) {
  const ar = opts.lang === "ar";
  const venue = ar ? event.venueNameAr || event.venueName : event.venueName;
  const address = ar ? event.addressAr || event.address : event.address;
  const s = opts.section;
  const lines = [
    s ? (ar ? s.label.ar : s.label.en) : null,
    s ? (ar ? s.noteAr || s.note : s.note || s.noteAr) : null,
    `${ar ? "دعوتك الخاصة" : "Your invitation"}: ${opts.url}`,
  ].filter(Boolean) as string[];
  return {
    title: ar ? event.titleAr || event.title : event.title,
    start: event.startsAt,
    end: event.endsAt && event.endsAt > event.startsAt ? event.endsAt : new Date(event.startsAt.getTime() + DEFAULT_LENGTH_MS),
    location: [venue, address].filter((x) => x && x.trim()).join(", "),
    description: lines.join("\n"),
    url: opts.url,
  };
}

/** 20261010T170000Z */
function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(event: CalendarSource, opts: { lang: PageLang; url: string; section?: SectionNote }): string {
  const e = calendarEntry(event, opts);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: allDay(event) ? `${allDay(event)!.first}/${allDay(event)!.next}` : `${stamp(e.start)}/${stamp(e.end)}`,
    details: e.description,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** RFC 5545 text escaping. */
function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets are folded (continuation lines start with a space). */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let chunk = "";
  let size = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, "utf8");
    if (size + n > (out.length ? 74 : 75)) {
      out.push(chunk);
      chunk = "";
      size = 0;
    }
    chunk += ch;
    size += n;
  }
  out.push(chunk);
  return out.join("\r\n ");
}

/** The .ics file (Apple Calendar, Outlook…), with a reminder three hours before. */
export function icsCalendar(event: CalendarSource, opts: { lang: PageLang; url: string; section?: SectionNote; uid: string; now?: Date }): string {
  const e = calendarEntry(event, opts);
  const day = allDay(event);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//INVTRA//Invitation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@invtra.store`,
    `DTSTAMP:${stamp(opts.now ?? new Date())}`,
    ...(day ? [`DTSTART;VALUE=DATE:${day.first}`, `DTEND;VALUE=DATE:${day.next}`] : [`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`]),
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(e.description)}`,
    `URL:${e.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    // Three hours before — or 9 am on the day when the time isn't known.
    day ? "TRIGGER:PT9H" : "TRIGGER:-PT3H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
