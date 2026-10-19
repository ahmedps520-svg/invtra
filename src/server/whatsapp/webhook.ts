import { Prisma, type MessageStatus } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logError } from "@/server/log";
import { recordActivity } from "@/server/activity";
import { isDeliveryProgress, updateGuest } from "@/server/guests/status";
import { enqueue, PRIORITY } from "@/server/queue/queue";
import { respond } from "@/server/rsvp";
import { fromWhatsAppId } from "@/lib/phone";
import { optOutKeyword, parseButtonPayload } from "@/lib/whatsapp/templates";
import { failureReason } from "./errors";
import { invalidateAccountStatus } from "./account";
import { verifyWebhookSignature } from "./signature";

/**
 * WhatsApp Cloud API webhook processing.
 *
 *  - Signature (X-Hub-Signature-256, HMAC of the raw body with the App Secret) is
 *    verified before anything is parsed.
 *  - Every inbound message / status is de-duplicated (Meta retries deliveries).
 *  - Button presses drive the RSVP state machine; heavy work (rendering the image,
 *    uploading media, sending) is queued so the webhook answers within milliseconds.
 */

type WaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | "deleted";
  timestamp?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
};

type WaMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  context?: { id?: string; from?: string };
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
};

type WaTemplateUpdate = {
  event?: string;
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string | null;
};

type WaPayload = {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: { metadata?: { phone_number_id?: string }; statuses?: WaStatus[]; messages?: WaMessage[] } & WaTemplateUpdate;
    }[];
  }[];
};

/** Webhook fields that mean the account's ability to send may have changed. */
const ACCOUNT_FIELDS = new Set(["account_update", "account_review_update", "phone_number_name_update", "phone_number_quality_update", "business_capability_update"]);

export async function handleWhatsAppWebhook(rawBody: string, signature: string | null): Promise<{ status: number; body?: string }> {
  const secret = env().WHATSAPP_APP_SECRET;
  if (!secret || !verifyWebhookSignature(rawBody, signature, secret)) {
    await logError("webhook:whatsapp", new Error("Rejected webhook with invalid signature"), undefined, "warn");
    return { status: 401 };
  }
  let payload: WaPayload;
  try {
    payload = JSON.parse(rawBody) as WaPayload;
  } catch {
    return { status: 400 };
  }
  if (payload.object !== "whatsapp_business_account") return { status: 200 };

  const e = env();
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (!change.value || !change.field) continue;
      if (change.field === "message_template_status_update") {
        const v = change.value;
        await once(`wa:tpl:${v.message_template_id}:${v.event}`, v, () => handleTemplateStatus(v));
        continue;
      }
      if (ACCOUNT_FIELDS.has(change.field)) {
        await invalidateAccountStatus(); // re-checked with Meta before the next send
        continue;
      }
      if (change.field !== "messages") continue;
      // Only INVTRA's own number: events for any other number on the same Meta app are ignored.
      const forNumber = change.value.metadata?.phone_number_id;
      if (e.WHATSAPP_PROVIDER === "cloud" && forNumber && forNumber !== e.WHATSAPP_PHONE_NUMBER_ID) continue;
      for (const st of change.value.statuses ?? []) await once(`wa:st:${st.id}:${st.status}`, st, () => handleStatus(st));
      for (const msg of change.value.messages ?? []) await once(`wa:in:${msg.id}`, msg, () => handleInbound(msg));
    }
  }
  return { status: 200 };
}

/** Run `fn` at most once per dedupe key. Failures are recorded and re-thrown so Meta retries. */
async function once(key: string, data: unknown, fn: () => Promise<void>) {
  try {
    await db.webhookEvent.create({ data: { provider: "whatsapp", dedupeKey: key, payload: data as Prisma.InputJsonValue } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const prior = await db.webhookEvent.findUnique({ where: { dedupeKey: key } });
      if (prior?.processedAt) return; // already handled
      if (prior && Date.now() - prior.createdAt.getTime() < 60_000 && !prior.error) return; // in flight elsewhere
    } else throw e;
  }
  try {
    await fn();
    await db.webhookEvent.update({ where: { dedupeKey: key }, data: { processedAt: new Date(), error: null } });
  } catch (e) {
    await db.webhookEvent.update({ where: { dedupeKey: key }, data: { error: (e as Error).message.slice(0, 1000) } }).catch(() => undefined);
    await logError("webhook:whatsapp", e, { key });
    throw e;
  }
}

const STATUS_MAP: Record<string, MessageStatus | undefined> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};
const RANK: Record<MessageStatus, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4, RECEIVED: 0 };

