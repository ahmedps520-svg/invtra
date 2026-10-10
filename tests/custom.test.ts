import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import {
  cancelCustomPackage,
  createCustomDraft,
  customPackageSchema,
  discardCustomDraft,
  getCustomEvent,
  listCustomDrafts,
  listCustomPackages,
  resolveCustomEventId,
  saveCustomPackage,
  sendPaymentRequest,
  updateCustomEvent,
  type CustomPackageInput,
} from "@/server/custom/service";
import { customEventInputSchema } from "@/lib/validation/event";
import { buildCardSvg } from "@/lib/card/build";
import { cardContent, eventDesign, eventTheme } from "@/server/events/design";
import { templateValues } from "@/server/whatsapp/compose";
import { sendReadiness } from "@/server/sending/service";
import { applyPaidOrder } from "@/server/payments/service";
import { guestsLabel, receiptUrl } from "@/server/payments/receipts";
import { handlers } from "@/server/queue/handlers";
import { templateCatalog } from "@/server/whatsapp/catalog";
import { guestCapacity, isUnlimited, UNLIMITED_GUESTS } from "@/lib/plans";
import { HttpError } from "@/server/http";
import { getCustomPackage } from "@/server/custom/service";
import { getEditableEvent } from "@/server/events/access";
import { editorProps } from "@/server/events/editor";
import { assertEventUpload } from "@/server/uploads";

const run = randomBytes(5).toString("hex");
const started = new Date();
const emails = (tag: string) => `custom-${tag}-${run}@example.test`;
let adminId = "";
const templateIds: string[] = [];

const eventDate = () => new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10);

function eventInput(over: Record<string, unknown> = {}) {
  return customEventInputSchema.parse({
    type: "WEDDING",
    language: "BILINGUAL",
    title: `Custom Wedding ${run}`,
    titleAr: "زفاف تجريبي",
    hostNames: "Sara & Omar",
    date: eventDate(),
    time: "20:00",
    timezone: "Asia/Riyadh",
    venueName: "Grand Hall",
    address: "Riyadh",
    ...over,
  });
}

function input(tag: string, over: { host?: Partial<CustomPackageInput["host"]>; package?: Partial<CustomPackageInput["package"]> } = {}) {
  return customPackageSchema.parse({
    host: { name: `Host ${tag}`, email: emails(tag), phone: "+966 50 123 4567", locale: "en", ...over.host },
    package: { unlimited: true, price: 2500, included: "Unlimited guests\nPremium designs", dueDate: null, note: "test", ...over.package },
  });
}

/** The whole flow: a draft event (designed first), then the host and the package, then sending. */
async function createCustomPackage(
  admin: string,
  pkg: CustomPackageInput,
  opts: { send?: { whatsapp: boolean; email: boolean }; event?: Record<string, unknown> } = {},
) {
  const draft = await createCustomDraft(admin, eventInput(opts.event));
  const r = await saveCustomPackage(admin, draft.id, pkg);
  const send = opts.send ?? { whatsapp: true, email: true };
  const sent = send.whatsapp || send.email ? await sendPaymentRequest(r.order.id, send) : { whatsapp: false, email: false };
  const event = await db.event.findUniqueOrThrow({ where: { id: draft.id } });
  return { ...r, event, sent };
}

async function jobsFor(orderId: string) {
  return db.job.findMany({ where: { type: { startsWith: "payment." }, payload: { path: ["orderId"], equals: orderId } }, orderBy: { createdAt: "asc" } });
}

async function runJob(job: Job) {
  await handlers[job.type as keyof typeof handlers](job, job.payload as Record<string, unknown>);
}

