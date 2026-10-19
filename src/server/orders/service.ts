import { Prisma, type Event, type Order, type OrderStage } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, conflict, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { enqueue } from "@/server/queue/queue";
import { notify } from "@/server/notifications";
import { applyPaidOrder } from "@/server/payments/service";
import { codeAppliesTo, discountFor, usableCode } from "@/server/payments/promo";
import { isUnlocked } from "@/server/render/preview";
import { orderReference } from "@/server/payments/bank";
import { quoteFor, type OrderLine } from "./pricing";
import { saveFinalFile, saveReceipt } from "./files";
import { CUSTOMER_EDITABLE_STAGES, VERIFIABLE_STAGES, designSourcesFor } from "@/lib/products";

/**
 * Orders from the event wizard, from the customer's draft to the files in their hands:
 *
 *   DRAFT → SUBMITTED → PENDING_VERIFICATION ⇄ INFO_REQUIRED
 *                                ↓ (staff)       ↘ REJECTED (customer can resubmit)
 *                             APPROVED → [IN_PRODUCTION] → READY → DELIVERED
 *
 * Submitting never marks an order paid: staff confirm the bank transfer and approve it
 * explicitly (an uploaded receipt is only evidence). Approval goes through `applyPaidOrder`,
 * the one place an order becomes PAID, which also starts production or delivery. Every step
 * takes a row lock and checks the current stage, so double clicks and two admins at once
 * can't approve, reject or deliver twice. Each change is recorded in OrderHistory.
 */

type Tx = Prisma.TransactionClient;

export const orderHref = (orderId: string) => `/dashboard/orders/${orderId}`;
export const adminOrderHref = (orderId: string) => `/admin/orders/${orderId}`;

/** Stages in which the customer is waiting on staff. */
const AWAITING_STAFF: OrderStage[] = ["SUBMITTED", "PENDING_VERIFICATION", "INFO_REQUIRED"];

async function lock(tx: Tx, orderId: string): Promise<Order> {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order");
  return order;
}

/** Moves an order to `to` and records it. */
export async function moveStage(
  tx: Tx,
  order: Pick<Order, "id" | "stage">,
  to: OrderStage,
  actorId: string | null,
  opts: { note?: string | null; data?: Prisma.OrderUpdateInput } = {},
) {
  const updated = await tx.order.update({ where: { id: order.id }, data: { stage: to, ...opts.data } });
  const history = await tx.orderHistory.create({ data: { orderId: order.id, actorId, from: order.stage, to, note: opts.note?.slice(0, 2000) ?? null } });
  return { order: updated, history };
}

/** A note in the order's history without a change of stage (receipt uploaded, file added…). */
async function historyNote(tx: Tx | typeof db, order: Pick<Order, "id" | "stage">, actorId: string | null, note: string) {
  await tx.orderHistory.create({ data: { orderId: order.id, actorId, from: order.stage, to: order.stage, note } });
}

// ── What still needs doing before an order can be submitted ────────────────

export type OrderGap = "design" | "brief" | "upload";

export function orderGaps(event: Pick<Event, "product" | "designSource" | "designBrief" | "imageMode" | "customImageKey" | "themeKey">): OrderGap[] {
  const gaps: OrderGap[] = [];
  if (!designSourcesFor(event.product).includes(event.designSource)) gaps.push("design");
  if (event.designSource === "REQUEST" && (event.designBrief?.trim().length ?? 0) < 10) gaps.push("brief");
  if (event.designSource === "UPLOAD" && !(event.imageMode === "CUSTOM" && event.customImageKey)) gaps.push("upload");
  return gaps;
}

// ── Customer side ───────────────────────────────────────────────────────────

/** The event's order from the wizard that isn't finished with (or null). */
export async function currentOrder(eventId: string) {
  return db.order.findFirst({ where: { eventId, product: { not: null }, stage: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } });
}

/** Submitted and waiting on staff: the product, design and features can't change meanwhile. */
export async function orderInReview(eventId: string) {
  return db.order.findFirst({ where: { eventId, product: { not: null }, stage: { in: AWAITING_STAFF }, status: "PENDING" } });
}

type OwnedEvent = Pick<Event, "id" | "userId" | "product" | "designSource" | "themeKey" | "features" | "purchasedAt" | "plan" | "deletedAt" | "deactivatedAt">;

/**
 * The draft order for the event at today's prices (created, or updated when the product, design,
 * features or discount code changed). An order already with staff is returned unchanged.
 */