async function handleStatus(st: WaStatus) {
  const next = STATUS_MAP[st.status];
  if (!next) return;
  const msg = await db.whatsAppMessage.findUnique({ where: { waMessageId: st.id } });
  if (!msg) return; // not ours (or sent before INVTRA tracked it)
  const at = st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date();
  const err = st.errors?.[0];
  const forward = next === "FAILED" ? msg.status !== "DELIVERED" && msg.status !== "READ" : RANK[next] > RANK[msg.status];
  if (forward) {
    await db.whatsAppMessage.update({
      where: { id: msg.id },
      data: {
        status: next,
        ...(next === "SENT" ? { sentAt: msg.sentAt ?? at } : {}),
        ...(next === "DELIVERED" ? { deliveredAt: at } : {}),
        ...(next === "READ" ? { readAt: at } : {}),
        ...(next === "FAILED"
          ? { failedAt: at, errorCode: err?.code ? String(err.code) : null, errorMessage: (err?.error_data?.details ?? err?.message ?? err?.title ?? "Delivery failed").slice(0, 500) }
          : {}),
      },
    });
  }
  if (!msg.guestId) return;
  const guest = await db.guest.findUnique({ where: { id: msg.guestId } });
  if (!guest) return;

  if (msg.purpose === "INVITATION_REQUEST") {
    if (!isDeliveryProgress(guest.deliveryStatus, next as Parameters<typeof isDeliveryProgress>[1])) return;
    const reason = next === "FAILED" ? failureReason(err?.code ?? null) : null;
    await updateGuest(db, guest.id, {
      deliveryStatus: next as "SENT" | "DELIVERED" | "READ" | "FAILED",
      ...(next === "FAILED" ? { deliveryError: reason, deliveryErrorCode: err?.code ? String(err.code) : null } : {}),
      lastActivityAt: new Date(),
    });
    if (next === "FAILED" && msg.eventId) {
      await recordActivity(db, msg.eventId, "guest.message_failed", { name: guest.name, reason }, guest.id);
    }
  } else if ((msg.purpose === "INVITATION_DELIVERY" || msg.purpose === "UPDATE") && next === "FAILED") {
    const reason = failureReason(err?.code ?? null);
    await updateGuest(db, guest.id, { invitationSentAt: null, deliveryError: reason, deliveryErrorCode: err?.code ? String(err.code) : null });
    if (msg.eventId) await recordActivity(db, msg.eventId, "guest.invitation_failed", { name: guest.name, reason }, guest.id);
  }
}

