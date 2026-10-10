import type { Event, Order, OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl, env } from "@/server/env";
import { audit, logError } from "@/server/log";
import { recordActivity } from "@/server/activity";
import { createEvent, updateEvent } from "@/server/events/service";
import { providerFor } from "@/server/payments";
import { hashPassword } from "@/server/auth/password";
import { generateSecretToken, sha256 } from "@/server/security/tokens";
import { badRequest, conflict, notFound } from "@/server/http";
import { enqueue } from "@/server/queue/queue";
import { emailLayout, sendEmail } from "@/server/email";
import { UNLIMITED_GUESTS } from "@/lib/plans";
import {
  customPackageSchema,
  type CustomPackageInput,
} from "@/lib/validation/custom-package";
import type { EventInput } from "@/lib/validation/event";
import { common } from "@/lib/i18n/dictionaries/en/common";
import { common as commonAr } from "@/lib/i18n/dictionaries/ar/common";

type CustomEventInput = EventInput;
import { normalizePhone } from "@/lib/phone";
import { formatMoney } from "@/lib/format";
import { zonedToUtc } from "@/lib/time";
import { oneOf, paging, str, type SearchParams } from "@/server/admin/params";
import { assertWhatsAppOn } from "@/server/whatsapp";

/**
 * Custom events, prepared by INVTRA staff (Admin → Custom events), in this order:
 *  1. the event — a draft owned by the staff member, where only the occasion and the date are
 *     needed (hosts, venue and address can be left out, and any extra detail added);
 *  2. the design — the full editor, plus custom options (no QR, or a QR to any link, lines
 *     left off the card, extra lines);
 *  3. the host and the package — your own price and guest allowance (or no limit): the event
 *     moves to the host's account (created if new) with a secret payment link (/pay/<token>);
 *  4. sending the link by WhatsApp and/or email.
 * Paying activates the plan exactly like a self-serve purchase and issues a receipt.
 */

export { customPackageSchema, type CustomPackageInput };

export const CUSTOM_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "CANCELLED",
  "REFUNDED",
];

function minorUnits(amount: number, currency: string) {
  const decimals = ["KWD", "BHD", "OMR"].includes(currency) ? 3 : 2;
  return Math.round(amount * 10 ** decimals);
}

