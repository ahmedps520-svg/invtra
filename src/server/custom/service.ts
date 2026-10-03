import type { Order, OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl, env } from "@/server/env";
import { audit, logError } from "@/server/log";
import { recordActivity } from "@/server/activity";
import { createEvent } from "@/server/events/service";
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
import { normalizePhone } from "@/lib/phone";
import { formatMoney } from "@/lib/format";
import { zonedToUtc } from "@/lib/time";
import { oneOf, paging, str, type SearchParams } from "@/server/admin/params";

/**
 * Custom packages, prepared by INVTRA staff: an event for a host (new or existing
 * customer), a Custom-plan order with its own price and guest allowance (or no limit),
 * and a secret payment link (/pay/<token>) sent to the host by WhatsApp and/or email.
 * Paying it activates the plan exactly like a self-serve purchase and issues a receipt.
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

/** Create the host (if new), the event and the payment-link order; optionally send the link. */
export async function createCustomPackage(
  adminId: string,
  input: CustomPackageInput,
) {
  const e = env();
  let phone: string | null = null;
  if (input.host.phone) {
    const p = normalizePhone(input.host.phone, "SA");
    if (!p.ok)
      throw badRequest("invalid_phone", "Enter a valid WhatsApp number.", {
        "host.phone": "Enter a valid WhatsApp number",
      });
    phone = p.e164;
  }
  if (input.send.whatsapp && !phone) {
    throw badRequest(
      "phone_required",
      "Add the host's WhatsApp number to send the link on WhatsApp.",
      { "host.phone": "Needed to send on WhatsApp" },
    );
  }

  let user = await db.user.findUnique({ where: { email: input.host.email } });
  const newCustomer = !user;
  if (user && user.status !== "ACTIVE")
    throw conflict(
      "account_deactivated",
      "That customer's account is deactivated.",
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

  const ev = input.event;
  const event = await createEvent(user.id, {
    type: ev.type,
    language: ev.language,
    title: ev.title,
    titleAr: ev.titleAr,
    hostNames: ev.hostNames,
    hostNamesAr: ev.hostNamesAr,
    date: ev.date,
    time: ev.time,
    endTime: null,
    timezone: ev.timezone,
    venueName: ev.venueName,
    venueNameAr: ev.venueNameAr,
    address: ev.address ?? "",
    addressAr: null,
    mapsUrl: null,
    dressCode: null,
    dressCodeAr: null,
    notes: null,
    notesAr: null,
    parkingInfo: null,
    accommodationInfo: null,
    specialInstructions: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    rsvpDeadline: null,
    allowWebRsvp: true,
    schedule: [],
  });

  const pkg = input.package;
  const order = await db.order.create({
    data: {
      userId: user.id,
      eventId: event.id,
      plan: "CUSTOM",
      guestLimit: pkg.unlimited ? UNLIMITED_GUESTS : pkg.guestLimit!,
      amount: minorUnits(pkg.price, e.PAYMENT_CURRENCY),
      currency: e.PAYMENT_CURRENCY,
      provider: e.PAYMENT_PROVIDER,
      payToken: generateSecretToken(18),
      title: pkg.included || null,
      dueAt: pkg.dueDate ? zonedToUtc(pkg.dueDate, "23:59", ev.timezone) : null,
      createdById: adminId,
      note: pkg.note || null,
    },
  });
  await recordActivity(db, event.id, "plan.custom_offered", {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
  });
  await audit(adminId, "admin.custom.create", "order", order.id, {
    eventId: event.id,
    userId: user.id,
    amount: order.amount,
    newCustomer,
  });

  const sent = await sendPaymentRequest(order.id, input.send, { newCustomer });
  return {
    order,
    event,
    user,
    newCustomer,
    payUrl: payUrl(order.payToken!),
    sent,
  };
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
          select: { id: true, title: true, startsAt: true, timezone: true },
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
    rows: rows.map((o) => ({ ...o, payUrl: payUrl(o.payToken!) })),
    summary: { pending: summary("PENDING"), paid: summary("PAID") },
  };
}
