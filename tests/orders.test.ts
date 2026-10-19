/**
 * Orders from the event wizard: what each product costs, submitting (never marked paid by the
 * customer), staff approving, rejecting or asking for more information, production of custom
 * designs, delivery by email / WhatsApp / in-app exactly once each (and what happens when a
 * channel fails), and the protected previews and file access around all of it.
 */
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Job, Product } from "@prisma/client";
import { db } from "@/server/db";
import { THEMES } from "@/lib/themes/registry";

const session = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/server/auth/session", async (orig) => ({ ...(await orig<object>()), getSessionUser: vi.fn(async () => session.user) }));
const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[], failNext: 0 }));
vi.mock("@/server/email", () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    if (mail.failNext > 0) {
      mail.failNext--;
      throw new Error("SMTP unavailable");
    }
    mail.sent.push(m);
  }),
}));

import { handlers } from "@/server/queue/handlers";
import { createEvent } from "@/server/events/service";
import {
  addFinalFile,
  addReceipt,
  answerInfoRequest,
  approveOrder,
  markOrderReady,
  prepareOrder,
  rejectOrder,
  requestOrderInfo,
  retryDelivery,
  submitOrder,
} from "@/server/orders/service";
import { quoteFor } from "@/server/orders/pricing";
import { signedDownloadUrl, validDownloadSignature } from "@/server/orders/files";
import { isUnlocked, PREVIEW_WIDTH, renderProtectedPreview } from "@/server/render/preview";
import { markOrderRefunded } from "@/server/payments/service";
import * as previewRoute from "@/app/api/events/[id]/preview/route";
import * as cardRoute from "@/app/api/events/[id]/card/route";
import * as fileRoute from "@/app/api/orders/[id]/files/[fileId]/route";
import * as downloadRoute from "@/app/d/[fileId]/route";
import * as adminOrderRoute from "@/app/api/admin/orders/[id]/route";
import * as setupRoute from "@/app/api/events/[id]/setup/route";

const run = randomBytes(4).toString("hex");
const userIds: string[] = [];
const base = "https://invtra.store";
const req = (path: string, method = "GET", body?: unknown) =>
  new NextRequest(`${base}${path}`, { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });
const as = (user: unknown) => (session.user = user);

async function makeUser(opts: { admin?: boolean } = {}) {
  const user = await db.user.create({
    data: {
      email: `orders-${run}-${userIds.length}@example.test`,
      name: opts.admin ? "Staff" : "Sara",
      passwordHash: "x",
      emailVerifiedAt: new Date(),
      role: opts.admin ? "ADMIN" : "CUSTOMER",
    },
  });
  userIds.push(user.id);
  return user;
}

const details = {
  type: "WEDDING" as const,
  language: "EN" as const,
  title: "Sara & Omar",
  titleAr: null,
  hostNames: "Sara & Omar",
  hostNamesAr: null,
  date: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
  time: "19:00",
  endTime: null,
  dateTbd: false,
  timeTbd: false,
  timezone: "Asia/Riyadh",
  venueName: "Al Faisaliah",
  venueNameAr: null,
  address: "Riyadh",
  addressAr: null,
  mapsUrl: null,
  schedule: [],
};

async function makeEvent(userId: string, product: Product = "INVITATION") {
  // createEvent takes the validated form input; fill the rest of it from the schema's defaults.
  const { eventInputSchema } = await import("@/lib/validation/event");
  const input = eventInputSchema.parse(details);
  return createEvent(userId, input, "minimal", product);
}

async function jobsFor(type: string, orderId: string) {
  return db.job.findMany({ where: { type, payload: { path: ["orderId"], equals: orderId } }, orderBy: { createdAt: "asc" } });
}
async function runJobs(type: string, orderId: string) {
  for (const job of await jobsFor(type, orderId)) {
    await handlers[job.type as keyof typeof handlers](job as Job, job.payload as Record<string, unknown>);
  }
}
/** Approve, then let the queue render and deliver. */
async function approveAndDeliver(adminId: string, orderId: string) {
  const r = await approveOrder(adminId, orderId, "Seen in Al Rajhi");
  await runJobs("order.fulfil", orderId);
  await runJobs("order.deliver", orderId);
  return r;
}

const png = () =>
  sharp({ create: { width: 1200, height: 1500, channels: 3, background: "#d9c9b0" } })
    .png()
    .toBuffer();

