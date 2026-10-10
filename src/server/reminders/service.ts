import type { Event, Guest } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, notFound } from "@/server/http";
import { ensureInvitations, invitationUrl } from "@/server/invitations";
import { enqueue, PRIORITY } from "@/server/queue/queue";
import { eventIsActive, rsvpDeadlinePassed } from "@/server/rsvp";
import { eventForGuest } from "@/server/events/sections";
import { mapsLinks } from "@/server/invitations/view-model";
import { guestLocale, pickTemplate, templateValues } from "@/server/whatsapp/compose";
import { sectionLine, whatsappLink } from "@/server/sending/manual";

/**
 * Reminders.
 *  - Day before: guests who accepted get the time, the place and their invitation 24 hours
 *    before their (section's) start. INVTRA sends it on WhatsApp to the guests it invited;
 *    guests the host invited from their own WhatsApp appear in a list for the host to send.
 *  - Nudges: the host reminds guests who haven't replied — through INVTRA (Accept / Decline
 *    buttons, at most twice per guest, two days apart) or from their own WhatsApp.
 */

/** Reminders go out 24 hours before the start, and not later than 2 hours before it. */
export const REMINDER_LEAD_MS = 24 * 3600_000;
const REMINDER_LAST_MS = 2 * 3600_000;
/** Someone who accepted in the last day already has everything fresh in their chat. */
const RECENT_ACCEPT_MS = 26 * 3600_000;
/** Nudges: a day after the invitation, two days apart, twice at most (through INVTRA). */
const NUDGE_AFTER_MS = 24 * 3600_000;
const NUDGE_GAP_MS = 48 * 3600_000;
export const MAX_NUDGES = 2;

type GuestLike = Pick<Guest, "manualSentAt" | "requestSentAt" | "deliveryStatus">;

/** Invited through INVTRA's WhatsApp (so INVTRA may message them again). */
export function viaInvtra(g: GuestLike) {
  return !g.manualSentAt && Boolean(g.requestSentAt) && g.deliveryStatus !== "FAILED" && g.deliveryStatus !== "NOT_SENT";
}

/** Has the guest been sent their invitation at all (by INVTRA or by the host)? */
function invited(g: GuestLike) {
  return Boolean(g.manualSentAt || g.requestSentAt);
}

/** Is the day-before reminder due for this guest now? */
export function reminderDue(event: Event, guest: Pick<Guest, "section" | "rsvpAt">, now = new Date()) {
  // No reminder until the date is known (its start is only a placeholder until then).
  if (event.dateTbd) return false;
  const start = eventForGuest(event, guest).startsAt.getTime();
  const t = now.getTime();
  if (t < start - REMINDER_LEAD_MS || t > start - REMINDER_LAST_MS) return false;
  return !(guest.rsvpAt && guest.rsvpAt.getTime() > start - RECENT_ACCEPT_MS);
}

/**
 * Worker sweep (every few minutes): queue the day-before reminder for accepted guests of
 * events starting soon. Each guest is reminded once (per start time).
 */
export async function queueDueReminders(now = new Date()) {
  const events = await db.event.findMany({
    where: {
      autoReminder: true,
      deletedAt: null,
      deactivatedAt: null,
      plan: { not: null },
      dateTbd: false,
      // Sections can start a few hours apart — look a little wider than the 24-hour lead.
      startsAt: { gte: new Date(now.getTime() - 12 * 3600_000), lte: new Date(now.getTime() + REMINDER_LEAD_MS + 12 * 3600_000) },
    },
  });
  let queued = 0;
  for (const event of events) {
    const guests = await db.guest.findMany({
      where: { eventId: event.id, isTest: false, rsvpStatus: "ACCEPTED", reminderSentAt: null, manualSentAt: null, requestSentAt: { not: null } },
    });
    const templates = new Map<string, boolean>();
    for (const g of guests) {
      if (!viaInvtra(g) || !reminderDue(event, g, now)) continue;
      const locale = guestLocale(event, g);
      if (!templates.has(locale)) templates.set(locale, Boolean(await pickTemplate(event, g, "REMINDER")));
      if (!templates.get(locale)) continue; // no approved reminder in this language yet
      const job = await enqueue("reminder.send", { guestId: g.id }, { eventId: event.id, priority: PRIORITY.bulk, dedupeKey: `reminder:${g.id}:${event.startsAt.getTime()}` });
      if (job) queued++;
    }
  }
  return queued;
}