export function payUrl(token: string) {
  return appUrl(`/pay/${token}`);
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** One-time link that lets a host created by staff choose their own password (7 days). */
async function passwordSetupLink(userId: string) {
  const token = generateSecretToken();
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  return appUrl(`/reset-password?token=${token}`);
}

/** An untitled custom event is named after its occasion ("Wedding" / "زفاف"). */
function withTitle(input: CustomEventInput): CustomEventInput {
  if (input.title.trim() || input.titleAr?.trim()) {
    return { ...input, title: input.title.trim() || input.titleAr!.trim() };
  }
  return {
    ...input,
    title: common.eventTypes[input.type],
    titleAr: input.language === "EN" ? null : commonAr.eventTypes[input.type],
  };
}

/** Step 1: a new custom event, as a draft owned by the staff member until the host is added. */
export async function createCustomDraft(
  adminId: string,
  input: CustomEventInput,
) {
  const created = await createEvent(adminId, withTitle(input));
  const event = await db.event.update({
    where: { id: created.id },
    data: { custom: true, customDraft: true },
  });
  await audit(adminId, "admin.custom.draft", "event", event.id, {
    title: event.title,
  });
  return event;
}

/** Edit a custom event's details (hosts, venue and address may be left out). */
export async function updateCustomEvent(
  event: Event,
  input: CustomEventInput,
) {
  if (!event.custom) throw notFound("Event");
  return updateEvent(event, withTitle(input));
}

/** Discard a draft that never got a host (its payment link was never created). */
export async function discardCustomDraft(adminId: string, eventId: string) {
  const event = await db.event.findFirst({
    where: { id: eventId, custom: true, customDraft: true, deletedAt: null },
  });
  if (!event)
    throw conflict("not_draft", "Only drafts without a host can be discarded.");
  await db.event.update({
    where: { id: event.id },
    data: { deletedAt: new Date() },
  });
  await audit(adminId, "admin.custom.discard", "event", event.id);
}

/**
 * Step 3: the host and the package. Creates the payment link (or updates the unpaid one) and
 * moves the event into the host's account — a new customer gets an account. Nothing is sent
 * yet; the link goes out from the Send step.
 */
export async function saveCustomPackage(
  adminId: string,
  eventId: string,
  input: CustomPackageInput,
) {
  const e = env();
  const event = await db.event.findFirst({
    where: { id: eventId, custom: true, deletedAt: null },
  });
  if (!event) throw notFound("Event");
  let phone: string | null = null;
  if (input.host.phone) {
    const p = normalizePhone(input.host.phone, "SA");
    if (!p.ok)
      throw badRequest("invalid_phone", "Enter a valid WhatsApp number.", {
        "host.phone": "Enter a valid WhatsApp number",
      });
    phone = p.e164;
  }
  const orders = await db.order.findMany({
    where: {
      eventId,
      plan: "CUSTOM",
      payToken: { not: null },
      status: { in: ["PENDING", "PAID"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (orders.some((o) => o.status === "PAID"))
    throw conflict(
      "already_paid",
      "This event's package is already paid, so it can't be changed.",
    );
  const pending = orders[0] ?? null;

  let user = await db.user.findUnique({ where: { email: input.host.email } });
  const newCustomer = !user;
  if (user && user.status !== "ACTIVE")
    throw badRequest(
      "account_deactivated",
      "That customer's account is deactivated. Reactivate it in Customers first.",
      { "host.email": "This customer's account is deactivated" },
    );
  if (!user) {
    user = await db.user.create({
      data: {
        email: input.host.email,
        name: input.host.name,
        phone,
        locale: input.host.locale,
        passwordHash: await hashPassword(generateSecretToken()),
      },
    });
  } else if (phone && !user.phone) {
    user = await db.user.update({ where: { id: user.id }, data: { phone } });
  }

  const pkg = input.package;
  const terms = {
    userId: user.id,
    guestLimit: pkg.unlimited ? UNLIMITED_GUESTS : pkg.guestLimit!,
    amount: minorUnits(pkg.price, e.PAYMENT_CURRENCY),
    title: pkg.included || null,
    dueAt: pkg.dueDate
      ? zonedToUtc(pkg.dueDate, "23:59", event.timezone)
      : null,
    note: pkg.note || null,
  };
  // A checkout the host already opened must not stay payable at the old price.
  if (pending?.providerRef)
    await providerFor(pending.provider)
      ?.expireCheckout?.(pending.providerRef)
      .catch(() => undefined);
  const order = await db.$transaction(async (tx) => {
    const o = pending
      ? await tx.order.update({
          where: { id: pending.id },
          data: {
            ...terms,
            providerRef: null,
            // A different host gets a new link; the one sent to the previous host stops working.
            ...(pending.userId !== user.id
              ? { payToken: generateSecretToken(18), requestSentAt: null }
              : {}),
          },
        })
      : await tx.order.create({
          data: {
            ...terms,
            eventId,
            plan: "CUSTOM",
            currency: e.PAYMENT_CURRENCY,
            provider: e.PAYMENT_PROVIDER,
            payToken: generateSecretToken(18),
            createdById: adminId,
          },
        });
    await tx.event.update({
      where: { id: eventId },
      data: { userId: user.id, customDraft: false },
    });
    return o;
  });
  if (!pending)
    await recordActivity(db, eventId, "plan.custom_offered", {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  await audit(
    adminId,
    pending ? "admin.custom.update" : "admin.custom.create",
    "order",
    order.id,
    { eventId, userId: user.id, amount: order.amount, newCustomer },
  );
  return { order, user, newCustomer, payUrl: payUrl(order.payToken!) };
}

/**
 * The custom event behind an admin URL: an event id, or (links from before the design-first
 * flow) a package's order id. Null when it's neither.
 */
export async function resolveCustomEventId(id: string): Promise<string | null> {
  const event = await db.event.findFirst({
    where: { id, custom: true, deletedAt: null },
    select: { id: true },
  });
  if (event) return event.id;
  const order = await db.order.findFirst({
    where: { id, plan: "CUSTOM", payToken: { not: null } },
    select: { eventId: true, event: { select: { deletedAt: true } } },
  });
  return order?.eventId && !order.event?.deletedAt ? order.eventId : null;
}

/** A custom event with its current package (paid, else awaiting payment, else the latest). */
export async function getCustomEvent(eventId: string) {
  const event = await db.event.findFirst({
    where: { id: eventId, custom: true, deletedAt: null },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, locale: true },
      },
      scheduleItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!event) return null;
  const orders = await db.order.findMany({
    where: { eventId, plan: "CUSTOM", payToken: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, locale: true },
      },
    },
  });
  const order =
    orders.find((o) => o.status === "PAID") ??
    orders.find((o) => o.status === "PENDING") ??
    orders[0] ??
    null;
  return {
    event,
    draft: event.customDraft,
    order: order ? { ...order, payUrl: payUrl(order.payToken!) } : null,
  };
}

/** Admin → Custom events: drafts still being designed (no host yet), newest first. */
export async function listCustomDrafts() {
  return db.event.findMany({
    where: { custom: true, customDraft: true, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      type: true,
      startsAt: true,
      timezone: true,
      themeKey: true,
      updatedAt: true,
      user: { select: { name: true } },
    },
  });
}

type Loaded = Order & {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    locale: string;
    lastLoginAt: Date | null;
  };
  event: {
    id: string;
    title: string;
    titleAr: string | null;
    startsAt: Date;
    timezone: string;
  } | null;
};

async function loadOrder(orderId: string): Promise<Loaded> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          locale: true,
          lastLoginAt: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          titleAr: true,
          startsAt: true,
          timezone: true,
        },
      },
    },
  });
  if (!order) throw notFound("Order");
  return order;
}

