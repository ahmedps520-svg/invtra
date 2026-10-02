import type { Event, Guest } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { badRequest, conflict } from "@/server/http";
import { recordActivity } from "@/server/activity";
import { ensureInvitations } from "@/server/invitations";
import { enqueue, enqueueMany, PRIORITY } from "@/server/queue/queue";
import { pickTemplate } from "@/server/whatsapp/compose";
import { normalizePhone } from "@/lib/phone";
import { planAllowsTheme, TEST_SEND_LIMIT } from "@/lib/plans";
import { getTheme } from "@/lib/themes/registry";
import { defaultCountryFor } from "@/server/guests/service";
import { cancelBatch } from "./batch";

export type ReadinessCheck = {
  key: "details" | "date" | "design" | "guests" | "template" | "plan" | "theme_plan" | "whatsapp";
  ok: boolean;
  detail?: Record<string, string | number>;
};

/** Everything that must be true before invitations can go out (shown on the Review step). */
export async function sendReadiness(event: Event) {
  const [guestCount, unsent, template, themeRow] = await Promise.all([
    db.guest.count({ where: { eventId: event.id, isTest: false } }),
    db.guest.count({ where: { eventId: event.id, isTest: false, rsvpStatus: "PENDING", deliveryStatus: "NOT_SENT" } }),
    pickTemplate(event, { locale: null }, "INVITATION"),
    db.invitationTheme.findUnique({ where: { key: event.themeKey } }),
  ]);
  const premiumTheme = themeRow?.isPremium ?? getTheme(event.themeKey).premium;
  const e = env();
  const whatsappReady =
    e.WHATSAPP_PROVIDER === "mock" || Boolean(e.WHATSAPP_ACCESS_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_APP_SECRET);
  const checks: ReadinessCheck[] = [
    { key: "details", ok: Boolean(event.title && event.hostNames && event.venueName && event.address) },
    { key: "date", ok: event.startsAt > new Date() },
    { key: "design", ok: event.imageMode === "GENERATED" || Boolean(event.customImageKey) },
    { key: "guests", ok: guestCount > 0, detail: { total: guestCount, unsent } },
    { key: "template", ok: Boolean(template), detail: template ? { name: template.name } : {} },
    {
      key: "plan",
      ok: Boolean(event.plan) && event.guestLimit >= guestCount,
      detail: { limit: event.guestLimit, total: guestCount, plan: event.plan ?? "" },
    },
    { key: "theme_plan", ok: planAllowsTheme(event.plan, premiumTheme) || !event.plan },
    { key: "whatsapp", ok: whatsappReady },
  ];
  return { ready: checks.every((c) => c.ok), checks, unsent, guestCount, template };
}

/**
 * Queue the Accept/Decline message for every guest who hasn't been messaged yet.
 * Messages are sent by the background worker — never from the browser.
 */