export async function prepareOrder(user: { id: string }, event: OwnedEvent, opts: { code?: string | null } = {}): Promise<Order> {
  if (event.userId !== user.id) throw notFound("Event");
  if (event.deletedAt || event.deactivatedAt) throw badRequest("event_inactive", "This event is not active.");
  if (isUnlocked(event)) throw conflict("already_purchased", "This event has already been paid for.");
  const inReview = await orderInReview(event.id);
  if (inReview) return inReview;

  const quote = await quoteFor(event);
  const existing = await db.order.findFirst({
    where: { eventId: event.id, userId: user.id, product: { not: null }, stage: { in: ["DRAFT", "REJECTED"] }, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { promoCode: true },
  });

  // Discount code: a new one, removed (null), or the one already on the order (undefined).
  let promoCodeId: string | null = null;
  let discount = 0;
  const codeInput = opts.code === undefined ? (existing?.promoCode?.code ?? null) : opts.code?.trim() || null;
  if (codeInput) {
    try {
      const code = await usableCode(codeInput, user.id, quote.currency);
      if (quote.plan ? !codeAppliesTo(code, quote.plan) : code.plans.length > 0) {
        throw badRequest("promo_wrong_plan", "This code is for a different package.");
      }
      promoCodeId = code.id;
      discount = discountFor(code, quote.subtotal, quote.currency);
    } catch (e) {
      if (opts.code !== undefined) throw e; // the customer just entered it: say why it doesn't work
      // A code saved earlier that has since expired simply drops off.
    }
  }
  const lines: OrderLine[] = discount ? [...quote.lines, { key: "discount", amount: -discount }] : quote.lines;
  const data = {
    product: quote.product,
    designSource: quote.designSource,
    plan: quote.plan,
    guestLimit: quote.guestLimit,
    amount: quote.subtotal - discount,
    currency: quote.currency,
    lines: lines as unknown as Prisma.InputJsonValue,
    promoCodeId,
    discount,
    provider: "manual",
  };
  if (existing) {
    const same =
      existing.product === data.product &&
      existing.designSource === data.designSource &&
      existing.plan === data.plan &&
      existing.amount === data.amount &&
      existing.currency === data.currency &&
      existing.promoCodeId === data.promoCodeId &&
      JSON.stringify(existing.lines) === JSON.stringify(lines);
    if (same) return existing;
    return db.order.update({ where: { id: existing.id }, data });
  }
  return db.$transaction(async (tx) => {
    const order = await tx.order.create({ data: { ...data, userId: user.id, eventId: event.id, stage: "DRAFT", status: "PENDING" } });
    await tx.orderHistory.create({ data: { orderId: order.id, actorId: user.id, to: "DRAFT" } });
    return order;
  });
}

async function ownOrder(userId: string, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId || !order.product) throw notFound("Order");
  return order;
}

/** Customer submits the order: it waits for staff to confirm the transfer. Safe to repeat. */
export async function submitOrder(user: { id: string }, orderId: string, opts: { reference?: string | null } = {}) {
  const pre = await ownOrder(user.id, orderId);
  const event = pre.eventId ? await db.event.findUnique({ where: { id: pre.eventId } }) : null;
  if (!event || event.deletedAt) throw notFound("Event");
  const gaps = orderGaps(event);
  if (gaps.length) throw badRequest("order_incomplete", "Finish your design before submitting the order.", { gaps: gaps.join(",") });

  const result = await db.$transaction(async (tx) => {
    const order = await lock(tx, orderId);
    const reference = opts.reference?.trim() ? opts.reference.trim().slice(0, 120) : undefined;
    if (AWAITING_STAFF.includes(order.stage)) {
      if (reference && reference !== order.transferReference) {
        await tx.order.update({ where: { id: order.id }, data: { transferReference: reference } });
        await historyNote(tx, order, user.id, `Transfer reference: ${reference}`);
      }
      return { order, submitted: false };
    }
    if (order.status !== "PENDING" || (order.stage !== "DRAFT" && order.stage !== "REJECTED")) {
      throw conflict("order_not_editable", "This order can no longer be changed.");
    }
    const now = new Date();
    const submitted = await moveStage(tx, order, "SUBMITTED", user.id, {
      data: { submittedAt: now, ...(reference !== undefined ? { transferReference: reference } : {}), rejectionReason: null },
    });
    const pending = await moveStage(tx, submitted.order, "PENDING_VERIFICATION", null, {
      note: order.amount === 0 ? "Nothing to pay (discount code)" : "Waiting for staff to confirm the bank transfer",
    });
    if (order.amount > 0) {
      await enqueue("order.email", { orderId, kind: "submitted" }, { tx, dedupeKey: `order.email:submitted:${pending.history.id}` });
      await enqueue("order.email", { orderId, kind: "admin_new" }, { tx, dedupeKey: `order.email:admin_new:${pending.history.id}` });
      await notify(tx, {
        userId: order.userId,
        kind: "order.submitted",
        href: orderHref(orderId),
        dedupeKey: `order.submitted:${pending.history.id}`,
        data: { reference: orderReference(orderId), title: event.title },
      });
    }
    return { order: pending.order, submitted: true };
  });

  // A discount code covered everything: there's no transfer to check, so it's approved now.
  if (result.submitted && result.order.amount === 0) {
    await applyPaidOrder(orderId, { provider: "promo", amount: 0, note: "Paid in full with a discount code" });
    return { order: (await db.order.findUnique({ where: { id: orderId } }))!, submitted: true };
  }
  return result;
}