beforeAll(async () => {
  const admin = await db.user.create({ data: { email: emails("admin"), name: "Admin", passwordHash: "x", role: "ADMIN" } });
  adminId = admin.id;
  // Approved payment templates for this run (picked first thanks to sortOrder).
  for (const t of templateCatalog(env().APP_URL).filter((c) => c.purpose === "PAYMENT_REQUEST" || c.purpose === "PAYMENT_RECEIPT")) {
    const created = await db.messageTemplate.create({
      data: {
        key: `${t.key}_${run}`,
        name: t.name,
        nameAr: t.nameAr,
        description: t.description,
        purpose: t.purpose,
        metaName: `${t.metaName}_${run}`,
        language: t.language,
        locale: t.locale,
        category: t.category,
        headerType: t.headerType,
        body: t.body,
        variables: t.variables as unknown as object,
        footer: t.footer,
        buttons: t.buttons as unknown as object,
        eventTypes: t.eventTypes,
        sortOrder: -1000,
        status: "APPROVED",
      },
    });
    templateIds.push(created.id);
  }
});

afterAll(async () => {
  const users = await db.user.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { id: true } });
  const orders = await db.order.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { id: true } });
  if (orders.length) await db.job.deleteMany({ where: { type: { startsWith: "payment." }, OR: orders.map((o) => ({ payload: { path: ["orderId"], equals: o.id } })) } });
  await db.whatsAppMessage.deleteMany({ where: { purpose: { in: ["PAYMENT_REQUEST", "PAYMENT_RECEIPT"] }, createdAt: { gte: started } } });
  await db.messageTemplate.deleteMany({ where: { id: { in: templateIds } } });
  await db.auditLog.deleteMany({ where: { actorId: adminId } });
  await db.errorLog.deleteMany({ where: { createdAt: { gte: started }, source: { in: ["custom:email", "custom:whatsapp"] } } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } }); // cascades events, orders, payments, tokens
});

