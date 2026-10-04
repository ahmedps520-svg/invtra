import type { Event, Guest } from "@prisma/client";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import { parseSections, SECTION_LABELS, type SectionDetails, type SectionKey } from "@/lib/sections";

type SectionEvent = Pick<Event, "sectionsEnabled" | "sections" | "startsAt" | "endsAt" | "timezone">;

/** The guest's section — only while the event has sections turned on. */
export function guestSection(event: Pick<Event, "sectionsEnabled">, guest: Partial<Pick<Guest, "section">> | null | undefined): SectionKey | null {
  return event.sectionsEnabled && guest?.section ? guest.section : null;
}

/** A section's own start: its time on the event's date (after midnight when it would otherwise start 12 h early). */
export function sectionStartsAt(event: Pick<Event, "startsAt" | "timezone">, time: string): Date {
  const day = utcToZoned(event.startsAt, event.timezone).date;
  const at = zonedToUtc(day, time, event.timezone);
  return at.getTime() < event.startsAt.getTime() - 12 * 3600_000 ? new Date(at.getTime() + 86_400_000) : at;
}

/** The section's details, or null when the guest has none. */
export function sectionFor(event: SectionEvent, guest: Partial<Pick<Guest, "section">> | null | undefined): { key: SectionKey; details: SectionDetails } | null {
  const key = guestSection(event, guest);
  return key ? { key, details: parseSections(event.sections)[key] } : null;
}

/**
 * The event as this guest should see it: their section's time and place in place of the
 * main ones (anything the section leaves empty stays as it is). Used for the invitation
 * page, the personal card, WhatsApp messages, reminders and the calendar entry.
 */
export function eventForGuest<
  E extends SectionEvent & Pick<Event, "venueName" | "venueNameAr" | "address" | "addressAr" | "mapsUrl" | "latitude" | "longitude">,
>(event: E, guest: Partial<Pick<Guest, "section">> | null | undefined): E {
  const s = sectionFor(event, guest);
  if (!s) return event;
  const d = s.details;
  const startsAt = d.time ? sectionStartsAt(event, d.time) : event.startsAt;
  const placeChanged = Boolean(d.venueName || d.address || d.mapsUrl);
  return {
    ...event,
    startsAt,
    // A different start makes the main end time meaningless for this section.
    endsAt: d.time && startsAt.getTime() !== event.startsAt.getTime() ? null : event.endsAt,
    venueName: d.venueName ?? event.venueName,
    venueNameAr: d.venueNameAr ?? (d.venueName ? null : event.venueNameAr),
    address: d.address ?? event.address,
    addressAr: d.addressAr ?? (d.address ? null : event.addressAr),
    mapsUrl: d.mapsUrl ?? (placeChanged ? null : event.mapsUrl),
    latitude: placeChanged ? null : event.latitude,
    longitude: placeChanged ? null : event.longitude,
  };
}

/** "Women's section" / "قسم النساء" and the entrance note, for pages and messages. */
export function sectionInfo(event: SectionEvent, guest: Partial<Pick<Guest, "section">> | null | undefined) {
  const s = sectionFor(event, guest);
  if (!s) return null;
  return { key: s.key, label: SECTION_LABELS[s.key], note: s.details.note, noteAr: s.details.noteAr };
}