beforeEach(() => {
  mail.sent.length = 0;
  mail.failNext = 0;
  session.user = null;
});

afterAll(async () => {
  await db.messageTemplate.deleteMany({ where: { key: `order-ready-${run}` } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.promoCode.deleteMany({ where: { code: { startsWith: `T${run.toUpperCase()}` } } });
});

describe("prices", () => {
  it("prices each product from its plan or the staff's product prices", async () => {
    const user = await makeUser();
    const invitation = await makeEvent(user.id);
    expect((await quoteFor(invitation)).lines).toEqual([{ key: "plan_basic", amount: 49900 }]);
    // A premium design needs the Premium package, whatever was picked.
    expect((await quoteFor({ ...invitation, themeKey: "royal" })).lines[0].key).toBe(THEMES.royal.premium ? "plan_premium" : "plan_basic");
    expect((await quoteFor({ ...invitation, designSource: "REQUEST" })).lines.map((l) => l.key)).toEqual(["plan_basic", "design_request"]);
    const photo = await makeEvent(user.id, "PHOTO_ONLY");
    expect(await quoteFor(photo)).toMatchObject({ plan: null, guestLimit: 0, lines: [{ key: "photo_only" }] });
    const custom = await makeEvent(user.id, "CUSTOM_DESIGN");
    expect(custom.designSource).toBe("REQUEST");
    expect(await quoteFor(custom)).toMatchObject({ plan: "CUSTOM", designSource: "REQUEST", lines: [{ key: "custom_design" }] });
  });

  it("takes a discount code off the draft order", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    const code = await db.promoCode.create({ data: { code: `T${run.toUpperCase()}10`, percentOff: 10 } });
    const order = await prepareOrder(user, event, { code: code.code });
    expect(order).toMatchObject({ stage: "DRAFT", status: "PENDING", amount: 44900, discount: 5000, promoCodeId: code.id });
    // Preparing again keeps the same draft.
    expect((await prepareOrder(user, event)).id).toBe(order.id);
  });
});

describe("submitting", () => {
  it("waits for staff: never paid, the design stays locked, staff are told", async () => {
    const user = await makeUser();
    await makeUser({ admin: true });
    const event = await makeEvent(user.id);
    const draft = await prepareOrder(user, event);
    await addReceipt(user, draft.id, { name: "transfer.png", data: await png() });
    const { order } = await submitOrder(user, draft.id, { reference: "FT123" });
    expect(order).toMatchObject({ stage: "PENDING_VERIFICATION", status: "PENDING", transferReference: "FT123", paidAt: null });
    expect(isUnlocked(await db.event.findUniqueOrThrow({ where: { id: event.id } }))).toBe(false);
    const history = await db.orderHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => h.to)).toEqual(expect.arrayContaining(["DRAFT", "SUBMITTED", "PENDING_VERIFICATION"]));
    await runJobs("order.email", order.id);
    expect(mail.sent.some((m) => m.to === user.email && /received your order/.test(m.subject))).toBe(true);
    expect(mail.sent.some((m) => /order to verify/.test(m.subject))).toBe(true);
    // Submitting again changes nothing.
    expect((await submitOrder(user, draft.id)).submitted).toBe(false);
    // The product can't change while staff check it.
    as(user);
    const res = await setupRoute.PATCH(req(`/api/events/${event.id}/setup`, "PATCH", { product: "PHOTO_ONLY" }), ctx({ id: event.id }));
    expect(res.status).toBe(409);
  });

  it("needs a finished design: a brief for a custom design, a file for an upload", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id, "CUSTOM_DESIGN");
    const draft = await prepareOrder(user, event);
    await expect(submitOrder(user, draft.id)).rejects.toMatchObject({ code: "order_incomplete" });
  });
});