describe("custom packages", () => {
  it("creates the host, the event and an unlimited Custom order with a secret payment link", async () => {
    const r = await createCustomPackage(adminId, input("new"));
    expect(r.newCustomer).toBe(true);
    expect(r.user).toMatchObject({ email: emails("new"), name: "Host new", phone: "+966501234567" });
    expect(r.order).toMatchObject({ plan: "CUSTOM", status: "PENDING", guestLimit: UNLIMITED_GUESTS, amount: 250000, currency: env().PAYMENT_CURRENCY, createdById: adminId });
    expect(r.order.payToken).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(r.payUrl).toBe(`${env().APP_URL.replace(/\/$/, "")}/pay/${r.order.payToken}`);
    expect(r.order.title).toBe("Unlimited guests\nPremium designs");
    expect(r.sent).toEqual({ whatsapp: true, email: true });

    const order = await db.order.findUniqueOrThrow({ where: { id: r.order.id } });
    expect(order.requestSentAt).toBeInstanceOf(Date);
    // A new customer gets a password-setup link with the payment email.
    expect(await db.passwordResetToken.count({ where: { userId: r.user.id } })).toBe(1);
    expect(await db.activity.count({ where: { eventId: r.event.id, kind: "plan.custom_offered" } })).toBe(1);
    // The event exists but has no plan until the host pays.
    expect(await db.event.findUniqueOrThrow({ where: { id: r.event.id } })).toMatchObject({ plan: null, title: `Custom Wedding ${run}`, titleAr: "زفاف تجريبي" });

    // WhatsApp goes through the queue with the approved payment-request template and a URL button to /pay/<token>.
    const jobs = await jobsFor(r.order.id);
    expect(jobs.map((j) => j.type)).toEqual(["payment.request"]);
    await runJob(jobs[0]);
    const msg = await db.whatsAppMessage.findFirstOrThrow({ where: { purpose: "PAYMENT_REQUEST", phone: "+966501234567", createdAt: { gte: started } }, orderBy: { createdAt: "desc" } });
    expect(msg.status).toBe("SENT");
    expect(msg.eventId).toBe(r.event.id);
    expect(JSON.stringify(msg.content)).toContain(`/pay/${r.order.payToken}`);
    expect(JSON.stringify(msg.content)).toContain("Host new");
  });

  it("adds the event to an existing customer's account and supports a fixed guest allowance", async () => {
    const first = await createCustomPackage(adminId, input("existing"), { send: { whatsapp: false, email: false } });
    expect(first.sent).toEqual({ whatsapp: false, email: false });
    expect(await jobsFor(first.order.id)).toHaveLength(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: first.order.id } })).requestSentAt).toBeNull();

    const second = await createCustomPackage(adminId, input("existing", { package: { unlimited: false, guestLimit: 1500, price: 1999.5 } }), { send: { whatsapp: false, email: false } });
    expect(second.newCustomer).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.order).toMatchObject({ guestLimit: 1500, amount: 199950 });
    expect(await db.event.count({ where: { userId: first.user.id } })).toBe(2);
  });

  it("validates the package and refuses WhatsApp without a number", async () => {
    expect(customPackageSchema.safeParse({ ...input("v"), package: { unlimited: false, price: 100 } }).success).toBe(false);
    expect(customPackageSchema.safeParse({ ...input("v"), package: { unlimited: true, price: 0 } }).success).toBe(false);
    await expect(createCustomPackage(adminId, input("nophone", { host: { phone: "" } }))).rejects.toMatchObject({ code: "phone_required" });
    await expect(createCustomPackage(adminId, input("badphone", { host: { phone: "12" } }))).rejects.toBeInstanceOf(HttpError);
    expect(await db.user.count({ where: { email: emails("badphone") } })).toBe(0);
  });

  it("activates the plan when paid, numbers the receipt and sends it by email and WhatsApp", async () => {
    const r = await createCustomPackage(adminId, input("paid"), { send: { whatsapp: false, email: true } });
    const paid = await applyPaidOrder(r.order.id, { provider: "mock", providerPaymentId: `mock_${run}_1` });
    expect(paid.applied).toBe(true);
    expect(paid.order.receiptNumber).toMatch(new RegExp(`^INVTRA-${new Date().getUTCFullYear()}-\\d{4,}$`));

    const event = await db.event.findUniqueOrThrow({ where: { id: r.event.id } });
    expect(event.plan).toBe("CUSTOM");
    expect(isUnlimited(event.guestLimit)).toBe(true);
    expect(guestCapacity(event)).toBeGreaterThanOrEqual(UNLIMITED_GUESTS);

    const jobs = await jobsFor(r.order.id);
    expect(jobs.map((j) => (j.payload as { channel: string }).channel).sort()).toEqual(["email", "whatsapp"]);
    for (const job of jobs) await runJob(job);
    const receipt = await db.whatsAppMessage.findFirstOrThrow({ where: { purpose: "PAYMENT_RECEIPT", createdAt: { gte: started } }, orderBy: { createdAt: "desc" } });
    expect(JSON.stringify(receipt.content)).toContain(paid.order.receiptNumber!);

    // Paying again is a no-op and keeps the same receipt number; the next order gets the next number.
    const again = await applyPaidOrder(r.order.id, { provider: "mock", providerPaymentId: `mock_${run}_1` });
    expect(again.applied).toBe(false);
    expect((await db.order.findUniqueOrThrow({ where: { id: r.order.id } })).receiptNumber).toBe(paid.order.receiptNumber);
    const next = await createCustomPackage(adminId, input("paid2"), { send: { whatsapp: false, email: false } });
    const paid2 = await applyPaidOrder(next.order.id, { provider: "mock", providerPaymentId: `mock_${run}_2` });
    const n = (s: string) => Number(s.split("-").pop());
    expect(n(paid2.order.receiptNumber!)).toBeGreaterThan(n(paid.order.receiptNumber!));

    // The payment link becomes the receipt; it can't be re-sent or withdrawn any more.
    expect(receiptUrl(paid.order)).toBe(r.payUrl);
    await expect(sendPaymentRequest(r.order.id, { whatsapp: false, email: true })).rejects.toMatchObject({ code: "not_payable" });
    await expect(cancelCustomPackage(adminId, r.order.id)).rejects.toMatchObject({ code: "not_payable" });
  });

  it("withdraws an unpaid package and lists packages for the admin", async () => {
    const r = await createCustomPackage(adminId, input("withdraw"), { send: { whatsapp: false, email: false } });
    await cancelCustomPackage(adminId, r.order.id);
    expect((await db.order.findUniqueOrThrow({ where: { id: r.order.id } })).status).toBe("CANCELLED");
    await expect(sendPaymentRequest(r.order.id, { whatsapp: false, email: true })).rejects.toMatchObject({ code: "not_payable" });
    // A queued request for a withdrawn package is skipped quietly.
    await expect(handlers["payment.request"]({} as Job, { orderId: r.order.id })).resolves.toBeUndefined();

    const list = await listCustomPackages({ q: emails("withdraw") });
    expect(list.rows.map((o) => o.id)).toEqual([r.order.id]);
    expect(list.rows[0].payUrl).toContain(`/pay/${r.order.payToken}`);
    expect((await listCustomPackages({ q: emails("withdraw"), status: "PENDING" })).rows).toHaveLength(0);
  });

  it("undoes a test payment so the real link can be sent, but never a real one", async () => {
    const { isTestPaid, undoTestPayment } = await import("@/server/payments/service");
    const r = await createCustomPackage(adminId, input("undo"), { send: { whatsapp: false, email: false } });
    const paid = await applyPaidOrder(r.order.id, { provider: "mock", providerPaymentId: `mock_${r.order.id}` });
    expect(await isTestPaid(r.order.id)).toBe(true);
    const year = Number(paid.order.receiptNumber!.split("-")[1]);
    const n = Number(paid.order.receiptNumber!.split("-")[2]);
    await expect(sendPaymentRequest(r.order.id, { whatsapp: false, email: true })).rejects.toMatchObject({ code: "not_payable" });

    const reopened = await undoTestPayment(r.order.id);
    expect(reopened).toMatchObject({ status: "PENDING", paidAt: null, receiptNumber: null, payToken: r.order.payToken });
    expect(await db.payment.count({ where: { orderId: r.order.id } })).toBe(0);
    expect(await db.event.findUniqueOrThrow({ where: { id: r.event.id } })).toMatchObject({ plan: null, guestLimit: 0 });
    // The receipt number is free again (it was the last one issued).
    expect((await db.receiptCounter.findUniqueOrThrow({ where: { year } })).last).toBe(n - 1);
    await expect(sendPaymentRequest(r.order.id, { whatsapp: false, email: true })).resolves.toMatchObject({ email: true });

    // A real payment can't be undone here.
    await applyPaidOrder(r.order.id, { provider: "tap", providerPaymentId: `chg_${run}` });
    expect(await isTestPaid(r.order.id)).toBe(false);
    await expect(undoTestPayment(r.order.id)).rejects.toMatchObject({ code: "real_payment" });
  });

  it("labels unlimited and fixed allowances in both languages", () => {
    expect(guestsLabel(UNLIMITED_GUESTS, false)).toBe("Unlimited guests");
    expect(guestsLabel(UNLIMITED_GUESTS, true)).toBe("عدد غير محدود من الضيوف");
    expect(guestsLabel(1500, false)).toBe("Up to 1,500 guests");
  });
});

