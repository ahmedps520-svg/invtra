import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { DeliveryChannel, OrderDeliveryStatus } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { logError } from "@/server/log";
import { sendEmail } from "@/server/email";
import { renderEmail, renderEmailText } from "@/server/email-template";
import { storage } from "@/server/storage";
import { notify } from "@/server/notifications";
import { renderSvgToPng } from "@/server/render/card";
import { buildEventCardSvg } from "@/server/invitations/render";
import { bankDetails, orderReference } from "@/server/payments/bank";
import { whatsapp } from "@/server/whatsapp";
import { whatsappAccountStatus } from "@/server/whatsapp/account";
import { WhatsAppApiError, WhatsAppOptedOutError } from "@/server/whatsapp/errors";
import type { MessageContent, TemplateComponent } from "@/server/whatsapp/types";
import { enqueue, PermanentJobError } from "@/server/queue/queue";
import { adminRecipients } from "@/server/admin/recipients";
import { isTemplateButtons, renderTemplateBody, sanitizeParam, type TemplateVariable } from "@/lib/whatsapp/templates";
import { toWhatsAppId } from "@/lib/phone";
import { hasGuests, needsProduction } from "@/lib/products";
import { moveStage, orderHref } from "./service";
import { saveFinalFile, signedDownloadUrl } from "./files";
import { adminNewOrderEmail, orderDeliveredEmail, orderInfoEmail, orderInProductionEmail, orderRejectedEmail, orderSubmittedEmail } from "./emails";

/**
 * After staff approve the payment (queue jobs, so nothing is lost if a step fails):
 *   order.fulfil  — renders the final full-quality file, or hands a custom design to the designers
 *   order.deliver — email with secure download links, WhatsApp (only when INVTRA's account may
 *                   send and the customer opted in), and an in-app notification.
 * Each channel has one OrderDelivery row: a channel that worked is never repeated, one that
 * failed is recorded with the reason (and retried), and one failing never holds up the others.
 */

const include = { user: { select: { name: true, email: true, locale: true, phone: true, whatsappUpdatesAt: true } }, event: true } as const;

async function loadOrder(orderId: string) {
  return db.order.findUnique({ where: { id: orderId }, include });
}

// ── order.fulfil ────────────────────────────────────────────────────────────

/** The full-quality invitation image from the event's design (no personal QR code). */
async function renderFinal(event: NonNullable<Awaited<ReturnType<typeof loadOrder>>>["event"]): Promise<Buffer> {
  const svg = await buildEventCardSvg(event!, { guest: null, qrText: null, qrPlaceholder: false });
  const width = event!.imageMode === "CUSTOM" ? Math.max(1080, event!.customImageWidth ?? 1600) : 2160;
  return renderSvgToPng(svg, width);
}

export async function fulfilOrder(orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || !order.product || order.status !== "PAID" || order.stage !== "APPROVED") return; // moved on already
  const source = order.designSource ?? "TEMPLATE";

  if (needsProduction(order.product, source)) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (fresh.stage !== "APPROVED") return;
      const { history } = await moveStage(tx, fresh, "IN_PRODUCTION", null, { note: "Handed to the design team" });
      await notify(tx, {
        userId: order.userId,
        kind: "order.in_production",
        href: orderHref(orderId),
        dedupeKey: `order.in_production:${orderId}`,
        data: { reference: orderReference(orderId), title: order.event?.title ?? null },
      });
      await enqueue("order.email", { orderId, kind: "in_production" }, { tx, dedupeKey: `order.email:in_production:${history.id}` });
    });
    return;
  }

  if (!order.event) throw new PermanentJobError("The order's event no longer exists");
  // Rendered once: a retry after a crash reuses the file already saved.
  const existing = await db.orderFile.count({ where: { orderId, kind: "FINAL" } });
  if (!existing) {
    const png = await renderFinal(order.event);
    const slug =
      order.event.title
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "invitation";
    await saveFinalFile(order, { name: `${slug}-invtra.png`, data: png }, null);
  }
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (fresh.stage !== "APPROVED") return;
    await moveStage(tx, fresh, "READY", null, { note: "Final file rendered", data: { readyAt: new Date() } });
    await enqueue("order.deliver", { orderId }, { tx, dedupeKey: `order.deliver:${orderId}`, eventId: order.eventId ?? undefined });
  });
}

// ── order.deliver ───────────────────────────────────────────────────────────

/**
 * A custom design for a digital invitation becomes the event's invitation image, so guests
 * receive it. Done once per order (the copy's key names the order).
 */
