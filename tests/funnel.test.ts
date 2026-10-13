/** Admin → Funnel: Riyadh weeks, each step of the funnel, sources and revenue. */
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { THEMES } from "@/lib/themes/registry";
import { funnel, sourceLabel, weekStart } from "@/server/admin/funnel";

const run = randomBytes(4).toString("hex");
const SOURCE = `utm:funnel${run}`;
const userIds: string[] = [];

async function makeUser(extra: Record<string, unknown> = {}) {
  const user = await db.user.create({
    data: { email: `funnel-${run}-${userIds.length}@example.test`, name: "Funnel", passwordHash: "x", source: SOURCE, ...extra },
  });
  userIds.push(user.id);
  return user;
}
async function makeEvent(userId: string, extra: Record<string, unknown> = {}) {
  return db.event.create({
    data: {
      userId,
      title: "Funnel party",
      hostNames: "A",
      startsAt: new Date(Date.now() + 30 * 86_400_000),
      venueName: "V",
      address: "A",
      themeKey: "minimal",
      design: THEMES.minimal.defaults as object,
      ...extra,
    },
  });
}

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("weeks", () => {
  it("start on Sunday at midnight in Riyadh", () => {
    // Saturday 17 Oct 2026, 23:30 in Riyadh → week of Sunday 11 Oct.
    expect(weekStart(new Date("2026-10-17T20:30:00Z")).toISOString()).toBe("2026-10-10T21:00:00.000Z");
    // Sunday 18 Oct, 00:30 in Riyadh → that Sunday.
    expect(weekStart(new Date("2026-10-17T21:30:00Z")).toISOString()).toBe("2026-10-17T21:00:00.000Z");
  });

  it("labels sources", () => {
    expect(sourceLabel(null)).toBe("Direct");
    expect(sourceLabel("invitation")).toBe("Invitation links");
    expect(sourceLabel("code:TIKTOK10")).toBe("Code TIKTOK10");
    expect(sourceLabel("utm:tiktok")).toBe("Ad: tiktok");
    expect(sourceLabel("staff")).toBe("Made by INVTRA");
  });
});

describe("funnel", () => {
  it("follows each sign-up through the steps", async () => {
    await makeUser(); // signed up only
    await makeUser({ emailVerifiedAt: new Date() }); // verified
    const designer = await makeUser({ emailVerifiedAt: new Date() });
    await makeEvent(designer.id);
    const listed = await makeUser({ emailVerifiedAt: new Date() });
    const listedEvent = await makeEvent(listed.id);
    await db.guest.create({ data: { eventId: listedEvent.id, name: "G", phone: "+966500001001" } });
    const payer = await makeUser({ emailVerifiedAt: new Date() });
    const paidEvent = await makeEvent(payer.id, { plan: "BASIC", firstSentAt: new Date() });
    await db.guest.create({ data: { eventId: paidEvent.id, name: "G", phone: "+966500001002", manualSentAt: new Date() } });
    await db.order.create({
      data: { userId: payer.id, eventId: paidEvent.id, plan: "BASIC", guestLimit: 100, amount: 49900, currency: "SAR", provider: "manual", status: "PAID", paidAt: new Date() },
    });
    // A test guest alone doesn't count as "added guests".
    const tester = await makeUser();
    const testEvent = await makeEvent(tester.id);
    await db.guest.create({ data: { eventId: testEvent.id, name: "Me", phone: "+966500001003", isTest: true } });
    // Staff accounts aren't customers.
    await makeUser({ role: "ADMIN" });

    const data = await funnel(4, SOURCE);
    expect(data.total).toEqual({ signedUp: 6, verified: 4, createdEvent: 4, addedGuests: 2, paid: 1, sent: 1 });
    // The tester created an event without verifying: counted, but not as carrying on from "verified".
    expect(data.continued).toEqual({ signedUp: 6, verified: 4, createdEvent: 3, addedGuests: 2, paid: 1, sent: 1 });
    const thisWeek = data.weekly.at(-1)!;
    expect(thisWeek).toMatchObject({ signedUp: 6, paid: 1, revenue: 49900 });
    expect(data.weekly).toHaveLength(4);
    expect(data.sources).toEqual([expect.objectContaining({ source: SOURCE, label: `Ad: funnel${run}`, signedUp: 6, paid: 1, revenue: 49900, codeId: null })]);
    // Revenue follows the source filter.
    expect(data.revenue).toEqual({ period: 49900, orders: 1, average: 49900, payers: 1 });
  });

  it("leaves out sign-ups from before the period", async () => {
    await makeUser({ createdAt: new Date(Date.now() - 60 * 86_400_000) });
    const data = await funnel(4, SOURCE);
    expect(data.total.signedUp).toBe(6);
    expect((await funnel(26, SOURCE)).total.signedUp).toBe(7);
  });
});
