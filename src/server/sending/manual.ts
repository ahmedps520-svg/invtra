import type { Event, Guest } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, notFound } from "@/server/http";
import { ensureInvitation, ensureInvitations, invitationUrl } from "@/server/invitations";
import { templateValues } from "@/server/whatsapp/compose";
import { updateGuest } from "@/server/guests/status";
import { eventIsActive } from "@/server/rsvp";
import { sendReadiness } from "./service";
import { parseSections, SECTION_LABELS } from "@/lib/sections";

/**
 * "Send from my own WhatsApp": the host sends each guest their personal invitation link
 * from their own phone (a wa.me link with the message typed in — the host presses send
 * every time, nothing is automated). Guests reply on their invitation page, so these
 * guests may always RSVP on the web, and they are never messaged again by the automatic
 * sender (their delivery status is no longer NOT_SENT).
 */

/** What must be in place: the same as sending through INVTRA, minus WhatsApp setup and a template. */
const MANUAL_CHECKS = new Set(["details", "date", "design", "guests", "plan", "theme_plan"]);

export async function manualReadiness(event: Event) {
  const r = await sendReadiness(event);
  const checks = r.checks.filter((c) => MANUAL_CHECKS.has(c.key));
  return { ready: eventIsActive(event) && checks.every((c) => c.ok), checks };
}

type MessageEvent = Parameters<typeof templateValues>[0] & Pick<Event, "language">;

/** The guest's language for the message: their own setting, else the invitation's. */
function messageLang(event: Pick<Event, "language">, guest: Pick<Guest, "locale">): "en" | "ar" | "both" {
  if (guest.locale === "en" || guest.locale === "ar") return guest.locale;
  return event.language === "AR" ? "ar" : event.language === "EN" ? "en" : "both";
}

/** "🚪 Women's section — Ladies' entrance from gate 2" for guests in a section. */
export function sectionLine(event: Partial<Pick<Event, "sectionsEnabled" | "sections">>, guest: Partial<Pick<Guest, "section">>, lang: "en" | "ar"): string {
  if (!event.sectionsEnabled || !guest.section) return "";
  const s = parseSections(event.sections)[guest.section];
  const note = lang === "ar" ? s.noteAr || s.note : s.note || s.noteAr;
  return `\n🚪 ${SECTION_LABELS[guest.section][lang]}${note ? ` — ${note}` : ""}`;
}

/** The text that opens in WhatsApp, with the guest's personal link at the end. */
export function manualMessage(event: MessageEvent, guest: Pick<Guest, "name" | "locale"> & Partial<Pick<Guest, "section">>, token: string): string {
  const v = templateValues(event, guest, token);
  const link = invitationUrl(token);
  // A custom event without a venue has no 📍 line.
  const place = (venue: string) => (venue && venue !== "—" ? `\n📍 ${venue}` : "");
  const ar = `السلام عليكم ${v.guest_name}،\n\nيتشرّف ${v.host_names_ar} بدعوتكم لحضور ${v.event_name_ar}.\n📅 ${v.event_date_ar} · ${v.event_time_ar}${place(v.venue_ar)}${sectionLine(event, guest, "ar")}`;
  const en = `Dear ${v.guest_name},\n\n${v.host_names} would be delighted to welcome you to ${v.event_name}.\n📅 ${v.event_date} · ${v.event_time}${place(v.venue)}${sectionLine(event, guest, "en")}`;
  const lang = messageLang(event, guest);
  if (lang === "ar") return `${ar}\n\nدعوتك الخاصة وتأكيد الحضور:\n${link}`;
  if (lang === "en") return `${en}\n\nYour personal invitation and RSVP:\n${link}`;
  // One language per line, so WhatsApp lays out each in its own direction.
  return `${ar}\n\n${en}\n\nدعوتك الخاصة وتأكيد الحضور:\nYour personal invitation and RSVP:\n${link}`;
}

/** Opens WhatsApp (app or web) on a chat with this number, the message already typed. */
export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export type ManualGuest = {
  id: string;
  name: string;
  phone: string;
  groupName: string | null;
  status: Guest["status"];
  /** When the host last sent it from their own WhatsApp. */
  manualSentAt: string | null;
  /** Already messaged by INVTRA's own WhatsApp sending. */
  sentByInvtra: boolean;
  link: string;
  text: string;
  waUrl: string;
};

/** Every guest with their personal link and ready-to-send message. */
export async function manualSendList(event: Event): Promise<ManualGuest[]> {
  const guests = await db.guest.findMany({
    where: { eventId: event.id, isTest: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, eventId: true, name: true, phone: true, groupName: true, locale: true, section: true, status: true, deliveryStatus: true, manualSentAt: true },
  });
  if (!guests.length) return [];
  await ensureInvitations(guests);
  const invitations = await db.invitation.findMany({ where: { guestId: { in: guests.map((g) => g.id) } }, select: { guestId: true, token: true } });
  const tokens = new Map(invitations.map((i) => [i.guestId, i.token]));
  return guests.map((g) => {
    const token = tokens.get(g.id)!;
    const text = manualMessage(event, g, token);
    return {
      id: g.id,
      name: g.name,
      phone: g.phone,
      groupName: g.groupName,
      status: g.status,
      manualSentAt: g.manualSentAt?.toISOString() ?? null,
      sentByInvtra: !g.manualSentAt && g.deliveryStatus !== "NOT_SENT" && g.deliveryStatus !== "QUEUED",
      link: invitationUrl(token),
      text,
      waUrl: whatsappLink(g.phone, text),
    };
  });
}

/** The host opened WhatsApp to send this guest's invitation: count it as sent. */
export async function markManualSent(event: Event, guestId: string) {
  const readiness = await manualReadiness(event);
  if (!readiness.ready) {
    throw badRequest("not_ready", "This event isn't ready to send yet.", Object.fromEntries(readiness.checks.filter((c) => !c.ok).map((c) => [c.key, "not_ready"])));
  }
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id, isTest: false } });
  if (!guest) throw notFound("Guest");
  await ensureInvitation(guest); // the link the host sent must exist
  const now = new Date();
  const updated = await db.$transaction((tx) =>
    updateGuest(tx, guest.id, {
      manualSentAt: now,
      requestSentAt: guest.requestSentAt ?? now,
      lastActivityAt: now,
      ...(guest.deliveryStatus === "NOT_SENT" || guest.deliveryStatus === "FAILED" ? { deliveryStatus: "SENT", deliveryError: null, deliveryErrorCode: null } : {}),
    }),
  );
  return { id: guest.id, status: updated.status, manualSentAt: now.toISOString() };
}