async function applyFinalAsInvitation(order: NonNullable<Awaited<ReturnType<typeof loadOrder>>>) {
  const event = order.event;
  if (!event || !order.product || !hasGuests(order.product) || !needsProduction(order.product, order.designSource ?? "TEMPLATE")) return;
  if (event.customImageKey?.includes(`/order-${order.id}-`)) return;
  const file = await db.orderFile.findFirst({ where: { orderId: order.id, kind: "FINAL", mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "asc" } });
  if (!file) return;
  const data = await storage().get(file.key);
  if (!data) return;
  const out = await sharp(data, { limitInputPixels: 200_000_000 })
    .rotate()
    .resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const key = `u/${event.userId}/${event.id}/custom_invitation/order-${order.id}-${randomBytes(6).toString("hex")}.jpg`;
  await storage().put(key, out.data, "image/jpeg");
  await db.upload.create({
    data: {
      userId: event.userId,
      eventId: event.id,
      kind: "CUSTOM_INVITATION",
      key,
      mimeType: "image/jpeg",
      size: out.data.length,
      width: out.info.width,
      height: out.info.height,
    },
  });
  await db.event.update({
    where: { id: event.id },
    data: { imageMode: "CUSTOM", customImageKey: key, customImageWidth: out.info.width, customImageHeight: out.info.height, contentVersion: { increment: 1 } },
  });
}

/** Takes a channel for this run, so two runs at once never both send. */
async function claim(id: string, attempts: number): Promise<boolean> {
  const r = await db.orderDelivery.updateMany({ where: { id, attempts, status: { in: ["PENDING", "FAILED"] } }, data: { attempts: { increment: 1 } } });
  return r.count === 1;
}

async function settle(id: string, status: OrderDeliveryStatus, error?: string | null) {
  await db.orderDelivery.update({ where: { id }, data: { status, error: error?.slice(0, 500) ?? null, ...(status === "SENT" ? { sentAt: new Date() } : {}) } });
}

type WaOutcome = { status: OrderDeliveryStatus; error?: string };

/** "Your order is ready" on WhatsApp — only through INVTRA's approved template, to customers who opted in. */
async function sendOrderWhatsApp(order: NonNullable<Awaited<ReturnType<typeof loadOrder>>>): Promise<WaOutcome> {
  const e = env();
  if (e.WHATSAPP_PROVIDER === "off") return { status: "SKIPPED", error: "INVTRA's WhatsApp number isn't connected" };
  if (!order.user.whatsappUpdatesAt) return { status: "SKIPPED", error: "The customer didn't ask for WhatsApp updates" };
  if (!order.user.phone) return { status: "SKIPPED", error: "The customer has no WhatsApp number" };
  if (e.WHATSAPP_PROVIDER === "cloud") {
    const account = await whatsappAccountStatus();
    if (!account.ok) return { status: "SKIPPED", error: `INVTRA's WhatsApp account can't send yet (${account.problems.join(", ")})` };
  }
  const locale = order.user.locale === "ar" ? "ar" : "en";
  const candidates = await db.messageTemplate.findMany({
    where: { purpose: "ORDER_UPDATE", status: "APPROVED", isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const template = candidates.find((t) => t.locale === locale) ?? candidates.find((t) => t.locale === "en") ?? candidates[0];
  if (!template) return { status: "SKIPPED", error: "No approved order-update template (Admin → Templates)" };

  const values: Partial<Record<TemplateVariable, string>> = {
    customer_name: order.user.name,
    order_reference: orderReference(order.id),
    event_name: order.event?.title ?? "INVTRA",
    event_name_ar: order.event?.titleAr || order.event?.title || "إنفترا",
  };
  const variables = (template.variables ?? []) as TemplateVariable[];
  const buttons = isTemplateButtons(template.buttons) ? template.buttons : [];
  const components: TemplateComponent[] = [];
  if (variables.length) components.push({ type: "body", parameters: variables.map((v) => ({ type: "text" as const, text: sanitizeParam(values[v] ?? "") })) });
  buttons.forEach((b, index) => {
    if (b.type === "URL" && b.url.includes("{{1}}"))
      components.push({ type: "button", sub_type: "url", index: String(index), parameters: [{ type: "text", text: order.id }] });
  });
  const content: MessageContent = {
    kind: "template",
    templateName: template.metaName,
    language: template.language,
    body: renderTemplateBody({ body: template.body, variables }, values),
    footer: template.footer,
    buttons: buttons.map((b) =>
      b.type === "URL" ? { type: "URL" as const, text: b.text, url: b.url.replace("{{1}}", order.id) } : { type: "QUICK_REPLY" as const, text: b.text },
    ),
  };
  const provider = whatsapp();
  const message = await db.whatsAppMessage.create({
    data: {
      eventId: order.eventId,
      direction: "OUTBOUND",
      purpose: "ORDER_UPDATE",
      provider: provider.name,
      phone: order.user.phone,
      type: "template",
      status: "QUEUED",
      content: content as object,
    },
  });
  try {
    const sent = await provider.sendTemplate({
      to: toWhatsAppId(order.user.phone),
      templateName: template.metaName,
      languageCode: template.language,
      components,
    });
    await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: "SENT", waMessageId: sent.messageId, sentAt: new Date() } });
    return { status: "SENT" };
  } catch (err) {
    const m = (err as Error).message;
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorCode: err instanceof WhatsAppApiError && err.code !== null ? String(err.code) : null,
        errorMessage: m.slice(0, 500),
      },
    });
    if (err instanceof WhatsAppOptedOutError) return { status: "SKIPPED", error: "The customer stopped WhatsApp messages from INVTRA" };
    return { status: "FAILED", error: m };
  }
}