describe("staff decisions", () => {
  it("rejects with a reason the customer sees, who can resubmit", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id);
    const { order } = await submitOrder(user, (await prepareOrder(user, event)).id);
    await rejectOrder(admin.id, order.id, "No transfer for this amount yet");
    const rejected = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(rejected).toMatchObject({ stage: "REJECTED", status: "PENDING", rejectionReason: "No transfer for this amount yet", decidedById: admin.id });
    expect(await db.notification.count({ where: { userId: user.id, kind: "order.rejected" } })).toBe(1);
    await runJobs("order.email", order.id);
    expect(mail.sent.some((m) => m.to === user.email && m.text.includes("No transfer for this amount yet"))).toBe(true);
    expect((await submitOrder(user, order.id)).order.stage).toBe("PENDING_VERIFICATION");
    expect(await db.auditLog.count({ where: { targetId: order.id, action: "admin.order.reject" } })).toBe(1);
  });

  it("asks for more information and takes the customer's answer back to verification", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id);
    const { order } = await submitOrder(user, (await prepareOrder(user, event)).id);
    await requestOrderInfo(admin.id, order.id, "Please upload the receipt");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).stage).toBe("INFO_REQUIRED");
    await answerInfoRequest(user, order.id, { note: "Uploaded it now", reference: "FT999" });
    expect(await db.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      stage: "PENDING_VERIFICATION",
      customerNote: "Uploaded it now",
      transferReference: "FT999",
    });
  });

  it("approves only submitted orders, once, however many times it's pressed", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id);
    const draft = await prepareOrder(user, event);
    await expect(approveOrder(admin.id, draft.id)).rejects.toMatchObject({ code: "order_not_submitted" });
    await submitOrder(user, draft.id);
    const results = await Promise.all([approveOrder(admin.id, draft.id), approveOrder(admin.id, draft.id), approveOrder(admin.id, draft.id)]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(await db.payment.count({ where: { orderId: draft.id } })).toBe(1);
    expect(await jobsFor("order.fulfil", draft.id)).toHaveLength(1);
    expect(await db.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ plan: "BASIC", guestLimit: 100, purchasedAt: expect.any(Date) });
  });

  it("refuses customers and needs the admin to confirm the money arrived", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id);
    const { order } = await submitOrder(user, (await prepareOrder(user, event)).id);
    as(user);
    expect(
      (await adminOrderRoute.POST(req(`/api/admin/orders/${order.id}`, "POST", { action: "approve", confirmed: true }), ctx({ id: order.id }))).status,
    ).toBe(403);
    as(admin);
    expect(
      (await adminOrderRoute.POST(req(`/api/admin/orders/${order.id}`, "POST", { action: "approve", confirmed: false }), ctx({ id: order.id }))).status,
    ).toBe(422);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(
      (await adminOrderRoute.POST(req(`/api/admin/orders/${order.id}`, "POST", { action: "approve", confirmed: true }), ctx({ id: order.id }))).status,
    ).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });
});