describe("designing a custom event", () => {
  it("lets staff open the host's design, but no other customer", async () => {
    const r = await createCustomPackage(adminId, input("design"), { send: { whatsapp: false, email: false } });
    const stranger = await db.user.create({ data: { email: emails("stranger"), name: "Stranger", passwordHash: "x" } });

    await expect(getEditableEvent({ id: adminId, role: "ADMIN" }, r.event.id)).resolves.toMatchObject({ id: r.event.id });
    await expect(getEditableEvent({ id: r.user.id, role: "CUSTOMER" }, r.event.id)).resolves.toMatchObject({ id: r.event.id });
    await expect(getEditableEvent({ id: stranger.id, role: "CUSTOMER" }, r.event.id)).rejects.toMatchObject({ status: 404 });

    const pkg = await getCustomPackage(r.order.id);
    expect(pkg).toMatchObject({ id: r.order.id, payUrl: r.payUrl, event: { id: r.event.id }, user: { id: r.user.id } });
    expect(await getCustomPackage("not-an-order")).toBeNull();

    // Every design is offered (premium included) before the host has paid.
    const props = await editorProps(pkg!.event, { premiumIncluded: true });
    expect(props.premiumIncluded).toBe(true);
    expect(props.event.plan).toBeNull();
    expect(props.themes.length).toBeGreaterThan(5);
  });

  it("accepts any file uploaded to the event, whoever uploaded it, and nothing from other events", async () => {
    const r = await createCustomPackage(adminId, input("uploads"), { send: { whatsapp: false, email: false } });
    const other = await createCustomPackage(adminId, input("uploads2"), { send: { whatsapp: false, email: false } });
    const mk = (eventId: string, userId: string, kind: "CUSTOM_INVITATION" | "LOGO") =>
      db.upload.create({ data: { userId, eventId, kind, key: `test/${run}/${randomBytes(4).toString("hex")}.png`, mimeType: "image/png", size: 10 } });
    const byStaff = await mk(r.event.id, adminId, "CUSTOM_INVITATION");
    const byHost = await mk(r.event.id, r.user.id, "CUSTOM_INVITATION");
    const elsewhere = await mk(other.event.id, other.user.id, "CUSTOM_INVITATION");
    const logo = await mk(r.event.id, r.user.id, "LOGO");

    await expect(assertEventUpload(r.event.id, byStaff.key, ["CUSTOM_INVITATION"])).resolves.toMatchObject({ id: byStaff.id });
    await expect(assertEventUpload(r.event.id, byHost.key, ["CUSTOM_INVITATION"])).resolves.toMatchObject({ id: byHost.id });
    await expect(assertEventUpload(r.event.id, elsewhere.key, ["CUSTOM_INVITATION"])).rejects.toMatchObject({ code: "invalid_upload" });
    await expect(assertEventUpload(r.event.id, logo.key, ["CUSTOM_INVITATION"])).rejects.toMatchObject({ code: "invalid_upload" });
    // The editor lists every file of the event, not just the viewer's own.
    const props = await editorProps(r.event);
    expect(props.uploads.map((u) => u.key).sort()).toEqual([byStaff.key, byHost.key, logo.key].sort());
    await db.upload.deleteMany({ where: { key: { startsWith: `test/${run}/` } } });
  });
});

