/**
 * WhatsApp compliance: what counts as "allowed to send" from Meta's account status, one-tap and
 * keyword opt-outs that stop every future message to a number, template categories and buttons,
 * template status webhooks, test sends only to the host's own number, and website copy that
 * matches how invitations are really sent.
 */
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { THEMES } from "@/lib/themes/registry";
import { toWhatsAppId } from "@/lib/phone";
import { getDictionary } from "@/lib/i18n";
import { buttonPayload, optOutKeyword, parseButtonPayload } from "@/lib/whatsapp/templates";
import { judge, whatsappAccountStatus } from "@/server/whatsapp/account";
import { whatsapp } from "@/server/whatsapp";
import { WhatsAppOptedOutError } from "@/server/whatsapp/errors";
import { handleWhatsAppWebhook } from "@/server/whatsapp/webhook";
import { signWebhookBody } from "@/server/whatsapp/signature";
import { templateCatalog } from "@/server/whatsapp/catalog";
import { templateShapeErrors } from "@/server/admin/templates";
import { sendTest } from "@/server/sending/service";
import { bankTransferCopy, ownWhatsAppCopy } from "@/lib/i18n/sending-mode";

const run = randomBytes(4).toString("hex");
const userIds: string[] = [];
const phones: string[] = [];
let n = 0;
const phone = () => {
  const p = `+9665${String(40000000 + parseInt(run.slice(0, 4), 16) * 10 + n++).slice(-8)}`;
  phones.push(p);
  return p;
};

async function post(field: string, value: Record<string, unknown>) {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "WABA", changes: [{ field, value }] }] });
  return handleWhatsAppWebhook(body, signWebhookBody(body, env().WHATSAPP_APP_SECRET!));
}
const inbound = (from: string, message: Record<string, unknown>) =>
  post("messages", { messaging_product: "whatsapp", messages: [{ from: toWhatsAppId(from), id: `wamid.C${run}${n++}`, timestamp: "1", ...message }] });