describe("delivery", () => {
  it("renders the final file and delivers it once by email and in the app (WhatsApp only with an opt-in)", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id);
    const { order } = await submitOrder(user, (await prepareOrder(user, event)).id);
    await approveAndDeliver(admin.id, order.id);
    const done = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { files: true, deliveries: true } });
    expect(done.stage).toBe("DELIVERED");
    const final = done.files.find((f) => f.kind === "FINAL")!;
    expect(final).toMatchObject({ mimeType: "image/png", width: 2160 });
    const byChannel = Object.fromEntries(done.deliveries.map((d) => [d.channel, d]));
    expect(byChannel.EMAIL.status).toBe("SENT");
    expect(byChannel.IN_APP.status).toBe("SENT");
    expect(byChannel.WHATSAPP).toMatchObject({ status: "SKIPPED", error: expect.stringMatching(/didn't ask/) });
    const delivered = mail.sent.filter((m) => m.to === user.email && /files are ready/.test(m.subject));
    expect(delivered).toHaveLength(1);
    expect(delivered[0].text).toContain(`/d/${final.id}?exp=`);

    // Running the delivery again (a retry, a second worker) sends nothing twice.
    await handlers["order.deliver"]({} as Job, { orderId: order.id });
    expect(mail.sent.filter((m) => /files are ready/.test(m.subject))).toHaveLength(1);
    expect(await db.notification.count({ where: { userId: user.id, kind: "order.delivered" } })).toBe(1);
  });

  it("records a failed email, keeps the order ready, and finishes on retry without repeating the rest", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id, "PHOTO_ONLY");
    const { order } = await submitOrder(user, (await prepareOrder(user, event)).id);
    await approveOrder(admin.id, order.id);
    await runJobs("order.fulfil", order.id);
    mail.failNext = 1;
    await expect(handlers["order.deliver"]({} as Job, { orderId: order.id })).rejects.toThrow(/Email delivery failed/);
    let o = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { deliveries: true } });
    expect(o.stage).toBe("READY");
    expect(o.deliveries.find((d) => d.channel === "EMAIL")).toMatchObject({ status: "FAILED", error: "SMTP unavailable" });
    expect(o.deliveries.find((d) => d.channel === "IN_APP")?.status).toBe("SENT");
    await handlers["order.deliver"]({} as Job, { orderId: order.id });
    o = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { deliveries: true } });
    expect(o.stage).toBe("DELIVERED");
    expect(o.deliveries.find((d) => d.channel === "EMAIL")).toMatchObject({ status: "SENT", attempts: 2 });
    expect(await db.notification.count({ where: { userId: user.id, kind: "order.delivered" } })).toBe(1);
    // Photo only: no plan, but the design is unlocked.
    expect(await db.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ plan: null, purchasedAt: expect.any(Date) });
  });

  it("sends the WhatsApp update through an approved template to customers who opted in, and records refusals", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const phone = `+9665${String(70000000 + (parseInt(run.slice(0, 4), 16) % 9999999)).slice(-8)}`;
    await db.user.update({ where: { id: user.id }, data: { phone, whatsappUpdatesAt: new Date() } });
    await db.messageTemplate.create({
      data: {
        key: `order-ready-${run}`,
        name: "Order ready",
        purpose: "ORDER_UPDATE",
        metaName: `order_ready_${run}`,
        language: "en",
        locale: "en",
        body: "Hello {{1}}, order {{2}} is ready.",
        variables: ["customer_name", "order_reference"],
        buttons: [{ type: "URL", text: "Open", url: "https://invtra.store/o/{{1}}" }],
        status: "APPROVED",
        sortOrder: -1,
      },
    });
    const event = await makeEvent(user.id);
    const first = await submitOrder(user, (await prepareOrder(user, event)).id);
    await approveAndDeliver(admin.id, first.order.id);
    expect(await db.orderDelivery.findUnique({ where: { orderId_channel: { orderId: first.order.id, channel: "WHATSAPP" } } })).toMatchObject({
      status: "SENT",
    });
    expect(await db.whatsAppMessage.count({ where: { phone, purpose: "ORDER_UPDATE", status: "SENT" } })).toBe(1);

    // Opted out on WhatsApp since: never delivered, and never claimed to be.
    await db.whatsAppOptOut.create({ data: { phone, source: "keyword" } });
    const event2 = await makeEvent(user.id, "PHOTO_ONLY");
    const second = await submitOrder(user, (await prepareOrder(user, event2)).id);
    await approveAndDeliver(admin.id, second.order.id);
    const refused = await db.orderDelivery.findUnique({ where: { orderId_channel: { orderId: second.order.id, channel: "WHATSAPP" } } });
    expect(refused, JSON.stringify(refused)).toMatchObject({ status: "SKIPPED", error: expect.stringMatching(/stopped/) });
    expect((await db.order.findUniqueOrThrow({ where: { id: second.order.id } })).stage).toBe("DELIVERED");
    await db.whatsAppOptOut.delete({ where: { phone } });
    await retryDelivery(admin.id, second.order.id);
    await runJobs("order.deliver", second.order.id);
    expect(await db.orderDelivery.findUnique({ where: { orderId_channel: { orderId: second.order.id, channel: "WHATSAPP" } } })).toMatchObject({
      status: "SENT",
    });
    expect(mail.sent.filter((m) => m.to === user.email && /files are ready/.test(m.subject))).toHaveLength(2); // one per order
  });

  it("puts a custom design into production and delivers it only once its file is uploaded", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id, "CUSTOM_DESIGN");
    await db.event.update({ where: { id: event.id }, data: { designBrief: "Emerald green with gold Arabic calligraphy" } });
    const { order } = await submitOrder(user, (await prepareOrder(user, event)).id);
    await approveOrder(admin.id, order.id);
    await runJobs("order.fulfil", order.id);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).stage).toBe("IN_PRODUCTION");
    expect(await db.orderFile.count({ where: { orderId: order.id, kind: "FINAL" } })).toBe(0);
    await expect(markOrderReady(admin.id, order.id)).rejects.toMatchObject({ code: "no_final_files" });
    // Until it's delivered, sending invitations waits for the design.
    const { sendReadiness } = await import("@/server/sending/service");
    expect((await sendReadiness(await db.event.findUniqueOrThrow({ where: { id: event.id } }))).checks.find((c) => c.key === "design")?.ok).toBe(false);

    await addFinalFile(admin.id, order.id, { name: "sara-omar-final.png", data: await png() });
    await markOrderReady(admin.id, order.id);
    await markOrderReady(admin.id, order.id); // twice: still one delivery
    await runJobs("order.deliver", order.id);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).stage).toBe("DELIVERED");
    expect(await jobsFor("order.deliver", order.id)).toHaveLength(1);
    // The finished design becomes the invitation guests receive.
    const updated = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated).toMatchObject({ imageMode: "CUSTOM", customImageKey: expect.stringContaining(`order-${order.id}-`) });
    expect((await sendReadiness(updated)).checks.find((c) => c.key === "design")?.ok).toBe(true);
  });
});

