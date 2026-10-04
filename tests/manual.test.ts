import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { THEMES } from "@/lib/themes/registry";
import { manualMessage, manualReadiness, manualSendList, markManualSent, whatsappLink } from "@/server/sending/manual";
import { sendReadiness } from "@/server/sending/service";
import { POST as webRsvp } from "@/app/api/i/[token]/rsvp/route";

const run = randomBytes(5).toString("hex");
const userIds: string[] = [];

async function setup(opts: { plan?: "BASIC" | null; language?: "EN" | "AR" | "BILINGUAL" } = {}) {
  const user = await db.user.create({ data: { email: `manual-${run}-${userIds.length}@example.test`, name: "Manual Host", passwordHash: "x" } });
  userIds.push(user.id);
  const event = await db.event.create({
    data: {
      userId: user.id,
      title: "Layla's Graduation",
      titleAr: "تخرج ليلى",
      hostNames: "The Saleh family",
      hostNamesAr: "عائلة الصالح",
      language: opts.language ?? "EN",
      startsAt: new Date(Date.now() + 30 * 86_400_000),
      venueName: "Riyadh Front",
      venueNameAr: "واجهة الرياض",
      address: "Riyadh",
      themeKey: "minimal",
      design: THEMES.minimal.defaults as object,
      plan: opts.plan === undefined ? "BASIC" : opts.plan,
      guestLimit: opts.plan === null ? 0 : 100,
      allowWebRsvp: false, // only the WhatsApp buttons — manual guests must still be able to reply
    },
  });
  // One after the other, so the list order (by creation time) is fixed.
  const guests = [];
  for (const [name, phone, locale] of [
    ["Khalid", "+966501110001", null],
    ["Noura", "+966501110002", "ar"],
  ]) {
    guests.push(await db.guest.create({ data: { eventId: event.id, name: name!, phone: phone!, locale } }));
  }
  return { user, event, guests };
}

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("send from my own WhatsApp", () => {
  it("writes the invitation in the guest's language with their personal link", async () => {
    const { event, guests } = await setup({ language: "BILINGUAL" });
    const list = await manualSendList(event);
    expect(list).toHaveLength(2);
    const [khalid, noura] = list;
    expect(khalid.link).toMatch(/\/i\/[A-Z0-9]+$/);
    // Bilingual event, no guest preference: Arabic then English, link once at the end.
    expect(khalid.text).toContain("السلام عليكم Khalid");
    expect(khalid.text).toContain("Dear Khalid");
    expect(khalid.text.trim().endsWith(khalid.link)).toBe(true);
    // A guest set to Arabic gets Arabic only.
    expect(noura.text).toContain("يتشرّف عائلة الصالح");
    expect(noura.text).not.toContain("Dear");
    expect(khalid.waUrl).toBe(whatsappLink(guests[0].phone, khalid.text));
    expect(khalid.waUrl.startsWith("https://wa.me/966501110001?text=")).toBe(true);
    expect(decodeURIComponent(khalid.waUrl.split("?text=")[1])).toBe(khalid.text);
    expect(manualMessage({ ...event, language: "EN" }, { name: "Sam", locale: null }, "ABC123")).toMatch(/^Dear Sam,[\s\S]*The Saleh family[\s\S]*\/i\/ABC123$/);
  });

  it("needs a plan, like sending through INVTRA", async () => {
    const { event, guests } = await setup({ plan: null });
    expect((await manualReadiness(event)).ready).toBe(false);
    await expect(markManualSent(event, guests[0].id)).rejects.toMatchObject({ code: "not_ready" });
  });

  it("counts the guest as sent, never re-sends automatically, and lets them reply on the web", async () => {
    const { event, guests } = await setup();
    expect((await manualReadiness(event)).ready).toBe(true);
    const before = await sendReadiness(event);
    expect(before.unsent).toBe(2);

    const marked = await markManualSent(event, guests[0].id);
    expect(marked.status).toBe("MESSAGE_SENT");
    const g = await db.guest.findUniqueOrThrow({ where: { id: guests[0].id } });
    expect(g).toMatchObject({ deliveryStatus: "SENT", status: "MESSAGE_SENT" });
    expect(g.manualSentAt).toBeInstanceOf(Date);
    expect((await sendReadiness(event)).unsent).toBe(1); // INVTRA's own sending skips them

    // Another event's guest can't be marked through this event.
    const other = await setup();
    await expect(markManualSent(event, other.guests[0].id)).rejects.toMatchObject({ status: 404 });

    // Web replies are off for the event, but this guest was invited without WhatsApp buttons.
    const token = (await db.invitation.findUniqueOrThrow({ where: { guestId: guests[0].id } })).token;
    const rsvp = (body: object, t: string) =>
      webRsvp(new NextRequest(`https://invtra.store/api/i/${t}/rsvp`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${run.length}.1` } }), {
        params: Promise.resolve({ token: t }),
      });
    const res = await rsvp({ response: "ACCEPTED", attendingCount: 1 }, token);
    expect(res.status).toBe(200);
    expect((await db.guest.findUniqueOrThrow({ where: { id: guests[0].id } })).rsvpStatus).toBe("ACCEPTED");

    // A guest invited through WhatsApp buttons still has to use them.
    await manualSendList(event); // creates the second guest's invitation
    const otherToken = (await db.invitation.findUniqueOrThrow({ where: { guestId: guests[1].id } })).token;
    const refused = await rsvp({ response: "ACCEPTED" }, otherToken);
    expect(refused.status).toBe(400);
  });
});