export async function startInitialBatch(userId: string, event: Event) {
  const readiness = await sendReadiness(event);
  if (!readiness.ready) throw badRequest("not_ready", "This event isn't ready to send yet.", Object.fromEntries(readiness.checks.filter((c) => !c.ok).map((c) => [c.key, "not_ready"])));
  const running = await db.sendBatch.findFirst({ where: { eventId: event.id, status: { in: ["QUEUED", "RUNNING"] }, kind: { in: ["INITIAL", "RESEND"] } } });
  if (running) throw conflict("batch_running", "Invitations are already being sent.");
  const guests = await db.guest.findMany({
    where: { eventId: event.id, isTest: false, rsvpStatus: "PENDING", deliveryStatus: "NOT_SENT" },
    select: { id: true, eventId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!guests.length) throw badRequest("nothing_to_send", "Every guest has already been sent an invitation.");
  return createRequestBatch(userId, event, guests, "INITIAL");
}

async function createRequestBatch(userId: string, event: Event, guests: Pick<Guest, "id" | "eventId">[], kind: "INITIAL" | "RESEND" | "TEST") {
  await ensureInvitations(guests);
  const ids = guests.map((g) => g.id);
  const batch = await db.$transaction(async (tx) => {
    const b = await tx.sendBatch.create({
      data: { eventId: event.id, userId, kind, total: guests.length, status: "QUEUED", templateId: event.messageTemplateId },
    });
    await tx.guest.updateMany({ where: { id: { in: ids } }, data: { deliveryStatus: "QUEUED", deliveryError: null, deliveryErrorCode: null } });
    await enqueueMany(
      ids.map((guestId) => ({ type: "invitation.request" as const, payload: { guestId }, batchId: b.id, eventId: event.id, priority: kind === "INITIAL" ? PRIORITY.bulk : PRIORITY.normal })),
      tx,
    );
    if (!event.firstSentAt && kind !== "TEST") await tx.event.update({ where: { id: event.id }, data: { firstSentAt: new Date() } });
    if (kind !== "TEST") await recordActivity(tx, event.id, "batch.started", { batchId: b.id, total: guests.length, kind });
    return b;
  });
  return batch;
}

/**
 * Resend to specific guests:
 *  - no answer yet (or delivery failed) → the Accept/Decline message again
 *  - accepted → their personal invitation image + link again
 *  - declined → skipped (they've answered; the host can change it manually)
 */
export async function resendToGuests(userId: string, event: Event, guestIds: string[]) {
  if (!event.plan) throw badRequest("no_plan", "Choose a plan before sending invitations.");
  const guests = await db.guest.findMany({ where: { eventId: event.id, id: { in: guestIds }, isTest: false } });
  const cooldown = Date.now() - 10 * 60_000;
  const request = guests.filter((g) => g.rsvpStatus === "PENDING" && !(g.requestSentAt && g.requestSentAt.getTime() > cooldown && g.deliveryStatus !== "FAILED"));
  const deliver = guests.filter((g) => g.rsvpStatus === "ACCEPTED");
  let batchId: string | null = null;
  if (request.length) batchId = (await createRequestBatch(userId, event, request, "RESEND")).id;
  for (const g of deliver) {
    await enqueue("invitation.deliver", { guestId: g.id, reason: "resend" }, { priority: PRIORITY.normal, eventId: event.id, dedupeKey: `deliver:${g.id}:${Math.floor(Date.now() / 600_000)}` });
  }
  return { batchId, requested: request.length, redelivered: deliver.length, skipped: guests.length - request.length - deliver.length };
}

/** After the host edits the event: send the updated invitation to everyone who accepted. */
export async function sendUpdateToAccepted(userId: string, event: Event) {
  const guests = await db.guest.findMany({
    where: {
      eventId: event.id,
      isTest: false,
      rsvpStatus: "ACCEPTED",
      OR: [{ invitationSentVersion: { lt: event.contentVersion } }, { invitationSentVersion: null }],
    },
    select: { id: true },
  });
  if (!guests.length) throw badRequest("nothing_to_update", "Every accepted guest already has the latest invitation.");
  const batch = await db.sendBatch.create({ data: { eventId: event.id, userId, kind: "UPDATE", total: guests.length, status: "COMPLETED", sent: guests.length, completedAt: new Date() } });
  await enqueueMany(guests.map((g) => ({ type: "invitation.deliver" as const, payload: { guestId: g.id, reason: "update" }, eventId: event.id, priority: PRIORITY.normal })));
  return { batchId: batch.id, count: guests.length };
}

export async function staleAcceptedCount(event: Pick<Event, "id" | "contentVersion" | "firstSentAt">) {
  if (!event.firstSentAt) return 0;
  return db.guest.count({
    where: { eventId: event.id, isTest: false, rsvpStatus: "ACCEPTED", invitationSentAt: { not: null }, invitationSentVersion: { lt: event.contentVersion } },
  });
}

/**
 * "Send me a test": the full flow (message → Accept → image → QR) to the host's own
 * number, using a hidden test guest. Limited per event before a plan is purchased.
 */
export async function sendTest(userId: string, event: Event, rawPhone: string, name: string) {
  const phone = normalizePhone(rawPhone, defaultCountryFor(event.timezone));
  if (!phone.ok) throw badRequest("invalid_phone", "Enter a valid WhatsApp number.", { phone: "Enter a valid number" });
  if (!event.plan && event.testSendsUsed >= TEST_SEND_LIMIT) {
    throw badRequest("test_limit", `You've used your ${TEST_SEND_LIMIT} free test sends. Choose a plan to continue.`);
  }
  const template = await pickTemplate(event, { locale: null }, "INVITATION");
  if (!template) throw badRequest("no_template", "No approved WhatsApp template is available for this language yet.");
  const existing = await db.guest.findUnique({ where: { eventId_phone: { eventId: event.id, phone: phone.e164 } } });
  if (existing && !existing.isTest) {
    throw conflict("guest_exists", "This number belongs to a guest on your list — use Resend from the guest list instead.");
  }
  const guest = existing
    ? await db.guest.update({
        where: { id: existing.id },
        data: { rsvpStatus: "PENDING", rsvpAt: null, invitationSentAt: null, deliveryStatus: "NOT_SENT", status: "PENDING", name },
      })
    : await db.guest.create({ data: { eventId: event.id, name, phone: phone.e164, isTest: true, allowedCount: 2 } });
  await db.event.update({ where: { id: event.id }, data: { testSendsUsed: { increment: 1 } } });
  const batch = await createRequestBatch(userId, event, [guest], "TEST");
  return { batch, guest };
}

export async function cancelEventBatch(eventId: string, batchId: string) {
  const batch = await db.sendBatch.findFirst({ where: { id: batchId, eventId } });
  if (!batch) throw badRequest("not_found", "Batch not found.");
  if (batch.status === "COMPLETED" || batch.status === "CANCELLED") return batch;
  await cancelBatch(batchId);
  return db.sendBatch.findUnique({ where: { id: batchId } });
}
