import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Job } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { cancelCustomPackage, createCustomPackage, customPackageSchema, listCustomPackages, sendPaymentRequest, type CustomPackageInput } from "@/server/custom/service";
import { applyPaidOrder } from "@/server/payments/service";
import { guestsLabel, receiptUrl } from "@/server/payments/receipts";
import { handlers } from "@/server/queue/handlers";
import { templateCatalog } from "@/server/whatsapp/catalog";
import { guestCapacity, isUnlimited, UNLIMITED_GUESTS } from "@/lib/plans";
import { HttpError } from "@/server/http";

const run = randomBytes(5).toString("hex");
const started = new Date();
const emails = (tag: string) => `custom-${tag}-${run}@example.test`;
let adminId = "";
const templateIds: string[] = [];

function input(tag: string, over: { host?: Partial<CustomPackageInput["host"]>; package?: Partial<CustomPackageInput["package"]>; send?: Partial<CustomPackageInput["send"]> } = {}) {
  const date = new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10);
  return customPackageSchema.parse({
    host: { name: `Host ${tag}`, email: emails(tag), phone: "+966 50 123 4567", locale: "en", ...over.host },
    event: {
      type: "WEDDING",
      language: "BILINGUAL",
      title: `Custom Wedding ${run}`,
      titleAr: "زفاف تجريبي",
      hostNames: "Sara & Omar",
      date,
      time: "20:00",
      timezone: "Asia/Riyadh",
      venueName: "Grand Hall",
      address: "Riyadh",
    },
    package: { unlimited: true, price: 2500, included: "Unlimited guests\nPremium designs", dueDate: null, note: "test", ...over.package },
    send: { whatsapp: true, email: true, ...over.send },
  });
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
    const first = await createCustomPackage(adminId, input("existing", { send: { whatsapp: false, email: false } }));
    expect(first.sent).toEqual({ whatsapp: false, email: false });
    expect(await jobsFor(first.order.id)).toHaveLength(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: first.order.id } })).requestSentAt).toBeNull();

    const second = await createCustomPackage(adminId, input("existing", { package: { unlimited: false, guestLimit: 1500, price: 1999.5 } }));
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
    expect(await db.user.count({ where: { email: { in: [emails("nophone"), emails("badphone")] } } })).toBe(0);
  });

  it("activates the plan when paid, numbers the receipt and sends it by email and WhatsApp", async () => {
    const r = await createCustomPackage(adminId, input("paid", { send: { whatsapp: false, email: true } }));
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
    const next = await createCustomPackage(adminId, input("paid2", { send: { whatsapp: false, email: false } }));
    const paid2 = await applyPaidOrder(next.order.id, { provider: "mock", providerPaymentId: `mock_${run}_2` });
    const n = (s: string) => Number(s.split("-").pop());
    expect(n(paid2.order.receiptNumber!)).toBeGreaterThan(n(paid.order.receiptNumber!));

    // The payment link becomes the receipt; it can't be re-sent or withdrawn any more.
    expect(receiptUrl(paid.order)).toBe(r.payUrl);
    await expect(sendPaymentRequest(r.order.id, { whatsapp: false, email: true })).rejects.toMatchObject({ code: "not_payable" });
    await expect(cancelCustomPackage(adminId, r.order.id)).rejects.toMatchObject({ code: "not_payable" });
  });

  it("withdraws an unpaid package and lists packages for the admin", async () => {
    const r = await createCustomPackage(adminId, input("withdraw", { send: { whatsapp: false, email: false } }));
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

  it("labels unlimited and fixed allowances in both languages", () => {
    expect(guestsLabel(UNLIMITED_GUESTS, false)).toBe("Unlimited guests");
    expect(guestsLabel(UNLIMITED_GUESTS, true)).toBe("عدد غير محدود من الضيوف");
    expect(guestsLabel(1500, false)).toBe("Up to 1,500 guests");
  });
});