afterAll(async () => {
  await db.whatsAppOptOut.deleteMany({ where: { phone: { in: phones } } });
  await db.job.deleteMany({ where: { type: "whatsapp.opt_out_ack", payload: { path: ["phone"], string_contains: "+9665" }, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("whether the account may send", () => {
  it("needs a connected number, an approved display name and an approved account", () => {
    const phoneOk = { display: "+966", verifiedName: "INVTRA", status: "CONNECTED", nameStatus: "APPROVED", codeVerification: "VERIFIED", quality: "GREEN", limitTier: "TIER_250", platform: "CLOUD_API" };
    expect(judge(phoneOk, { name: "INVTRA", reviewStatus: "APPROVED", businessVerification: "rejected" })).toEqual([]); // unverified can still send (limited)
    expect(judge({ ...phoneOk, nameStatus: "DECLINED" }, null)).toEqual(["name_not_approved"]);
    expect(judge({ ...phoneOk, status: "PENDING" }, null)).toEqual(["number_not_connected"]);
    expect(judge({ ...phoneOk, status: "FLAGGED" }, null)).toEqual([]); // still sends, with lower limits
    expect(judge(phoneOk, { name: null, reviewStatus: "PENDING", businessVerification: null })).toEqual(["account_not_approved"]);
  });

  it("is simulated in development", async () => {
    expect(await whatsappAccountStatus({ fresh: true })).toMatchObject({ mode: "mock", ok: true, problems: [] });
  });
});

describe("opting out", () => {
  it("recognises STOP buttons and replies, in English and Arabic", () => {
    expect(parseButtonPayload(buttonPayload("STOP", "ABCDEF1234"))).toEqual({ action: "STOP", token: "ABCDEF1234" });
    expect(optOutKeyword(" Stop ")).toBe("STOP");
    expect(optOutKeyword("إيقاف")).toBe("STOP");
    expect(optOutKeyword("START")).toBe("START");
    expect(optOutKeyword("stop by at 7?")).toBeNull();
  });

  it("stops every message to the number until it says START, and confirms either way", async () => {
    const number = phone();
    await inbound(number, { type: "text", text: { body: "STOP" } });
    expect(await db.whatsAppOptOut.findUnique({ where: { phone: number } })).toMatchObject({ source: "keyword" });
    expect(await db.job.count({ where: { type: "whatsapp.opt_out_ack", payload: { equals: { phone: number, action: "STOP" } } } })).toBe(1);

    await expect(whatsapp().sendTemplate({ to: number, templateName: "x", languageCode: "en", components: [] })).rejects.toBeInstanceOf(WhatsAppOptedOutError);
    await expect(whatsapp().sendText({ to: number, body: "hello" })).rejects.toBeInstanceOf(WhatsAppOptedOutError);
    // Senders pass the WhatsApp id (no "+"): still blocked.
    await expect(whatsapp().sendText({ to: toWhatsAppId(number), body: "hello" })).rejects.toBeInstanceOf(WhatsAppOptedOutError);
    // The confirmation itself still goes to the person who asked.
    await expect(whatsapp().sendText({ to: number, body: "confirmed", allowOptedOut: true })).resolves.toMatchObject({ messageId: expect.any(String) });

    await inbound(number, { type: "text", text: { body: "start" } });
    expect(await db.whatsAppOptOut.findUnique({ where: { phone: number } })).toBeNull();
    await expect(whatsapp().sendText({ to: number, body: "hello again" })).resolves.toBeTruthy();
  });

  it("stops from the invitation's button, cancels what's queued and tells the host", async () => {
    const host = await db.user.create({ data: { email: `wa-${run}-${userIds.length}@example.test`, name: "Host", passwordHash: "x", emailVerifiedAt: new Date() } });
    userIds.push(host.id);
    const event = await db.event.create({
      data: { userId: host.id, title: "Party", hostNames: "A", startsAt: new Date(Date.now() + 9e9), venueName: "V", address: "A", themeKey: "minimal", design: THEMES.minimal.defaults as object },
    });
    const number = phone();
    const guest = await db.guest.create({ data: { eventId: event.id, name: "Khalid", phone: number } });
    const invitation = await db.invitation.create({ data: { eventId: event.id, guestId: guest.id, token: `T${run.toUpperCase()}12`.slice(0, 10) } });
    const queued = await db.job.create({ data: { type: "nudge.send", payload: { guestId: guest.id }, runAt: new Date(Date.now() + 9e9), eventId: event.id } });

    await inbound(number, { type: "button", button: { payload: buttonPayload("STOP", invitation.token), text: "Stop messages" } });
    expect(await db.whatsAppOptOut.findUnique({ where: { phone: number } })).toMatchObject({ source: "button" });
    expect((await db.job.findUniqueOrThrow({ where: { id: queued.id } })).status).toBe("CANCELLED");
    expect(await db.activity.findFirst({ where: { eventId: event.id, kind: "guest.opted_out" } })).toMatchObject({ data: { name: "Khalid" } });
    // The guest's answer is unchanged: stopping messages isn't declining.
    expect((await db.guest.findUniqueOrThrow({ where: { id: guest.id } })).rsvpStatus).toBe("PENDING");
  });
});

describe("templates", () => {
  it("files invitations and reply reminders as Marketing with a Stop button, everything else as Utility", () => {
    for (const t of templateCatalog("https://invtra.store")) {
      const firstContact = t.purpose === "INVITATION" || t.purpose === "NUDGE";
      expect(t.category, t.key).toBe(firstContact ? "MARKETING" : "UTILITY");
      if (firstContact) expect(t.buttons.some((b) => b.type === "QUICK_REPLY" && b.action === "STOP"), t.key).toBe(true);
      expect(templateShapeErrors({ purpose: t.purpose, body: t.body, variables: t.variables, footer: t.footer, buttons: t.buttons }), t.key).toEqual({});
    }
  });

  it("allows at most one Stop button, and only on invitations and reply reminders", () => {
    const base = { purpose: "INVITATION" as const, body: "Dear {{1}}, join us please.", variables: ["guest_name"], footer: null };
    const qr = (action: "ACCEPT" | "DECLINE" | "STOP") => ({ type: "QUICK_REPLY" as const, text: action, action });
    expect(templateShapeErrors({ ...base, buttons: [qr("ACCEPT"), qr("DECLINE")] })).toEqual({});
    expect(templateShapeErrors({ ...base, buttons: [qr("ACCEPT"), qr("DECLINE"), qr("STOP"), qr("STOP")] }).buttons).toBeTruthy();
    expect(templateShapeErrors({ ...base, purpose: "REMINDER", buttons: [{ type: "URL", text: "View", url: "https://invtra.store/i/{{1}}" }, qr("STOP")] }).buttons).toBeTruthy();
  });

  it("follows Meta's review decisions sent by webhook", async () => {
    const t = await db.messageTemplate.create({
      data: { key: `wh-${run}`, name: "x", purpose: "INVITATION", metaName: `wh_${run}`, language: "en", locale: "en", body: "Hi {{1}} there", variables: ["guest_name"], buttons: [], status: "PENDING", metaTemplateId: `99${parseInt(run, 16)}` },
    });
    await post("message_template_status_update", { event: "REJECTED", message_template_id: Number(t.metaTemplateId), reason: "INCORRECT_CATEGORY" });
    expect(await db.messageTemplate.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ status: "REJECTED", rejectedReason: "INCORRECT_CATEGORY" });
    await post("message_template_status_update", { event: "APPROVED", message_template_id: Number(t.metaTemplateId) });
    expect(await db.messageTemplate.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ status: "APPROVED", rejectedReason: null });
    await db.messageTemplate.delete({ where: { id: t.id } });
  });
});

describe("test sends", () => {
  it("go only to the host's own number", async () => {
    const own = phone();
    const host = await db.user.create({ data: { email: `wa-${run}-${userIds.length}@example.test`, name: "Host", passwordHash: "x", emailVerifiedAt: new Date() } });
    userIds.push(host.id);
    const event = await db.event.create({
      data: { userId: host.id, title: "Party", hostNames: "A", startsAt: new Date(Date.now() + 9e9), venueName: "V", address: "A", themeKey: "minimal", design: THEMES.minimal.defaults as object },
    });
    await sendTest(host.id, event, own, "Host"); // the first test sets the account's number
    expect((await db.user.findUniqueOrThrow({ where: { id: host.id } })).phone).toBe(own);
    await expect(sendTest(host.id, event, phone(), "Host")).rejects.toMatchObject({ code: "test_own_number" });
    await expect(sendTest(host.id, event, own, "Host")).resolves.toBeTruthy();
  });
});

describe("what the website says", () => {
  it("doesn't claim INVTRA sends from its business account while hosts send from their own WhatsApp", () => {
    for (const locale of ["en", "ar"] as const) {
      const text = JSON.stringify(ownWhatsAppCopy(getDictionary(locale), locale).marketing);
      expect(text).not.toMatch(/never from a personal phone|لا من هاتف شخصي|INVTRA's business account|حساب إنفترا التجاري/);
      expect(text).not.toMatch(/built on the official WhatsApp Business Platform|مبنية على منصة واتساب للأعمال الرسمية/);
    }
  });

  it("doesn't promise card payments while customers pay by bank transfer", () => {
    expect(bankTransferCopy(getDictionary("en"), "en").marketing.pricing.payWith).toMatch(/bank transfer/);
    expect(bankTransferCopy(getDictionary("ar"), "ar").marketing.pricing.payWith).toMatch(/التحويل البنكي/);
  });
});