const MAX_RECEIPTS = 5;

/** The customer's transfer receipt (evidence for staff — it doesn't approve anything). */
export async function addReceipt(user: { id: string }, orderId: string, file: { name: string; data: Buffer }) {
  const order = await ownOrder(user.id, orderId);
  if (order.status !== "PENDING" || !CUSTOMER_EDITABLE_STAGES.includes(order.stage))
    throw conflict("order_not_editable", "This order can no longer be changed.");
  const count = await db.orderFile.count({ where: { orderId, kind: "RECEIPT" } });
  if (count >= MAX_RECEIPTS) throw badRequest("too_many_files", `You can upload up to ${MAX_RECEIPTS} receipts.`);
  const saved = await saveReceipt(order, file, user.id);
  await historyNote(db, order, user.id, "Transfer receipt uploaded");
  return saved;
}

export async function removeReceipt(user: { id: string }, orderId: string, fileId: string) {
  const order = await ownOrder(user.id, orderId);
  if (order.status !== "PENDING" || !CUSTOMER_EDITABLE_STAGES.includes(order.stage))
    throw conflict("order_not_editable", "This order can no longer be changed.");
  const file = await db.orderFile.findFirst({ where: { id: fileId, orderId, kind: "RECEIPT" } });
  if (!file) throw notFound("File");
  await db.orderFile.delete({ where: { id: file.id } });
  await historyNote(db, order, user.id, "Transfer receipt removed");
}

/** The customer answers staff's question (and may add a reference); the order goes back for checking. */
export async function answerInfoRequest(user: { id: string }, orderId: string, input: { note: string; reference?: string | null }) {
  await ownOrder(user.id, orderId);
  return db.$transaction(async (tx) => {
    const order = await lock(tx, orderId);
    if (order.stage !== "INFO_REQUIRED" || order.status !== "PENDING") throw conflict("order_not_waiting", "We're not waiting for anything on this order.");
    const reference = input.reference?.trim() ? input.reference.trim().slice(0, 120) : order.transferReference;
    const { order: updated, history } = await moveStage(tx, order, "PENDING_VERIFICATION", user.id, {
      note: input.note,
      data: { customerNote: input.note.slice(0, 2000), transferReference: reference },
    });
    await enqueue("order.email", { orderId, kind: "admin_new" }, { tx, dedupeKey: `order.email:admin_new:${history.id}` });
    return updated;
  });
}

// ── Staff side ──────────────────────────────────────────────────────────────

/**
 * Staff confirmed the transfer. Only an order the customer has submitted (or a plan order
 * awaiting payment) can be approved; approving twice changes nothing.
 */
export async function approveOrder(adminId: string, orderId: string, note?: string | null) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order");
  if (order.status === "PAID") return { order, applied: false };
  if (order.status !== "PENDING") throw conflict("order_not_pending", `This order is ${order.status.toLowerCase()} and can't be approved.`);
  const allowed: OrderStage[] = order.product ? VERIFIABLE_STAGES : [...VERIFIABLE_STAGES, "DRAFT"];
  if (!allowed.includes(order.stage)) throw conflict("order_not_submitted", "The customer hasn't submitted this order yet.");
  const r = await applyPaidOrder(orderId, {
    provider: "manual",
    actorId: adminId,
    note: note?.trim() ? `Payment approved: ${note.trim()}` : "Payment approved",
    expectStages: allowed,
  });
  if (r.applied) await audit(adminId, "admin.order.approve", "order", orderId, { note: note ?? null, amount: order.amount, currency: order.currency });
  return { order: r.order, applied: r.applied };
}

/** Staff couldn't confirm the payment. The customer is told why and can resubmit. */
export async function rejectOrder(adminId: string, orderId: string, reason: string) {
  const r = await db.$transaction(async (tx) => {
    const order = await lock(tx, orderId);
    if (order.stage === "REJECTED") return { order, changed: false };
    if (order.status !== "PENDING" || !AWAITING_STAFF.includes(order.stage))
      throw conflict("order_not_pending", "Only orders waiting for payment verification can be rejected.");
    const { order: updated, history } = await moveStage(tx, order, "REJECTED", adminId, {
      note: reason,
      data: { rejectedAt: new Date(), rejectionReason: reason.slice(0, 1000), decidedById: adminId },
    });
    if (order.product) {
      await enqueue("order.email", { orderId, kind: "rejected" }, { tx, dedupeKey: `order.email:rejected:${history.id}` });
      await notify(tx, {
        userId: order.userId,
        kind: "order.rejected",
        href: orderHref(orderId),
        dedupeKey: `order.rejected:${history.id}`,
        data: { reference: orderReference(orderId), reason },
      });
    }
    return { order: updated, changed: true };
  });
  if (r.changed) await audit(adminId, "admin.order.reject", "order", orderId, { reason });
  return r;
}

