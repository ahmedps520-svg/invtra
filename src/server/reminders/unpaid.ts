import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { logError } from "@/server/log";
import { hmac, safeEqual } from "@/server/security/tokens";
import { sendEmail } from "@/server/email";
import { renderEmail, renderEmailText } from "@/server/email-template";
import { unpaidReminderEmail } from "@/server/emails";
import { enqueue } from "@/server/queue/queue";
import { planCatalogue } from "@/server/payments/service";
import { formatMoney } from "@/lib/format";

/**
 * "Your invitation is ready to send": a reminder email for events that were designed but never
 * given a plan — a day after the event was created, and once more three days later. Only for
 * verified emails, upcoming events and hosts who haven't turned these off; sent in the daytime
 * (Riyadh), at most one a day per person, and never while a bank transfer is on its way.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** After the event is created / after the first reminder. */
export const FIRST_AFTER = DAY;
export const SECOND_AFTER = 3 * DAY;
export const MAX_REMINDERS = 2;

// ── Signed links (no sign-in needed: they're opened from the email) ─────────

export function cardImageUrl(eventId: string) {
  return appUrl(`/e/${eventId}/card?s=${hmac(`event-card:${eventId}`)}`);
}
export const validCardSignature = (eventId: string, s: string | null) => Boolean(s) && safeEqual(s!, hmac(`event-card:${eventId}`));

export function stopRemindersUrl(userId: string) {
  return appUrl(`/email/stop?u=${encodeURIComponent(userId)}&s=${hmac(`stop-reminders:${userId}`)}`);
}
export function stopRemindersApiUrl(userId: string) {
  return appUrl(`/api/email/stop?u=${encodeURIComponent(userId)}&s=${hmac(`stop-reminders:${userId}`)}`);
}
export const validStopSignature = (userId: string, s: string | null) => Boolean(s) && safeEqual(s!, hmac(`stop-reminders:${userId}`));

export async function stopReminders(userId: string) {
  await db.user.updateMany({ where: { id: userId }, data: { emailReminders: false } });
}

// ── Scheduling ──────────────────────────────────────────────────────────────

function riyadhHour(now: Date) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** Pick the events due a reminder and queue one email each. Returns how many were queued. */
export async function queueUnpaidReminders(now = new Date()): Promise<number> {
  const hour = riyadhHour(now);
  if (hour < 9 || hour >= 21) return 0;
  const candidates = await db.event.findMany({
    where: {
      plan: null,
      deletedAt: null,
      deactivatedAt: null,
      custom: false,
      payReminders: { lt: MAX_REMINDERS },
      createdAt: { lte: new Date(now.getTime() - FIRST_AFTER) },
      OR: [{ dateTbd: true }, { startsAt: { gt: new Date(now.getTime() + DAY) } }],
      user: { status: "ACTIVE", role: "CUSTOMER", emailVerifiedAt: { not: null }, emailReminders: true },
      purchasedAt: null,
      // Paying by bank transfer right now, or an order is with staff: don't nag.
      orders: { none: {
          OR: [
            { status: "PENDING", createdAt: { gt: new Date(now.getTime() - 7 * DAY) } },
            { status: "PENDING", stage: { in: ["SUBMITTED", "PENDING_VERIFICATION", "INFO_REQUIRED"] } },
          ],
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, userId: true, payReminders: true, payRemindedAt: true },
    take: 500,
  });
  const due = candidates.filter((e) => e.payReminders === 0 || (e.payRemindedAt && e.payRemindedAt.getTime() <= now.getTime() - SECOND_AFTER));
  if (!due.length) return 0;

  // One reminder a day per person: their most recently edited event, unless they had one today.
  const recent = await db.event.groupBy({
    by: ["userId"],
    where: { userId: { in: [...new Set(due.map((e) => e.userId))] }, payRemindedAt: { gt: new Date(now.getTime() - DAY) } },
    _count: { _all: true },
  });
  const remindedToday = new Set(recent.map((r) => r.userId));
  const picked = new Map<string, (typeof due)[number]>();
  for (const e of due) if (!remindedToday.has(e.userId) && !picked.has(e.userId)) picked.set(e.userId, e);

  let queued = 0;
  for (const e of picked.values()) {
    // Claim it, so two workers never send the same reminder.
    const claimed = await db.event.updateMany({
      where: { id: e.id, payReminders: e.payReminders },
      data: { payReminders: e.payReminders + 1, payRemindedAt: now },
    });
    if (!claimed.count) continue;
    await enqueue("event.unpaid_reminder", { eventId: e.id, n: e.payReminders + 1 }, { eventId: e.id, dedupeKey: `unpaid:${e.id}:${e.payReminders + 1}` });
    queued++;
  }
  return queued;
}

/** The queued email, checked again at send time (the host may have bought a plan meanwhile). */
export async function sendUnpaidReminder(eventId: string, n: number) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { user: true, _count: { select: { guests: { where: { isTest: false } } } } },
  });
  if (!event || event.plan || event.deletedAt || event.deactivatedAt) return;
  const u = event.user;
  if (u.status !== "ACTIVE" || !u.emailVerifiedAt || !u.emailReminders) return;
  const ar = u.locale === "ar";
  const catalogue = planCatalogue();
  const from = Math.min(...catalogue.plans.map((p) => p.price ?? Infinity));
  const mail = unpaidReminderEmail({
    name: u.name,
    locale: u.locale,
    event: (ar ? event.titleAr || event.title : event.title) || "INVTRA",
    n,
    // The order wizard's review step (price and the protected preview), then payment.
    reviewUrl: appUrl(`/dashboard/events/${event.id}/summary`),
    designUrl: appUrl(`/dashboard/events/${event.id}/design`),
    cardUrl: cardImageUrl(event.id),
    priceFrom: Number.isFinite(from) ? formatMoney(from, catalogue.currency, ar ? "ar" : "en") : "",
    guests: event._count.guests,
    stopUrl: stopRemindersUrl(u.id),
  });
  try {
    await sendEmail({ to: u.email, subject: mail.subject, text: renderEmailText(mail), html: renderEmail(mail), unsubscribe: stopRemindersApiUrl(u.id) });
  } catch (e) {
    await logError("email:unpaid-reminder", e, { eventId });
    throw e;
  }
}