describe("design first, host and payment last", () => {
  it("starts as the staff member's draft with only the occasion and date, named after the occasion", async () => {
    const draft = await createCustomDraft(
      adminId,
      customEventInputSchema.parse({ type: "ENGAGEMENT", language: "BILINGUAL", date: eventDate(), time: "19:30", timezone: "Asia/Riyadh" }),
    );
    expect(draft).toMatchObject({ userId: adminId, custom: true, customDraft: true, title: "Engagement", titleAr: "خطوبة", hostNames: "", venueName: "", address: "" });
    expect((await listCustomDrafts()).map((d) => d.id)).toContain(draft.id);
    // Drafts stay out of the staff member's own event list.
    expect(await db.event.count({ where: { userId: adminId, deletedAt: null, customDraft: false, id: draft.id } })).toBe(0);
    // No payment link yet.
    expect((await getCustomEvent(draft.id))?.order).toBeNull();

    // The details can be filled in (or left out) later.
    const { event } = await updateCustomEvent(draft, eventInput({ type: "ENGAGEMENT", title: "", titleAr: null, hostNames: "Noura & Fahad", venueName: "" }));
    expect(event).toMatchObject({ title: "Engagement", hostNames: "Noura & Fahad", venueName: "" });

    // A draft can be discarded; a custom event with a host can't.
    await discardCustomDraft(adminId, draft.id);
    expect((await db.event.findUniqueOrThrow({ where: { id: draft.id } })).deletedAt).toBeInstanceOf(Date);
    const withHost = await createCustomPackage(adminId, input("nodiscard"), { send: { whatsapp: false, email: false } });
    await expect(discardCustomDraft(adminId, withHost.event.id)).rejects.toMatchObject({ code: "not_draft" });
  });

  it("moves the event to the host with the payment link, and updates the unpaid link in place", async () => {
    const draft = await createCustomDraft(adminId, eventInput());
    const first = await saveCustomPackage(adminId, draft.id, input("move"));
    expect(first.newCustomer).toBe(true);
    expect(await db.event.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ userId: first.user.id, customDraft: false, custom: true });
    expect((await listCustomDrafts()).map((d) => d.id)).not.toContain(draft.id);

    // Same host, new price: same order and link.
    const again = await saveCustomPackage(adminId, draft.id, input("move", { package: { unlimited: false, guestLimit: 300, price: 900 } }));
    expect(again.order.id).toBe(first.order.id);
    expect(again.order).toMatchObject({ guestLimit: 300, amount: 90000, payToken: first.order.payToken });

    // A different host: the event moves again and the old link stops working.
    const other = await saveCustomPackage(adminId, draft.id, input("move2"));
    expect(other.order.id).toBe(first.order.id);
    expect(other.order.payToken).not.toBe(first.order.payToken);
    expect((await db.event.findUniqueOrThrow({ where: { id: draft.id } })).userId).toBe(other.user.id);
    expect(await db.order.count({ where: { payToken: first.order.payToken } })).toBe(0);

    // Old admin links used the order id; they lead to the event.
    expect(await resolveCustomEventId(first.order.id)).toBe(draft.id);
    expect(await resolveCustomEventId(draft.id)).toBe(draft.id);
    expect(await resolveCustomEventId("nope")).toBeNull();
    expect((await getCustomEvent(draft.id))?.order?.id).toBe(first.order.id);

    // Once paid, the package can't change.
    await applyPaidOrder(first.order.id, { provider: "mock", providerPaymentId: `mock_${run}_move` });
    await expect(saveCustomPackage(adminId, draft.id, input("move2"))).rejects.toMatchObject({ code: "already_paid" });
  });

  it("works without hosts, venue or address: card, messages and readiness", async () => {
    const r = await createCustomPackage(adminId, input("bare"), {
      send: { whatsapp: false, email: false },
      event: { title: "Gathering", titleAr: null, language: "EN", hostNames: "", venueName: "", address: "" },
    });
    const v = templateValues(r.event, { name: "Khalid" }, "TOKEN12345");
    expect(v.host_names).toBe("Gathering");
    expect(v.venue).toBe("—");
    const ready = await sendReadiness(r.event);
    expect(ready.checks.find((c) => c.key === "details")?.ok).toBe(true);

    const design = eventDesign(r.event);
    const svg = buildCardSvg({ theme: eventTheme(r.event), design, language: "EN", content: cardContent(r.event, design), qrText: "HTTPS://X.TEST/Q/A" });
    expect(svg).not.toMatch(/<text[^>]*><\/text>/); // no empty lines for the missing names / venue
  });
});