/** Guests INVTRA may nudge now (invited by INVTRA, no reply, not nudged recently). */
async function nudgeable(event: Event, now = new Date()) {
  const guests = await db.guest.findMany({
    where: {
      eventId: event.id,
      isTest: false,
      rsvpStatus: "PENDING",
      manualSentAt: null,
      requestSentAt: { not: null, lt: new Date(now.getTime() - NUDGE_AFTER_MS) },
      deliveryStatus: { in: ["SENT", "DELIVERED", "READ"] },
      nudgeCount: { lt: MAX_NUDGES },
      OR: [{ nudgedAt: null }, { nudgedAt: { lt: new Date(now.getTime() - NUDGE_GAP_MS) } }],
    },
    orderBy: { createdAt: "asc" },
  });
  return guests;
}

function repliesOpen(event: Event, now = new Date()) {
  return eventIsActive(event) && !rsvpDeadlinePassed(event, now) && event.startsAt > now;
}

/** The host asks INVTRA to remind everyone who hasn't replied yet. */
export async function startNudges(event: Event) {
  if (!repliesOpen(event)) throw badRequest("replies_closed", "Replies for this event are closed.");
  const guests = await nudgeable(event);
  if (!guests.length) throw badRequest("nothing_to_send", "There is no one to remind right now.");
  if (!(await pickTemplate(event, { locale: null }, "NUDGE"))) throw badRequest("template_unavailable", "The reply reminder message isn't approved yet.");
  let queued = 0;
  for (const g of guests) {
    const job = await enqueue("nudge.send", { guestId: g.id }, { eventId: event.id, priority: PRIORITY.normal, dedupeKey: `nudge:${g.id}:${g.nudgeCount + 1}` });
    if (job) queued++;
  }
  return { queued };
}

/** Numbers for the Reminders card on the event overview. */
export async function reminderOverview(event: Event) {
  const where = { eventId: event.id, isTest: false };
  const [accepted, pending] = await Promise.all([
    db.guest.findMany({ where: { ...where, rsvpStatus: "ACCEPTED" }, select: { manualSentAt: true, requestSentAt: true, deliveryStatus: true, reminderSentAt: true } }),
    db.guest.findMany({
      where: { ...where, rsvpStatus: "PENDING" },
      select: { manualSentAt: true, requestSentAt: true, deliveryStatus: true, nudgedAt: true },
    }),
  ]);
  const [reminderTemplate, nudgeTemplate, canNudge] = await Promise.all([
    pickTemplate(event, { locale: null }, "REMINDER"),
    pickTemplate(event, { locale: null }, "NUDGE"),
    nudgeable(event),
  ]);
  const start = event.startsAt.getTime();
  return {
    autoReminder: event.autoReminder,
    /** When INVTRA's reminders go out (the main start; sections follow their own times). */
    reminderAt: event.dateTbd ? null : new Date(start - REMINDER_LEAD_MS).toISOString(),
    reminderTemplate: Boolean(reminderTemplate),
    accepted: accepted.length,
    reminded: accepted.filter((g) => g.reminderSentAt).length,
    /** Accepted guests INVTRA will remind (the rest are the host's to remind). */
    autoCount: accepted.filter((g) => viaInvtra(g)).length,
    waiting: pending.filter(invited).length,
    nudgeTemplate: Boolean(nudgeTemplate),
    canNudge: repliesOpen(event) ? canNudge.length : 0,
    repliesOpen: repliesOpen(event),
    past: start < Date.now(),
  };
}

export type ReminderOverview = Awaited<ReturnType<typeof reminderOverview>>;

// ── From the host's own WhatsApp ───────────────────────────────────────────

function lang(event: Pick<Event, "language">, guest: Pick<Guest, "locale">): "en" | "ar" | "both" {
  const l = guestLocale(event, guest);
  return l === "bilingual" ? "both" : l;
}