/** Staff need something from the customer before they can decide (e.g. a clearer receipt). */
export async function requestOrderInfo(adminId: string, orderId: string, message: string) {
  const r = await db.$transaction(async (tx) => {
    const order = await lock(tx, orderId);
    if (order.status !== "PENDING" || !AWAITING_STAFF.includes(order.stage))
      throw conflict("order_not_pending", "Only orders waiting for payment verification can be asked about.");
    const { order: updated, history } = await moveStage(tx, order, "INFO_REQUIRED", adminId, {
      note: message,
      data: { infoRequestedAt: new Date(), infoRequest: message.slice(0, 1000) },
    });
    if (order.product) {
      await enqueue("order.email", { orderId, kind: "info_required" }, { tx, dedupeKey: `order.email:info_required:${history.id}` });
      await notify(tx, {
        userId: order.userId,
        kind: "order.info_required",
        href: orderHref(orderId),
        dedupeKey: `order.info_required:${history.id}`,
        data: { reference: orderReference(orderId), message },
      });
    }
    return updated;
  });
  await audit(adminId, "admin.order.request_info", "order", orderId, { message });
  return r;
}

const FINAL_STAGES: OrderStage[] = ["APPROVED", "IN_PRODUCTION", "READY", "DELIVERED"];

/** Staff upload a deliverable (the custom design). Only for approved orders. */
export async function addFinalFile(adminId: string, orderId: string, file: { name: string; data: Buffer }) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || !order.product) throw notFound("Order");
  if (order.status !== "PAID" || !FINAL_STAGES.includes(order.stage)) throw conflict("order_not_approved", "Approve the payment before adding final files.");
  const saved = await saveFinalFile(order, file, adminId);
  await historyNote(db, order, adminId, `Final file added: ${saved.name}`);
  await audit(adminId, "admin.order.final_file", "order", orderId, { fileId: saved.id, name: saved.name });
  return saved;
}

export async function removeFinalFile(adminId: string, orderId: string, fileId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order");
  if (order.stage === "READY" || order.stage === "DELIVERED")
    throw conflict("order_delivered", "Files can't be removed once the order is ready — add a corrected file instead.");
  const file = await db.orderFile.findFirst({ where: { id: fileId, orderId, kind: "FINAL" } });
  if (!file) throw notFound("File");
  await db.orderFile.delete({ where: { id: file.id } });
  await historyNote(db, order, adminId, `Final file removed: ${file.name}`);
}

/** The custom design is finished: deliver it. Needs at least one final file. */
export async function markOrderReady(adminId: string, orderId: string) {
  const r = await db.$transaction(async (tx) => {
    const order = await lock(tx, orderId);
    if (order.stage === "READY" || order.stage === "DELIVERED") return { order, changed: false };
    if (order.status !== "PAID" || (order.stage !== "APPROVED" && order.stage !== "IN_PRODUCTION"))
      throw conflict("order_not_approved", "Approve the payment first.");
    const files = await tx.orderFile.count({ where: { orderId, kind: "FINAL" } });
    if (!files) throw badRequest("no_final_files", "Upload the finished design before marking the order ready.");
    const { order: updated } = await moveStage(tx, order, "READY", adminId, { data: { readyAt: new Date() } });
    await enqueue("order.deliver", { orderId }, { tx, dedupeKey: `order.deliver:${orderId}`, eventId: order.eventId ?? undefined });
    return { order: updated, changed: true };
  });
  if (r.changed) await audit(adminId, "admin.order.ready", "order", orderId);
  return r;
}

/** Try the deliveries that failed or were skipped again (e.g. after connecting WhatsApp). */
export async function retryDelivery(adminId: string, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order");
  if (order.status !== "PAID" || (order.stage !== "READY" && order.stage !== "DELIVERED"))
    throw conflict("order_not_ready", "The order isn't ready to deliver yet.");
  const reset = await db.orderDelivery.updateMany({ where: { orderId, status: { in: ["FAILED", "SKIPPED"] } }, data: { status: "PENDING", error: null } });
  if (!reset.count && order.stage === "DELIVERED") return { queued: false };
  await historyNote(db, order, adminId, "Delivery retried");
  await enqueue("order.deliver", { orderId }, { dedupeKey: `order.deliver:${orderId}:${Date.now()}`, eventId: order.eventId ?? undefined });
  await audit(adminId, "admin.order.retry_delivery", "order", orderId);
  return { queued: true };
}
