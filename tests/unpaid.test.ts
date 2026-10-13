/**
 * "Your invitation is ready to send" reminders for events without a plan: who gets them and
 * when, at most two per event and one a day per person, the email itself, and turning them off.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { THEMES } from "@/lib/themes/registry";

const sent: { to: string; subject: string; text: string; html?: string; unsubscribe?: string }[] = [];
vi.mock("@/server/email", () => ({ sendEmail: vi.fn(async (m: (typeof sent)[number]) => void sent.push(m)) }));

import { MAX_REMINDERS, SECOND_AFTER, cardImageUrl, queueUnpaidReminders, sendUnpaidReminder, stopRemindersApiUrl, validCardSignature, validStopSignature } from "@/server/reminders/unpaid";
import { POST as stopRoute } from "@/app/api/email/stop/route";
import { GET as cardRoute } from "@/app/e/[id]/card/route";

const run = randomBytes(4).toString("hex");
const userIds: string[] = [];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// 12:00 in Riyadh.
const NOON = new Date("2026-10-13T09:00:00Z");

async function makeUser(extra: Record<string, unknown> = {}) {
  const user = await db.user.create({
    data: { email: `unpaid-${run}-${userIds.length}@example.test`, name: "Reem", passwordHash: "x", emailVerifiedAt: new Date(), ...extra },
  });
  userIds.push(user.id);
  return user;
}
async function makeEvent(userId: string, extra: Record<string, unknown> = {}) {
  return db.event.create({
    data: {
      userId,
      title: `Reem's Engagement ${run}`,
      hostNames: "Reem & Fahad",
      startsAt: new Date(NOON.getTime() + 30 * DAY),
      venueName: "Bayat Hall",
      address: "Riyadh",
      themeKey: "garden",
      design: THEMES.garden.defaults as object,
      createdAt: new Date(NOON.getTime() - 25 * HOUR),
      ...extra,
    },
  });
}
const jobsFor = (eventId: string) => db.job.findMany({ where: { type: "event.unpaid_reminder", eventId } });

beforeEach(() => {
  sent.length = 0;
});
afterAll(async () => {
  await db.job.deleteMany({ where: { type: "event.unpaid_reminder", eventId: { in: (await db.event.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((e) => e.id) } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("who gets a reminder, and when", () => {
  it("reminds a day after the event was created, then three days later, then stops", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    await queueUnpaidReminders(NOON);
    expect((await jobsFor(event.id)).map((j) => j.payload)).toEqual([{ eventId: event.id, n: 1 }]);
    expect(await db.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ payReminders: 1, payRemindedAt: NOON });

    await queueUnpaidReminders(new Date(NOON.getTime() + 2 * DAY));
    expect(await jobsFor(event.id)).toHaveLength(1); // too soon for the second

    await queueUnpaidReminders(new Date(NOON.getTime() + SECOND_AFTER));
    expect((await jobsFor(event.id)).map((j) => (j.payload as { n: number }).n).sort()).toEqual([1, 2]);

    await queueUnpaidReminders(new Date(NOON.getTime() + 10 * DAY));
    expect(await jobsFor(event.id)).toHaveLength(MAX_REMINDERS);
  });

  it("leaves out new, paid, past, custom, deleted and in-transfer events, and hosts who can't or don't want them", async () => {
    const ok = await makeUser();
    const skipped = [
      await makeEvent(ok.id, { createdAt: new Date(NOON.getTime() - 5 * HOUR) }),
      await makeEvent(ok.id, { plan: "BASIC" }),
      await makeEvent(ok.id, { startsAt: new Date(NOON.getTime() + 2 * HOUR) }),
      await makeEvent(ok.id, { custom: true }),
      await makeEvent(ok.id, { deletedAt: new Date() }),
      await makeEvent((await makeUser({ emailVerifiedAt: null })).id),
      await makeEvent((await makeUser({ emailReminders: false })).id),
      await makeEvent((await makeUser({ status: "DEACTIVATED" })).id),
    ];
    const transfer = await makeEvent((await makeUser()).id);
    await db.order.create({ data: { userId: transfer.userId, eventId: transfer.id, plan: "BASIC", guestLimit: 100, amount: 49900, currency: "SAR", provider: "manual", createdAt: new Date(NOON.getTime() - DAY) } });
    await queueUnpaidReminders(NOON);
    for (const e of [...skipped, transfer]) expect(await jobsFor(e.id)).toHaveLength(0);
  });

  it("sends at most one a day per person, and only in the daytime in Riyadh", async () => {
    const user = await makeUser();
    const older = await makeEvent(user.id, { updatedAt: new Date(NOON.getTime() - 20 * HOUR) });
    const newer = await makeEvent(user.id);
    await db.event.update({ where: { id: newer.id }, data: { title: `Newer ${run}` } }); // most recently edited
    const night = new Date("2026-10-13T20:30:00Z"); // 23:30 in Riyadh
    expect(await queueUnpaidReminders(night)).toBe(0);
    await queueUnpaidReminders(NOON);
    expect(await jobsFor(newer.id)).toHaveLength(1);
    expect(await jobsFor(older.id)).toHaveLength(0);
    await queueUnpaidReminders(new Date(NOON.getTime() + 2 * HOUR));
    expect(await jobsFor(older.id)).toHaveLength(0); // the same day
    await queueUnpaidReminders(new Date(NOON.getTime() + DAY + HOUR));
    expect(await jobsFor(older.id)).toHaveLength(1);
  });
});

describe("the email", () => {
  it("shows their card and links to choose a plan, with a one-click way to stop", async () => {
    const user = await makeUser({ name: "Reem Al Anazi" });
    const event = await makeEvent(user.id);
    await db.guest.create({ data: { eventId: event.id, name: "Dana", phone: "+966500000101" } });
    await sendUnpaidReminder(event.id, 1);
    expect(sent).toHaveLength(1);
    const mail = sent[0];
    expect(mail.to).toBe(user.email);
    expect(mail.subject).toBe(`Your invitation for ${event.title} is ready to send`);
    expect(mail.html).toContain(cardImageUrl(event.id).replace(/&/g, "&amp;"));
    expect(mail.html).toContain(`/dashboard/events/${event.id}/review`);
    expect(mail.text).toContain("You have 1 guest on your list.");
    expect(mail.unsubscribe).toBe(stopRemindersApiUrl(user.id));

    await sendUnpaidReminder(event.id, 2);
    expect(sent[1].subject).toBe(`Still planning ${event.title}? Your invitation is waiting`);

    // Bought a plan in the meantime: nothing is sent.
    await db.event.update({ where: { id: event.id }, data: { plan: "BASIC" } });
    await sendUnpaidReminder(event.id, 2);
    expect(sent).toHaveLength(2);
  });

  it("writes to Arabic-speaking hosts in Arabic", async () => {
    const user = await makeUser({ locale: "ar" });
    const event = await makeEvent(user.id, { titleAr: "خطوبة ريم" });
    await sendUnpaidReminder(event.id, 1);
    expect(sent[0].subject).toBe("دعوة خطوبة ريم جاهزة للإرسال");
    expect(sent[0].html).toContain('dir="rtl"');
  });
});

describe("signed links", () => {
  it("serves the card image only with a valid signature", async () => {
    const user = await makeUser();
    const event = await makeEvent(user.id);
    const s = new URL(cardImageUrl(event.id)).searchParams.get("s")!;
    expect(validCardSignature(event.id, s)).toBe(true);
    expect(validCardSignature("someone-else", s)).toBe(false);
    const bad = await cardRoute(new NextRequest(`https://invtra.store/e/${event.id}/card?s=nope`), { params: Promise.resolve({ id: event.id }) });
    expect(bad.status).toBe(404);
    const good = await cardRoute(new NextRequest(`https://invtra.store/e/${event.id}/card?s=${s}`), { params: Promise.resolve({ id: event.id }) });
    expect(good.status).toBe(200);
    expect(good.headers.get("content-type")).toBe("image/jpeg");
  });

  it("turns reminders off from the email's link (one click), and refuses forged links", async () => {
    const user = await makeUser();
    const url = new URL(stopRemindersApiUrl(user.id));
    expect(validStopSignature(user.id, url.searchParams.get("s"))).toBe(true);
    const forged = await stopRoute(new NextRequest(`https://invtra.store/api/email/stop?u=${user.id}&s=nope`, { method: "POST" }));
    expect(forged.status).toBe(400);
    const res = await stopRoute(new NextRequest(`https://invtra.store${url.pathname}${url.search}`, { method: "POST" }));
    expect(res.status).toBe(303);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailReminders).toBe(false);
  });
});
