/**
 * End-to-end invitation pipeline against a real Postgres database (TEST_DATABASE_URL)
 * and the mock WhatsApp provider: send → delivery receipts → Accept / Decline via the
 * signed webhook → personalised invitation, plus the edge cases from the product brief.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { createEvent, deleteEvent } from "@/server/events/service";
import { addGuest } from "@/server/guests/service";
import { importGuests, previewImport } from "@/server/guests/service";
import { startInitialBatch, resendToGuests, sendUpdateToAccepted } from "@/server/sending/service";
import { claimJobs, completeJob, failJob, type JobType } from "@/server/queue/queue";
import { handlers } from "@/server/queue/handlers";
import { handleWhatsAppWebhook } from "@/server/whatsapp/webhook";
import { signWebhookBody } from "@/server/whatsapp/signature";
import { respond } from "@/server/rsvp";
import { recordScan, recordView } from "@/server/invitations/public";
import { templateCatalog } from "@/server/whatsapp/catalog";
import { buttonPayload } from "@/lib/whatsapp/templates";
import { toWhatsAppId } from "@/lib/phone";

const run = Date.now().toString(36);
let userId = "";
let eventId = "";

async function drain() {
  for (let i = 0; i < 100; i++) {
    await db.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date(0) } });
    const jobs = await claimJobs("test", 50);
    if (!jobs.length) return;
    for (const job of jobs) {
      try {
        await handlers[job.type as JobType](job, job.payload as Record<string, unknown>);
        await completeJob(job.id);
      } catch (e) {
        await failJob(job.id, String(e));
        throw e;
      }
    }
  }
  throw new Error("queue did not drain");
}

let seq = 0;
async function webhook(message: Record<string, unknown>, phone: string, opts: { sign?: boolean; id?: string } = {}) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ wa_id: toWhatsAppId(phone) }],
              messages: [{ from: toWhatsAppId(phone), id: opts.id ?? `wamid.TEST${run}${++seq}`, timestamp: String(Math.floor(Date.now() / 1000)), ...message }],
            },
          },
        ],
      },
    ],
  });
  return handleWhatsAppWebhook(body, opts.sign === false ? "sha256=deadbeef" : signWebhookBody(body, env().WHATSAPP_APP_SECRET!));
}

const press = (action: "ACCEPT" | "DECLINE", token: string, phone: string, id?: string) =>
  webhook({ type: "button", button: { payload: buttonPayload(action, token), text: action } }, phone, { id });

async function guestByPhone(phone: string) {
  return db.guest.findFirstOrThrow({ where: { eventId, phone }, include: { invitation: true } });
}

async function messages(guestId: string, purpose?: Prisma.WhatsAppMessageWhereInput["purpose"]) {
  return db.whatsAppMessage.findMany({ where: { guestId, ...(purpose ? { purpose } : {}) }, orderBy: { createdAt: "asc" } });
}

const P = {
  khalid: "+971501110001",
  noura: "+971501110002",
  noWa: "+971501110000",
  invalid: "+971501119999",
  omar: "+971501110003",
};

beforeAll(async () => {
  for (const t of templateCatalog(env().APP_URL)) {
    const data = {
      name: t.name,
      purpose: t.purpose,
      metaName: t.metaName,
      language: t.language,
      locale: t.locale,
      headerType: t.headerType,
      body: t.body,
      variables: t.variables as unknown as Prisma.InputJsonValue,
      footer: t.footer,
      buttons: t.buttons as unknown as Prisma.InputJsonValue,
      eventTypes: t.eventTypes,
      sortOrder: t.sortOrder,
      status: "APPROVED" as const,
    };
    await db.messageTemplate.upsert({ where: { key: t.key }, create: { key: t.key, ...data }, update: data });
  }
  const user = await db.user.create({ data: { email: `flow-${run}@example.com`, name: "Flow Host", passwordHash: "x" } });
  userId = user.id;
  const event = await createEvent(userId, {
    type: "WEDDING",
    language: "EN",
    title: "The Wedding of Ahmed & Sara",
    titleAr: null,
    hostNames: "Ahmed & Sara",
    hostNamesAr: null,
    date: "2030-03-20",
    time: "19:30",
    endTime: null,
    timezone: "Asia/Dubai",
    venueName: "Four Seasons Resort",
    venueNameAr: null,
    address: "Jumeirah Beach Road, Dubai",
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
  eventId = event.id;
  await db.event.update({ where: { id: eventId }, data: { plan: "BASIC", guestLimit: 100 } });
  for (const [name, phone] of [
    ["Khalid", P.khalid],
    ["Noura", P.noura],
    ["No WhatsApp", P.noWa],
    ["Invalid", P.invalid],
  ] as const) {
    await addGuest(eventId, { name, phone, groupName: null, allowedCount: 2, locale: null, notes: null }, "AE");
  }
}, 60_000);

afterAll(async () => {
  await db.event.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

describe("invitation pipeline", () => {
  it("rejects duplicates on add and import", async () => {
    await expect(addGuest(eventId, { name: "Dup", phone: "050 111 0001", groupName: null, allowedCount: 1, locale: null, notes: null }, "AE")).rejects.toMatchObject({ code: "duplicate_phone" });
    const csv = Buffer.from("Name,Phone,Guests\nOmar,+971501110003,3\nOmar again,00971501110003,1\nKhalid twin,+971501110001,1\nBad,123,1\n");
    const preview = await previewImport(eventId, { name: "guests.csv", data: csv }, "AE");
    expect(preview.summary).toEqual({ total: 4, valid: 1, invalid: 1, duplicates: 2 });
    const result = await importGuests(eventId, preview.rows.filter((r) => !r.error && !r.duplicate).map((r) => ({ name: r.name, phone: r.phone, groupName: null, allowedCount: r.allowedCount, locale: null, notes: null })), "AE");
    expect(result.created).toBe(1);
    expect((await guestByPhone(P.omar)).allowedCount).toBe(3);
  });

  it("queues and sends the Accept/Decline message to every guest, recording failures", async () => {
    const batch = await startInitialBatch(userId, (await db.event.findUniqueOrThrow({ where: { id: eventId } })));
    expect(batch.total).toBe(5);
    await drain();
    const done = await db.sendBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(done.status).toBe("COMPLETED");
    expect(done.sent).toBe(4);
    expect(done.failed).toBe(1);

    const khalid = await guestByPhone(P.khalid);
    expect(khalid.status).toBe("MESSAGE_SENT");
    expect(khalid.deliveryStatus).toBe("READ");
    const [req] = await messages(khalid.id, "INVITATION_REQUEST");
    const content = req.content as { body: string; buttons: { payload: string }[] };
    expect(content.body).toContain("Dear Khalid");
    expect(content.buttons.map((b) => b.payload)).toEqual([buttonPayload("ACCEPT", khalid.invitation!.token), buttonPayload("DECLINE", khalid.invitation!.token)]);

    const noWa = await guestByPhone(P.noWa);
    expect(noWa.status).toBe("FAILED");
    expect(noWa.deliveryError).toBe("not_on_whatsapp");
    const invalid = await guestByPhone(P.invalid);
    expect(invalid.status).toBe("FAILED");
    expect(invalid.deliveryError).toBe("invalid_number");
  });

  it("rejects webhooks with a bad signature", async () => {
    const khalid = await guestByPhone(P.khalid);
    const r = await webhook({ type: "button", button: { payload: buttonPayload("ACCEPT", khalid.invitation!.token) } }, P.khalid, { sign: false });
    expect(r.status).toBe(401);
    expect((await guestByPhone(P.khalid)).rsvpStatus).toBe("PENDING");
  });

  it("ignores a button press from a different phone number", async () => {
    const khalid = await guestByPhone(P.khalid);
    await press("ACCEPT", khalid.invitation!.token, "+971509998888");
    await drain();
    expect((await guestByPhone(P.khalid)).rsvpStatus).toBe("PENDING");
  });

  it("ACCEPT → records acceptance and sends the personalised image, QR and link", async () => {
    const khalid = await guestByPhone(P.khalid);
    const r = await press("ACCEPT", khalid.invitation!.token, P.khalid, `wamid.ACCEPT${run}`);
    expect(r.status).toBe(200);
    await drain();
    const g = await guestByPhone(P.khalid);
    expect(g.rsvpStatus).toBe("ACCEPTED");
    expect(g.rsvpSource).toBe("WHATSAPP");
    expect(g.attendingCount).toBe(2);
    expect(g.status).toBe("INVITATION_SENT");
    const delivery = await messages(g.id, "INVITATION_DELIVERY");
    expect(delivery).toHaveLength(1);
    const c = delivery[0].content as { headerImageKey: string; buttons: { url: string }[] };
    expect(c.headerImageKey).toMatch(/^renders\//);
    expect(c.buttons[0].url).toBe(`${env().APP_URL}/i/${g.invitation!.token}`);
    expect(g.invitation!.imageKey).toBeTruthy();
    expect(await db.rsvp.count({ where: { guestId: g.id } })).toBe(1);
  });

  it("processes a duplicated webhook delivery only once", async () => {
    const khalid = await guestByPhone(P.khalid);
    await press("ACCEPT", khalid.invitation!.token, P.khalid, `wamid.ACCEPT${run}`);
    await drain();
    expect(await db.whatsAppMessage.count({ where: { waMessageId: `wamid.ACCEPT${run}` } })).toBe(1);
    expect(await messages(khalid.id, "INVITATION_DELIVERY")).toHaveLength(1);
  });

  it("ACCEPT pressed twice does not re-send immediately", async () => {
    const khalid = await guestByPhone(P.khalid);
    await press("ACCEPT", khalid.invitation!.token, P.khalid);
    await drain();
    expect(await messages(khalid.id, "INVITATION_DELIVERY")).toHaveLength(1);
    expect(await db.rsvp.count({ where: { guestId: khalid.id } })).toBe(1);
  });

  it("DECLINE → records the decline, sends a thank-you, never the image or QR", async () => {
    const noura = await guestByPhone(P.noura);
    await press("DECLINE", noura.invitation!.token, P.noura);
    await drain();
    const g = await guestByPhone(P.noura);
    expect(g.rsvpStatus).toBe("DECLINED");
    expect(g.status).toBe("DECLINED");
    expect(await messages(g.id, "INVITATION_DELIVERY")).toHaveLength(0);
    const acks = await messages(g.id, "DECLINE_ACK");
    expect(acks).toHaveLength(1);
    expect((acks[0].content as { body: string }).body).toMatch(/Thank you/);
    expect(g.invitation!.imageKey).toBeNull();
  });

  it("decline after accept is recorded and the entry pass is withdrawn", async () => {
    const khalid = await guestByPhone(P.khalid);
    await press("DECLINE", khalid.invitation!.token, P.khalid);
    await drain();
    const g = await guestByPhone(P.khalid);
    expect(g.rsvpStatus).toBe("DECLINED");
    expect(g.attendingCount).toBe(0);
    expect(await db.rsvp.count({ where: { guestId: g.id } })).toBe(2);
    expect(await db.activity.count({ where: { eventId, kind: "guest.changed_to_declined" } })).toBe(1);
    // ...and accepting again re-issues the invitation.
    await press("ACCEPT", khalid.invitation!.token, P.khalid);
    await drain();
    const again = await guestByPhone(P.khalid);
    expect(again.rsvpStatus).toBe("ACCEPTED");
    expect(await messages(again.id, "INVITATION_DELIVERY")).toHaveLength(2);
  });

  it("tracks views and QR scans (repeat scans counted, rapid duplicates ignored)", async () => {
    const khalid = await guestByPhone(P.khalid);
    const token = khalid.invitation!.token;
    await recordView(token, "LINK", "Mozilla/5.0 (iPhone)");
    await recordView(token, "LINK", "WhatsApp/2.23 link preview bot");
    await recordScan(token, false);
    await recordScan(token, false); // within 10s → ignored
    await db.guest.update({ where: { id: khalid.id }, data: { lastScannedAt: new Date(Date.now() - 60_000) } });
    await recordScan(token, true);
    const g = await guestByPhone(P.khalid);
    expect(g.viewCount).toBe(1);
    expect(g.scanCount).toBe(2);
    expect(g.firstScannedAt).toBeTruthy();
    expect(g.status).toBe("QR_SCANNED");
    expect(await db.qRScan.count({ where: { guestId: g.id, byHost: true } })).toBe(1);
  });

  it("resend only re-asks guests who haven't answered", async () => {
    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    const ids = (await db.guest.findMany({ where: { eventId }, select: { id: true } })).map((g) => g.id);
    await db.guest.updateMany({ where: { eventId }, data: { requestSentAt: new Date(Date.now() - 3600_000) } });
    const r = await resendToGuests(userId, event, ids);
    // khalid (accepted) gets his invitation again, noura (declined) skipped, omar/noWa/invalid re-asked
    expect(r.redelivered).toBe(1);
    expect(r.requested).toBe(3);
    expect(r.skipped).toBe(1);
    await drain();
  });

  it("editing the event lets the host send the updated invitation to accepted guests", async () => {
    await db.event.update({ where: { id: eventId }, data: { contentVersion: { increment: 1 } } });
    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    const r = await sendUpdateToAccepted(userId, event);
    expect(r.count).toBe(1);
    await drain();
    const khalid = await guestByPhone(P.khalid);
    expect(khalid.invitationSentVersion).toBe(event.contentVersion);
  });

  it("closes RSVPs after the deadline", async () => {
    await db.event.update({ where: { id: eventId }, data: { rsvpDeadline: new Date(Date.now() - 3 * 86_400_000) } });
    const omar = await guestByPhone(P.omar);
    expect((await respond({ guestId: omar.id, response: "ACCEPTED", source: "WEB" })).kind).toBe("deadline");
    await db.event.update({ where: { id: eventId }, data: { rsvpDeadline: null } });
  });

  it("a deleted event stops working immediately and answers politely", async () => {
    await deleteEvent(eventId);
    const omar = await guestByPhone(P.omar);
    await press("ACCEPT", omar.invitation!.token, P.omar);
    await drain();
    const g = await guestByPhone(P.omar);
    expect(g.rsvpStatus).toBe("PENDING");
    expect(await messages(g.id, "INVITATION_DELIVERY")).toHaveLength(0);
    const notices = await messages(g.id, "OTHER");
    expect((notices.at(-1)?.content as { body: string }).body).toMatch(/no longer active/);
  });
});

describe("occasions beyond weddings", () => {
  it("picks the occasion's own template and design", async () => {
    const { pickTemplate } = await import("@/server/whatsapp/compose");
    const key = async (type: Parameters<typeof pickTemplate>[0]["type"], language: "EN" | "AR" = "EN") =>
      (await pickTemplate({ type, language, messageTemplateId: null }, { locale: null }))?.key;
    expect(await key("WEDDING")).toBe("formal_wedding_en");
    expect(await key("NEWBORN")).toBe("newborn_visit_en");
    expect(await key("AQIQAH", "AR")).toBe("newborn_visit_ar");
    expect(await key("BIRTHDAY")).toBe("celebration_en");
    expect(await key("CORPORATE")).toBe("elegant_en");

    const event = await createEvent(userId, {
      type: "NEWBORN",
      language: "EN",
      title: "Welcome, Baby Yousef",
      titleAr: null,
      hostNames: "Yousef",
      hostNamesAr: null,
      date: "2030-03-20",
      time: "16:00",
      endTime: "20:00",
      timezone: "Asia/Dubai",
      venueName: "Al Zahra Hospital, Suite 512",
      venueNameAr: null,
      address: "Al Barsha, Dubai",
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
    expect(event.themeKey).toBe("teddy");
  });
});