const CHANNELS: DeliveryChannel[] = ["IN_APP", "EMAIL", "WHATSAPP"];

export async function deliverOrder(orderId: string) {
  const order = await loadOrder(orderId);
  if (!order || !order.product || order.status !== "PAID" || (order.stage !== "READY" && order.stage !== "DELIVERED")) return;
  const files = await db.orderFile.findMany({ where: { orderId, kind: "FINAL" }, orderBy: { createdAt: "asc" } });
  if (!files.length) throw new PermanentJobError("The order has no final files to deliver");

  try {
    await applyFinalAsInvitation(order);
  } catch (err) {
    await logError("orders:final-design", err, { orderId });
  }

  await db.orderDelivery.createMany({ data: CHANNELS.map((channel) => ({ orderId, channel })), skipDuplicates: true });
  const rows = await db.orderDelivery.findMany({ where: { orderId } });
  let emailFailed: string | null = null;

  for (const row of rows) {
    if (row.status === "SENT" || row.status === "SKIPPED") continue;
    if (!(await claim(row.id, row.attempts))) continue;
    try {
      if (row.channel === "IN_APP") {
        await notify(db, {
          userId: order.userId,
          kind: "order.delivered",
          href: orderHref(orderId),
          dedupeKey: `order.delivered:${orderId}`,
          data: { reference: orderReference(orderId), title: order.event?.title ?? null },
        });
        await settle(row.id, "SENT");
      } else if (row.channel === "EMAIL") {
        const mail = orderDeliveredEmail(
          order,
          files.map((f) => ({ name: f.name, url: signedDownloadUrl(f.id) })),
          { guests: hasGuests(order.product) },
        );
        await sendEmail({ to: order.user.email, subject: mail.subject, text: renderEmailText(mail), html: renderEmail(mail) });
        await settle(row.id, "SENT");
      } else {
        const r = await sendOrderWhatsApp(order);
        await settle(row.id, r.status, r.error);
      }
    } catch (err) {
      const message = (err as Error).message;
      await settle(row.id, "FAILED", message);
      await logError(`orders:deliver:${row.channel.toLowerCase()}`, err, { orderId });
      if (row.channel === "EMAIL") emailFailed = message;
    }
  }

  // Delivered once the email with the files has gone out (WhatsApp is a bonus, never required).
  const email = await db.orderDelivery.findUnique({ where: { orderId_channel: { orderId, channel: "EMAIL" } } });
  if (email?.status === "SENT") {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (fresh.stage === "READY") await moveStage(tx, fresh, "DELIVERED", null, { note: "Files sent by email", data: { deliveredAt: new Date() } });
    });
  }
  // The job is retried for the email; the channels that worked aren't repeated.
  if (emailFailed) throw new Error(`Email delivery failed: ${emailFailed}`);
}

// ── order.email ─────────────────────────────────────────────────────────────

export type OrderEmailKind = "submitted" | "admin_new" | "rejected" | "info_required" | "in_production";

export async function sendOrderEmail(orderId: string, kind: OrderEmailKind) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { name: true, email: true, locale: true } }, event: { select: { title: true, titleAr: true } } },
  });
  if (!order) return;
  if (kind === "admin_new") {
    const resubmitted = (await db.orderHistory.count({ where: { orderId, to: "PENDING_VERIFICATION" } })) > 1;
    const mail = adminNewOrderEmail(order, { resubmitted });
    for (const to of await adminRecipients()) await sendEmail({ to, subject: mail.subject, text: renderEmailText(mail), html: renderEmail(mail) });
    return;
  }
  const mail =
    kind === "submitted"
      ? orderSubmittedEmail(order, await bankDetails())
      : kind === "rejected"
        ? orderRejectedEmail(order, order.rejectionReason ?? "")
        : kind === "info_required"
          ? orderInfoEmail(order, order.infoRequest ?? "")
          : orderInProductionEmail(order);
  await sendEmail({ to: order.user.email, subject: mail.subject, text: renderEmailText(mail), html: renderEmail(mail) });
}