async function handleInbound(m: WaMessage) {
  const phone = fromWhatsAppId(m.from);
  const payloadStr = m.type === "button" ? m.button?.payload : m.type === "interactive" ? m.interactive?.button_reply?.id : undefined;
  const parsed = parseButtonPayload(payloadStr);

  // Associate the message with a guest: by button payload, else by the message it replies to.
  let guestId: string | null = null;
  let eventId: string | null = null;
  if (parsed) {
    const inv = await db.invitation.findUnique({ where: { token: parsed.token }, include: { guest: true } });
    if (inv && inv.guest.phone === phone) {
      guestId = inv.guestId;
      eventId = inv.eventId;
    } else if (inv) {
      await logError("webhook:whatsapp", new Error("Button payload phone mismatch — ignored"), { token: parsed.token }, "warn");
    }
  } else if (m.context?.id) {
    const original = await db.whatsAppMessage.findUnique({ where: { waMessageId: m.context.id } });
    if (original?.guestId && original.phone === phone) {
      guestId = original.guestId;
      eventId = original.eventId;
    }
  }

  await db.whatsAppMessage.create({
    data: {
      direction: "INBOUND",
      purpose: "REPLY",
      provider: env().WHATSAPP_PROVIDER,
      waMessageId: m.id,
      phone,
      type: m.type,
      status: "RECEIVED",
      guestId,
      eventId,
      content: {
        kind: "text",
        body: m.button?.text ?? m.interactive?.button_reply?.title ?? m.text?.body ?? `[${m.type}]`,
        payload: payloadStr ?? null,
      },
    },
  });
  // "Stop messages" (button) or a plain STOP / START reply: honoured for the number, from any event.
  const optOut = parsed?.action === "STOP" ? "STOP" : parsed ? null : optOutKeyword(m.text?.body ?? m.button?.text);
  if (optOut) {
    await setOptOut(phone, optOut, parsed ? "button" : "keyword", m.id);
    if (optOut === "STOP" && guestId && eventId) {
      const guest = await db.guest.findUnique({ where: { id: guestId }, select: { name: true } });
      await recordActivity(db, eventId, "guest.opted_out", { name: guest?.name ?? "" }, guestId);
    }
    return;
  }
  if (!guestId) return;

  // Any message from the guest opens WhatsApp's 24-hour customer-service window.
  await db.guest.update({ where: { id: guestId }, data: { lastInboundAt: new Date(), lastActivityAt: new Date() } });
  if (!parsed) return;

  const outcome = await respond({
    guestId,
    response: parsed.action === "ACCEPT" ? "ACCEPTED" : "DECLINED",
    source: "WHATSAPP",
  });

  switch (outcome.kind) {
    case "closed":
    case "deadline":
      await enqueue("invitation.notice", { guestId, key: outcome.kind }, { priority: PRIORITY.interactive, eventId, dedupeKey: `notice:${m.id}` });
      return;
    case "changed":
      if (outcome.guest.rsvpStatus === "ACCEPTED") {
        // Accepted → send the personalised invitation image + QR immediately.
        await enqueue("invitation.deliver", { guestId, reason: "accepted" }, { priority: PRIORITY.interactive, eventId, dedupeKey: `deliver:${m.id}` });
      } else {
        // Declined → acknowledge only. Never send the invitation image or QR.
        await enqueue("invitation.decline_ack", { guestId }, { priority: PRIORITY.interactive, eventId, dedupeKey: `ack:${m.id}` });
      }
      return;
    case "unchanged":
      // Accept pressed again: re-send the invitation, at most once per 10 minutes.
      if (outcome.guest.rsvpStatus === "ACCEPTED") {
        const bucket = Math.floor(Date.now() / 600_000);
        await enqueue("invitation.deliver", { guestId, reason: "repeat" }, { priority: PRIORITY.interactive, eventId, dedupeKey: `deliver:${guestId}:${bucket}` });
      }
      return;
  }
}

/**
 * A number asks to stop (or start again) receiving WhatsApp messages from INVTRA. Stopping also
 * cancels anything already queued for that number; either way they get a short confirmation
 * (they've just written to us, so WhatsApp's reply window is open).
 */
async function setOptOut(phone: string, action: "STOP" | "START", source: "button" | "keyword", messageId: string) {
  if (action === "STOP") {
    await db.whatsAppOptOut.upsert({ where: { phone }, create: { phone, source }, update: {} });
    const guests = await db.guest.findMany({ where: { phone }, select: { id: true } });
    for (const g of guests) {
      await db.job.updateMany({
        where: { status: "PENDING", payload: { path: ["guestId"], equals: g.id } },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
    }
  } else {
    await db.whatsAppOptOut.deleteMany({ where: { phone } });
  }
  await enqueue("whatsapp.opt_out_ack", { phone, action }, { priority: PRIORITY.interactive, dedupeKey: `optout:${messageId}` });
}

const TEMPLATE_EVENT: Record<string, "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" | undefined> = {
  APPROVED: "APPROVED",
  REINSTATED: "APPROVED",
  REJECTED: "REJECTED",
  PAUSED: "PAUSED",
  DISABLED: "DISABLED",
  PENDING_DELETION: "DISABLED",
  DELETED: "DISABLED",
};

/** Meta reviewed (or paused, or disabled) a template: keep the local status in step. */
async function handleTemplateStatus(v: WaTemplateUpdate) {
  const status = v.event ? TEMPLATE_EVENT[v.event] : undefined;
  if (!status || v.message_template_id === undefined) return;
  await db.messageTemplate.updateMany({
    where: { metaTemplateId: String(v.message_template_id) },
    data: { status, rejectedReason: status === "REJECTED" ? (v.reason ?? "Rejected by Meta") : null, lastSyncedAt: new Date() },
  });
}
