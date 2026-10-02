import type { Job } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logError } from "@/server/log";
import { recordActivity } from "@/server/activity";
import { updateGuest } from "@/server/guests/status";
import { ensureInvitation, invitationUrl } from "@/server/invitations";
import { renderPersonalInvitation, renderTeaser } from "@/server/invitations/render";
import { eventIsActive } from "@/server/rsvp";
import { whatsapp, throttleSend } from "@/server/whatsapp";
import { WhatsAppApiError } from "@/server/whatsapp/errors";
import { composeTemplate, deliveryCopy, guestLocale, pickTemplate, systemText, templateValues } from "@/server/whatsapp/compose";
import { signWebhookBody } from "@/server/whatsapp/signature";
import { handleWhatsAppWebhook } from "@/server/whatsapp/webhook";
import type { MessageContent } from "@/server/whatsapp/types";
import { toWhatsAppId } from "@/lib/phone";
import { batchProgress, cancelBatch } from "@/server/sending/batch";
import { enqueue, PermanentJobError, type JobType } from "./queue";

/**
 * Job handlers. A handler either succeeds, throws (→ retried with backoff), or throws
 * PermanentJobError (→ failed immediately). Recipient-level WhatsApp failures are
 * recorded on the guest and do not throw.
 */

const MEDIA_TTL_MS = 25 * 24 * 60 * 60 * 1000; // WhatsApp keeps uploaded media for 30 days
const SERVICE_WINDOW_MS = 23.5 * 60 * 60 * 1000; // free-form messages allowed within 24h of the guest's last message

type Payload = Record<string, unknown>;

export const handlers: Record<JobType, (job: Job, payload: Payload) => Promise<void>> = {
  "invitation.request": (job, p) => sendInvitationRequest(job, String(p.guestId)),
  "invitation.deliver": (job, p) => deliverInvitation(String(p.guestId), String(p.reason ?? "accepted")),
  "invitation.decline_ack": (_job, p) => sendSystemText(String(p.guestId), "decline"),
  "invitation.notice": (_job, p) => sendSystemText(String(p.guestId), p.key === "deadline" ? "deadline" : "closed"),
  "mock.webhook": async (_job, p) => {
    const raw = JSON.stringify(p.body);
    const r = await handleWhatsAppWebhook(raw, signWebhookBody(raw, env().WHATSAPP_APP_SECRET ?? ""));
    if (r.status !== 200) throw new Error(`Mock webhook rejected (${r.status})`);
  },
};

/** Called when a job exhausts its retries. */
export async function onJobFailed(job: Job, error: Error) {
  const p = job.payload as Payload;
  if (job.type === "invitation.request" && p.guestId) {
    const guest = await db.guest.findUnique({ where: { id: String(p.guestId) } });
    if (guest && guest.deliveryStatus === "QUEUED") {
      await updateGuest(db, guest.id, { deliveryStatus: "FAILED", deliveryError: "unknown", deliveryErrorCode: null });
    }
    if (job.batchId) await batchProgress(job.batchId, "failed");
  }
  await logError(`worker:${job.type}`, error, { jobId: job.id, payload: p });
}

// ── Accept / Decline request ────────────────────────────────────────────────