/** "Reminder: … tomorrow" text with the map link and the guest's invitation. */
export function reminderText(event: Event, guest: Pick<Guest, "name" | "locale" | "section">, token: string): string {
  const v = templateValues(event, guest, token);
  const map = mapsLinks(eventForGuest(event, guest)).mapsUrl;
  const link = invitationUrl(token);
  const ar = `مرحبًا ${v.guest_name}، تذكير بموعد ${v.event_name_ar}:\n📅 ${v.event_date_ar} · ${v.event_time_ar}\n📍 ${v.venue_ar}${sectionLine(event, guest, "ar")}\n🗺️ ${map}`;
  const en = `Hello ${v.guest_name}, a reminder for ${v.event_name}:\n📅 ${v.event_date} · ${v.event_time}\n📍 ${v.venue}${sectionLine(event, guest, "en")}\n🗺️ ${map}`;
  const l = lang(event, guest);
  if (l === "ar") return `${ar}\n\nرمز الدخول في دعوتك:\n${link}`;
  if (l === "en") return `${en}\n\nYour entry QR code is on your invitation:\n${link}`;
  return `${ar}\n\n${en.replace(/\n🗺️ .*$/, "")}\n\nرمز الدخول في دعوتك:\nYour entry QR code is on your invitation:\n${link}`;
}

/** "We'd love to know if you can come" text with the guest's invitation (they reply there). */
export function nudgeText(event: Event, guest: Pick<Guest, "name" | "locale" | "section">, token: string): string {
  const v = templateValues(event, guest, token);
  const link = invitationUrl(token);
  const ar = `عزيزنا ${v.guest_name}، يسعد ${v.host_names_ar} معرفة إمكانية حضوركم ${v.event_name_ar} يوم ${v.event_date_ar}.`;
  const en = `Dear ${v.guest_name}, ${v.host_names} would love to know whether you can join them for ${v.event_name} on ${v.event_date}.`;
  const l = lang(event, guest);
  if (l === "ar") return `${ar}\n\nنرجو تأكيد ردّكم من دعوتكم:\n${link}`;
  if (l === "en") return `${en}\n\nPlease reply on your invitation:\n${link}`;
  return `${ar}\n\n${en}\n\nنرجو تأكيد ردّكم من دعوتكم:\nPlease reply on your invitation:\n${link}`;
}

export type FollowUpKind = "reminder" | "nudge";

export type FollowUpRow = {
  id: string;
  name: string;
  phone: string;
  section: Guest["section"];
  /** Already reminded (by INVTRA or from the host's WhatsApp). */
  doneAt: string | null;
  /** INVTRA reminds this guest itself (day-before reminder only). */
  auto: boolean;
  waUrl: string;
};

/** Guests to remind from the host's own WhatsApp, each with the message ready. */
export async function followUpList(event: Event, kind: FollowUpKind): Promise<FollowUpRow[]> {
  const guests = await db.guest.findMany({
    where: { eventId: event.id, isTest: false, rsvpStatus: kind === "reminder" ? "ACCEPTED" : "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  const list = kind === "reminder" ? guests : guests.filter(invited);
  if (!list.length) return [];
  await ensureInvitations(list);
  const tokens = new Map(
    (await db.invitation.findMany({ where: { guestId: { in: list.map((g) => g.id) } }, select: { guestId: true, token: true } })).map((i) => [i.guestId, i.token]),
  );
  return list.map((g) => {
    const token = tokens.get(g.id)!;
    const text = kind === "reminder" ? reminderText(event, g, token) : nudgeText(event, g, token);
    const doneAt = kind === "reminder" ? g.reminderSentAt : g.nudgedAt;
    return {
      id: g.id,
      name: g.name,
      phone: g.phone,
      section: event.sectionsEnabled ? g.section : null,
      doneAt: doneAt?.toISOString() ?? null,
      auto: kind === "reminder" && event.autoReminder && viaInvtra(g),
      waUrl: whatsappLink(g.phone, text),
    };
  });
}

/** The host opened WhatsApp to remind this guest: count it. */
export async function markFollowUp(event: Event, guestId: string, kind: FollowUpKind) {
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: event.id, isTest: false } });
  if (!guest) throw notFound("Guest");
  const now = new Date();
  await db.guest.update({
    where: { id: guest.id },
    data: kind === "reminder" ? { reminderSentAt: now } : { nudgedAt: now, nudgeCount: { increment: 1 } },
  });
  return { id: guest.id, doneAt: now.toISOString() };
}