describe("protected previews and file access", () => {
  it("serves only a small watermarked JPEG before approval, and the full card after", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id);
    const jpeg = await renderProtectedPreview(event);
    const meta = await sharp(jpeg).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: PREVIEW_WIDTH });

    as(user);
    const preview = await previewRoute.GET(req(`/api/events/${event.id}/preview`), ctx({ id: event.id }));
    expect(preview.headers.get("content-type")).toBe("image/jpeg");
    const card = await cardRoute.GET(req(`/api/events/${event.id}/card?sample=1`), ctx({ id: event.id }));
    expect(card.status).toBe(403);
    // Someone else can't see it at all.
    as(await makeUser());
    expect((await previewRoute.GET(req(`/api/events/${event.id}/preview`), ctx({ id: event.id }))).status).toBe(404);

    const { order } = await submitOrder(user, (await prepareOrder(user, event)).id);
    await approveAndDeliver(admin.id, order.id);
    as(user);
    const full = await cardRoute.GET(req(`/api/events/${event.id}/card?sample=1`), ctx({ id: event.id }));
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("image/png");
  });

  it("lets only the customer (and staff) download final files, only once approved, and stops links after a refund", async () => {
    const user = await makeUser();
    const admin = await makeUser({ admin: true });
    const event = await makeEvent(user.id, "CUSTOM_DESIGN");
    await db.event.update({ where: { id: event.id }, data: { designBrief: "Minimal, white and gold" } });
    const { order } = await submitOrder(user, (await prepareOrder(user, event)).id);
    await approveOrder(admin.id, order.id);
    await runJobs("order.fulfil", order.id);
    const file = await addFinalFile(admin.id, order.id, { name: "final.png", data: await png() });

    as(user); // in production: not yet
    expect((await fileRoute.GET(req(`/api/orders/${order.id}/files/${file.id}`), ctx({ id: order.id, fileId: file.id }))).status).toBe(403);
    as(admin); // staff can check it
    expect((await fileRoute.GET(req(`/api/orders/${order.id}/files/${file.id}`), ctx({ id: order.id, fileId: file.id }))).status).toBe(200);

    await markOrderReady(admin.id, order.id);
    await runJobs("order.deliver", order.id);
    as(user);
    const ok = await fileRoute.GET(req(`/api/orders/${order.id}/files/${file.id}`), ctx({ id: order.id, fileId: file.id }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toContain("attachment");
    as(await makeUser());
    expect((await fileRoute.GET(req(`/api/orders/${order.id}/files/${file.id}`), ctx({ id: order.id, fileId: file.id }))).status).toBe(404);

    // The emailed link works without signing in, is tamper-proof and expires.
    const link = new URL(signedDownloadUrl(file.id));
    expect((await downloadRoute.GET(req(`${link.pathname}${link.search}`), ctx({ fileId: file.id }))).status).toBe(200);
    expect((await downloadRoute.GET(req(`${link.pathname}${link.search.replace(/s=[^&]+/, "s=forged")}`), ctx({ fileId: file.id }))).status).toBe(404);
    expect(validDownloadSignature(file.id, link.searchParams.get("exp"), link.searchParams.get("s"), Date.now() + 30 * 86_400_000)).toBe("expired");

    await markOrderRefunded(order.id, { revokePlan: true });
    const after = await downloadRoute.GET(req(`${link.pathname}${link.search}`), ctx({ fileId: file.id }));
    expect(after.status).toBe(307); // to the order page, no file
    expect(isUnlocked(await db.event.findUniqueOrThrow({ where: { id: event.id } }))).toBe(false);
  });
});