describe("card options for custom events", () => {
  async function bareEvent() {
    const draft = await createCustomDraft(adminId, eventInput({ language: "EN", title: "Card test" }));
    return draft;
  }
  const card = (event: Awaited<ReturnType<typeof bareEvent>>, patch: Record<string, unknown>, qrText: string | null = "HTTPS://INVTRA.TEST/Q/ABC") => {
    const design = { ...eventDesign(event), ...patch } as ReturnType<typeof eventDesign>;
    return buildCardSvg({ theme: eventTheme(event), design, language: "EN", content: cardContent(event, design), guest: { name: "Khalid", allowedCount: 2 }, qrText });
  };

  it("can leave the QR off, or point it at your own link", async () => {
    const event = await bareEvent();
    const d = eventDesign(event);
    const withQr = card(event, {});
    expect(withQr).toMatch(/scan for your invitation/i);
    const off = card(event, { card: { ...d.card, qr: { ...d.card.qr, enabled: false } } });
    expect(off).not.toMatch(/scan for your invitation/i);
    expect(off.length).toBeLessThan(withQr.length);

    // A custom link replaces each guest's personal code (the same as encoding the link directly).
    const link = "https://example.com/gifts";
    const custom = card(event, { card: { ...d.card, qr: { ...d.card.qr, link, caption: "Our gift list" } } });
    const direct = card(event, { card: { ...d.card, qr: { ...d.card.qr, caption: "Our gift list" } } }, link);
    expect(custom).toBe(direct);
    expect(custom).toMatch(/our gift list/i);

    // The same choice applies to the guest page and Apple Wallet.
    const { eventQrText } = await import("@/server/invitations");
    expect(eventQrText(event, "ABC2345678")).toMatch(/\/Q\/ABC2345678$/);
    await db.event.update({ where: { id: event.id }, data: { design: { ...d, card: { ...d.card, qr: { ...d.card.qr, link } } } } });
    expect(eventQrText(await db.event.findUniqueOrThrow({ where: { id: event.id } }), "ABC2345678")).toBe(link);
    await db.event.update({ where: { id: event.id }, data: { design: { ...d, card: { ...d.card, qr: { ...d.card.qr, enabled: false } } } } });
    expect(eventQrText(await db.event.findUniqueOrThrow({ where: { id: event.id } }), "ABC2345678")).toBeNull();
  });

  it("leaves lines off the card and adds your own", async () => {
    const event = await bareEvent();
    const d = eventDesign(event);
    const full = card(event, {});
    expect(full).toContain("Grand Hall");
    expect(full).toContain("Sara");
    const lines = { ...d.card.lines, venue: false, names: false };
    const trimmed = card(event, { card: { ...d.card, lines }, texts: { ...d.texts, extra: "Children are welcome\nNo gifts please" } });
    expect(trimmed).not.toContain("Grand Hall");
    expect(trimmed).not.toContain("Sara");
    expect(trimmed).toContain("Children are welcome");
    expect(trimmed).toContain("No gifts please");
  });

  it("gives the names their own typeface and colour", async () => {
    const event = await bareEvent();
    const plain = card(event, {});
    expect(plain).not.toContain("Great Vibes");
    const styled = card(event, { names: { font: "great-vibes", fontAr: "marhey", color: "#7FA7C9" } });
    expect(styled).toMatch(/font-family="'Great Vibes'"[^>]*fill="#7FA7C9"[^>]*>Sara</);
    // Only the names change: the rest keeps the text colour.
    expect(styled).not.toMatch(/fill="#7FA7C9"[^>]*>Grand Hall/);
    const { normalizeDesign } = await import("@/lib/design/schema");
    expect(normalizeDesign(eventDesign(event), { names: { font: "not-a-font" } }).names).toEqual({ font: null, fontAr: null, color: null });
  });

  it("rejects a QR link that isn't a web address", async () => {
    const { designSchema } = await import("@/lib/design/schema");
    const link = designSchema.shape.card.shape.qr.shape.link;
    expect(link.safeParse("https://invtra.store/x").success).toBe(true);
    expect(link.safeParse("").success).toBe(true);
    expect(link.safeParse("javascript:alert(1)").success).toBe(false);
    expect(link.safeParse("not a link").success).toBe(false);
  });
});