function eventName(order: Loaded, ar: boolean) {
  return (
    (ar ? order.event?.titleAr || order.event?.title : order.event?.title) ??
    "INVTRA"
  );
}

/**
 * The payment-link message, in the host's language, for staff to send from their own WhatsApp
 * (a wa.me link with the text typed in) while INVTRA's WhatsApp isn't connected.
 */
export function paymentRequestWhatsAppUrl(order: {
  amount: number;
  currency: string;
  payToken: string | null;
  user: { name: string; phone: string | null; locale: string };
  event: { title: string; titleAr: string | null } | null;
}): string | null {
  if (!order.user.phone || !order.payToken) return null;
  const ar = order.user.locale === "ar";
  const amount = formatMoney(order.amount, order.currency, ar ? "ar" : "en");
  const event = (ar ? order.event?.titleAr || order.event?.title : order.event?.title) ?? "INVTRA";
  const link = payUrl(order.payToken);
  const text = ar
    ? `مرحبًا ${order.user.name}،\n\nباقة دعوات إنفترا لمناسبة ${event} جاهزة. الإجمالي: ${amount}.\n\nللمراجعة والدفع:\n${link}`
    : `Hello ${order.user.name},\n\nYour INVTRA invitation package for ${event} is ready. Total: ${amount}.\n\nReview and pay here:\n${link}`;
  return `https://wa.me/${order.user.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** Staff sent the link themselves (their own WhatsApp): note when. */
export async function markPaymentRequestSent(orderId: string) {
  const order = await loadOrder(orderId);
  if (order.status !== "PENDING") throw conflict("not_payable", "This order is not awaiting payment.");
  await db.order.update({ where: { id: order.id }, data: { requestSentAt: new Date() } });
}

/** (Re)send the payment link: WhatsApp via the queue, email right away. */
export async function sendPaymentRequest(
  orderId: string,
  channels: { whatsapp: boolean; email: boolean },
  opts: { newCustomer?: boolean } = {},
) {
  const order = await loadOrder(orderId);
  if (!order.payToken)
    throw badRequest("no_link", "This order has no payment link.");
  if (order.status !== "PENDING")
    throw conflict("not_payable", "This order is not awaiting payment.");
  const result = { whatsapp: false, email: false };

  if (channels.whatsapp) {
    assertWhatsAppOn();
    if (!order.user.phone)
      throw badRequest(
        "phone_required",
        "The customer has no WhatsApp number.",
      );
    await enqueue(
      "payment.request",
      { orderId: order.id },
      { eventId: order.eventId ?? undefined },
    );
    result.whatsapp = true;
  }
  if (channels.email) {
    const ar = order.user.locale === "ar";
    const amount = formatMoney(order.amount, order.currency, ar ? "ar" : "en");
    const link = payUrl(order.payToken);
    const setup =
      opts.newCustomer || !order.user.lastLoginAt
        ? await passwordSetupLink(order.user.id)
        : null;
    const name = escapeHtml(order.user.name);
    const title = escapeHtml(eventName(order, ar));
    try {
      await sendEmail({
        to: order.user.email,
        subject: ar
          ? `باقة دعوات ${eventName(order, true)} جاهزة — إنفترا`
          : `Your INVTRA package for ${eventName(order, false)} is ready`,
        text: ar
          ? `مرحبًا ${order.user.name}،\n\nباقة دعوات إنفترا لمناسبة ${eventName(order, true)} جاهزة. الإجمالي: ${amount}.\n\nللمراجعة والدفع:\n${link}${setup ? `\n\nأنشأنا لك حسابًا في إنفترا لإدارة مناسبتك. اختر كلمة المرور من هنا (صالح 7 أيام):\n${setup}` : ""}\n\nإنفترا`
          : `Hello ${order.user.name},\n\nYour INVTRA invitation package for ${eventName(order, false)} is ready. Total: ${amount}.\n\nReview and pay securely:\n${link}${setup ? `\n\nWe've created an INVTRA account for you to manage your event. Choose your password here (valid for 7 days):\n${setup}` : ""}\n\nINVTRA`,
        html: emailLayout(
          ar ? "باقتك جاهزة" : "Your package is ready",
          ar
            ? `<div dir="rtl"><p>مرحبًا ${name}،</p><p>باقة دعوات إنفترا لمناسبة <b>${title}</b> جاهزة. الإجمالي: <b>${amount}</b>.</p><p><a href="${link}" style="display:inline-block;background:#1e1a16;color:#faf7f2;padding:12px 22px;border-radius:999px;text-decoration:none">مراجعة ودفع</a></p>${setup ? `<p>أنشأنا لك حسابًا لإدارة مناسبتك — <a href="${setup}" style="color:#84664a">اختر كلمة المرور</a> (صالح 7 أيام).</p>` : ""}</div>`
            : `<p>Hello ${name},</p><p>Your INVTRA invitation package for <b>${title}</b> is ready. Total: <b>${amount}</b>.</p><p><a href="${link}" style="display:inline-block;background:#1e1a16;color:#faf7f2;padding:12px 22px;border-radius:999px;text-decoration:none">Review &amp; pay</a></p>${setup ? `<p>We've created an INVTRA account for you to manage your event — <a href="${setup}" style="color:#84664a">choose your password</a> (valid for 7 days).</p>` : ""}`,
        ),
      });
      result.email = true;
    } catch (e) {
      await logError("custom:email", e, { orderId: order.id });
    }
  }
  if (result.whatsapp || result.email)
    await db.order.update({
      where: { id: order.id },
      data: { requestSentAt: new Date() },
    });
  return result;
}

/** Withdraw an unpaid custom package (its payment link stops working). */
export async function cancelCustomPackage(adminId: string, orderId: string) {
  const order = await loadOrder(orderId);
  if (order.status !== "PENDING")
    throw conflict("not_payable", "Only unpaid packages can be cancelled.");
  await db.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      note: order.note
        ? `${order.note}\nCancelled by staff`
        : "Cancelled by staff",
    },
  });
  await audit(adminId, "admin.custom.cancel", "order", order.id);
}

/** A staff-prepared package with its host and event (null if the id isn't one). */
export async function getCustomPackage(orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, plan: "CUSTOM", payToken: { not: null } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          locale: true,
        },
      },
      event: true,
    },
  });
  if (!order || !order.event || order.event.deletedAt) return null;
  return { ...order, event: order.event, payUrl: payUrl(order.payToken!) };
}

export type CustomerLookup = {
  name: string;
  phone: string | null;
  locale: string;
  active: boolean;
  events: number;
};

/** Is this email already a customer? (prefills the custom-event wizard) */
export async function lookupCustomer(
  email: string,
): Promise<CustomerLookup | null> {
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return null;
  const user = await db.user.findUnique({
    where: { email: e },
    select: {
      name: true,
      phone: true,
      locale: true,
      status: true,
      _count: { select: { events: { where: { deletedAt: null } } } },
    },
  });
  return user
    ? {
        name: user.name,
        phone: user.phone,
        locale: user.locale,
        active: user.status === "ACTIVE",
        events: user._count.events,
      }
    : null;
}

/** Admin → Custom events: every staff-prepared package, newest first. */
export async function listCustomPackages(sp: SearchParams) {
  const q = str(sp, "q");
  const status = oneOf(sp, "status", CUSTOM_STATUSES);
  const { page, pageSize, skip, take } = paging(sp);
  const where: Prisma.OrderWhereInput = {
    plan: "CUSTOM",
    payToken: { not: null },
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { id: q },
            { receiptNumber: q.toUpperCase() },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { event: { title: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, rows, totals] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            timezone: true,
            deletedAt: true,
          },
        },
      },
    }),
    db.order.groupBy({
      by: ["status", "currency"],
      where: { plan: "CUSTOM", payToken: { not: null } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);
  const summary = (s: OrderStatus) => {
    const r = totals.filter((t) => t.status === s);
    return {
      count: r.reduce((n, t) => n + t._count._all, 0),
      amounts: r.map((t) => ({
        amount: t._sum.amount ?? 0,
        currency: t.currency,
      })),
    };
  };
  return {
    total,
    page,
    pageSize,
    rows: rows.map((o) => ({
      ...o,
      event: o.event && !o.event.deletedAt ? o.event : null,
      payUrl: payUrl(o.payToken!),
    })),
    summary: { pending: summary("PENDING"), paid: summary("PAID") },
  };
}