async function sendInvitationRequest(job: Job, guestId: string) {
  const guest = await db.guest.findUnique({ where: { id: guestId }, include: { event: true, invitation: true } });
  const batch = job.batchId ? await db.sendBatch.findUnique({ where: { id: job.batchId } }) : null;
  const skip = async (why: string) => {
    if (guest && guest.deliveryStatus === "QUEUED") {
      await updateGuest(db, guest.id, { deliveryStatus: guest.requestSentAt ? "SENT" : "NOT_SENT" });
    }
    if (job.batchId) await batchProgress(job.batchId, "skipped");
    return why;
  };
  if (!guest) return void (await skip("guest deleted"));
  const event = guest.event;
  if (!eventIsActive(event) || batch?.status === "CANCELLED") return void (await skip("event inactive"));
  // Never ask someone who already answered (unless this is an explicit test).
  if (guest.rsvpStatus !== "PENDING" && !guest.isTest) return void (await skip("already responded"));

  const invitation = guest.invitation ?? (await ensureInvitation(guest));
  const template = await pickTemplate(event, guest, "INVITATION");
  if (!template) {
    await markRequestFailed(guest.id, event.id, job.batchId, "template_unavailable", null, "No approved WhatsApp template is available for this language.");
    if (job.batchId) await cancelBatch(job.batchId, "No approved template");
    await logError("worker:invitation.request", new Error("No approved INVITATION template"), { eventId: event.id, language: event.language });
    return;
  }

  // Header image: the non-personal teaser card, uploaded once per design version.
  let headerMediaId: string | null = null;
  let headerImageKey: string | null = null;
  if (template.headerType === "IMAGE") {
    const teaser = await renderTeaser(event);
    headerImageKey = teaser.key;
    if (event.teaserMediaId && event.teaserMediaVersion === teaser.version && event.teaserMediaExpiresAt && event.teaserMediaExpiresAt > new Date()) {
      headerMediaId = event.teaserMediaId;
    } else {
      const up = await whatsapp().uploadMedia({ data: teaser.png, mimeType: "image/png", filename: "invitation.png" });
      headerMediaId = up.mediaId;
      await db.event.update({
        where: { id: event.id },
        data: { teaserMediaId: up.mediaId, teaserMediaVersion: teaser.version, teaserMediaExpiresAt: new Date(Date.now() + MEDIA_TTL_MS) },
      });
    }
  }

  const values = templateValues(event, guest, invitation.token);
  const { params, content } = composeTemplate(template, values, { to: guest.phone, token: invitation.token, headerMediaId, headerImageKey });

  await throttleSend();
  try {
    const { messageId } = await whatsapp().sendTemplate(params);
    const now = new Date();
    await db.whatsAppMessage.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        batchId: job.batchId,
        direction: "OUTBOUND",
        purpose: "INVITATION_REQUEST",
        provider: whatsapp().name,
        waMessageId: messageId,
        phone: guest.phone,
        type: "template",
        status: "SENT",
        sentAt: now,
        content: content as object,
      },
    });
    await updateGuest(db, guest.id, {
      deliveryStatus: "SENT",
      deliveryError: null,
      deliveryErrorCode: null,
      requestSentAt: now,
      lastActivityAt: now,
    });
    if (job.batchId) await batchProgress(job.batchId, "sent");
    await simulateReceipts(messageId, guest.phone);
  } catch (e) {
    if (e instanceof WhatsAppApiError && !e.retryable) {
      await markRequestFailed(guest.id, event.id, job.batchId, e.reason, e.code, e.message, content);
      if (e.systemic && job.batchId) {
        await cancelBatch(job.batchId, e.message);
        await logError("worker:invitation.request", e, { eventId: event.id, code: e.code });
      }
      return;
    }
    throw e; // transient — retry with backoff
  }
}

async function markRequestFailed(
  guestId: string,
  eventId: string,
  batchId: string | null,
  reason: string,
  code: number | null,
  message: string,
  content?: MessageContent,
) {
  const guest = await db.guest.findUnique({ where: { id: guestId } });
  if (!guest) return;
  await db.whatsAppMessage.create({
    data: {
      eventId,
      guestId,
      batchId,
      direction: "OUTBOUND",
      purpose: "INVITATION_REQUEST",
      provider: whatsapp().name,
      phone: guest.phone,
      type: "template",
      status: "FAILED",
      failedAt: new Date(),
      errorCode: code !== null ? String(code) : reason,
      errorMessage: message.slice(0, 500),
      content: content ? (content as object) : undefined,
    },
  });
  await updateGuest(db, guestId, { deliveryStatus: "FAILED", deliveryError: reason, deliveryErrorCode: code !== null ? String(code) : null, lastActivityAt: new Date() });
  await recordActivity(db, eventId, "guest.message_failed", { name: guest.name, reason }, guestId);
  if (batchId) await batchProgress(batchId, "failed");
}

// ── Personalised invitation (after Accept) ─────────────────────────────────

async function deliverInvitation(guestId: string, reason: string) {
  const guest = await db.guest.findUnique({ where: { id: guestId }, include: { event: true, invitation: true } });
  if (!guest || guest.rsvpStatus !== "ACCEPTED") return; // declined meanwhile → never send the QR
  const event = guest.event;
  if (!eventIsActive(event)) return;
  if (reason === "repeat" && guest.invitationSentAt && Date.now() - guest.invitationSentAt.getTime() < 2 * 60_000) return;

  const invitation = guest.invitation ?? (await ensureInvitation(guest));
  const image = await renderPersonalInvitation(event, guest, invitation);

  let mediaId = invitation.waMediaId;
  if (!mediaId || invitation.waMediaVersion !== image.version || !invitation.waMediaExpiresAt || invitation.waMediaExpiresAt < new Date()) {
    const up = await whatsapp().uploadMedia({ data: image.png, mimeType: "image/png", filename: "invitation.png" });
    mediaId = up.mediaId;
    await db.invitation.update({
      where: { id: invitation.id },
      data: { waMediaId: mediaId, waMediaVersion: image.version, waMediaExpiresAt: new Date(Date.now() + MEDIA_TTL_MS) },
    });
  }

  const locale = guestLocale(event, guest);
  const url = invitationUrl(invitation.token);
  const inWindow = guest.lastInboundAt && Date.now() - guest.lastInboundAt.getTime() < SERVICE_WINDOW_MS;
  let messageId: string;
  let content: MessageContent;
  let purpose: "INVITATION_DELIVERY" | "UPDATE" = "INVITATION_DELIVERY";
  let type = "interactive";

  await throttleSend();
  try {
    if (inWindow) {
      const copy = deliveryCopy(locale, event);
      ({ messageId } = await whatsapp().sendCtaUrl({ to: guest.phone, headerImageMediaId: mediaId, body: copy.body, footer: copy.footer, buttonText: copy.button, url }));
      content = { kind: "cta", headerImageKey: image.key, body: copy.body, footer: copy.footer, buttons: [{ type: "URL", text: copy.button, url }] };
    } else {
      // Outside the 24h window only templates are allowed → approved "invitation update" template.
      const template = await pickTemplate(event, guest, "UPDATE");
      if (!template) throw new PermanentJobError("No approved UPDATE template — cannot message the guest outside the 24-hour window");
      const composed = composeTemplate(template, templateValues(event, guest, invitation.token), {
        to: guest.phone,
        token: invitation.token,
        headerMediaId: mediaId,
        headerImageKey: image.key,
      });
      ({ messageId } = await whatsapp().sendTemplate(composed.params));
      content = composed.content;
      purpose = "UPDATE";
      type = "template";
    }
  } catch (e) {
    if (e instanceof WhatsAppApiError && !e.retryable) {
      await updateGuest(db, guest.id, { deliveryError: e.reason, deliveryErrorCode: e.code !== null ? String(e.code) : null });
      await recordActivity(db, event.id, "guest.invitation_failed", { name: guest.name, reason: e.reason }, guest.id);
      await db.whatsAppMessage.create({
        data: {
          eventId: event.id,
          guestId: guest.id,
          direction: "OUTBOUND",
          purpose,
          provider: whatsapp().name,
          phone: guest.phone,
          type,
          status: "FAILED",
          failedAt: new Date(),
          errorCode: e.code !== null ? String(e.code) : null,
          errorMessage: e.message.slice(0, 500),
        },
      });
      return;
    }
    throw e;
  }

  const now = new Date();
  await db.whatsAppMessage.create({
    data: {
      eventId: event.id,
      guestId: guest.id,
      direction: "OUTBOUND",
      purpose,
      provider: whatsapp().name,
      waMessageId: messageId,
      phone: guest.phone,
      type,
      status: "SENT",
      sentAt: now,
      content: content as object,
    },
  });
  await updateGuest(db, guest.id, {
    invitationSentAt: now,
    invitationSentVersion: event.contentVersion,
    deliveryError: null,
    deliveryErrorCode: null,
    lastActivityAt: now,
  });
  if (reason !== "repeat") {
    await recordActivity(db, event.id, "guest.invitation_sent", { name: guest.name, update: reason === "update" }, guest.id);
  }
  await simulateReceipts(messageId, guest.phone);
}

// ── Plain replies (decline acknowledgement, closed / deadline notices) ─────

async function sendSystemText(guestId: string, key: "decline" | "closed" | "deadline") {
  const guest = await db.guest.findUnique({ where: { id: guestId }, include: { event: true } });
  if (!guest) return;
  if (key === "decline" && guest.rsvpStatus !== "DECLINED") return; // changed their mind meanwhile
  const inWindow = guest.lastInboundAt && Date.now() - guest.lastInboundAt.getTime() < SERVICE_WINDOW_MS;
  if (!inWindow) return; // a courtesy message is never worth a paid template
  const body = systemText(guestLocale(guest.event, guest), key);
  await throttleSend();
  try {
    const { messageId } = await whatsapp().sendText({ to: guest.phone, body });
    await db.whatsAppMessage.create({
      data: {
        eventId: guest.eventId,
        guestId: guest.id,
        direction: "OUTBOUND",
        purpose: key === "decline" ? "DECLINE_ACK" : "OTHER",
        provider: whatsapp().name,
        waMessageId: messageId,
        phone: guest.phone,
        type: "text",
        status: "SENT",
        sentAt: new Date(),
        content: { kind: "text", body },
      },
    });
    await simulateReceipts(messageId, guest.phone);
  } catch (e) {
    if (e instanceof WhatsAppApiError && !e.retryable) return; // courtesy message only
    throw e;
  }
}

// ── Mock provider: simulate Meta's delivery receipts via the real webhook path ──

async function simulateReceipts(messageId: string, phone: string) {
  if (whatsapp().name !== "mock") return;
  const statuses: { status: string; delay: number; errors?: unknown[] }[] = phone.endsWith("0000")
    ? [{ status: "failed", delay: 1200, errors: [{ code: 131026, title: "Message undeliverable", error_data: { details: "Recipient is not a WhatsApp user" } }] }]
    : [
        { status: "sent", delay: 600 },
        { status: "delivered", delay: 1500 },
        { status: "read", delay: 4000 },
      ];
  for (const s of statuses) {
    const body = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "MOCK_WABA",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "INVTRA", phone_number_id: "MOCK" },
                statuses: [
                  {
                    id: messageId,
                    status: s.status,
                    timestamp: String(Math.floor((Date.now() + s.delay) / 1000)),
                    recipient_id: toWhatsAppId(phone),
                    ...(s.errors ? { errors: s.errors } : {}),
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    await enqueue("mock.webhook", { body }, { delayMs: s.delay, maxAttempts: 2 });
  }
}

