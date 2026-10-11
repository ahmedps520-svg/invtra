/**
 * The host's check-in dashboard: the door scan log (including codes turned away), the
 * dashboard numbers with incremental polling, check-in from the dashboard and the CSV.
 */
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { THEMES } from "@/lib/themes/registry";
import { ensureInvitation, invitationQrText } from "@/server/invitations";
import { doorCheckIn, doorScan } from "@/server/door/service";
import { checkinDashboard, exportCheckinCsv } from "@/server/door/dashboard";

const run = randomBytes(5).toString("hex");
const userIds: string[] = [];

async function makeEvent(sections = false) {
  const user = await db.user.create({ data: { email: `checkin-${run}-${userIds.length}@example.test`, name: "Checkin Host", passwordHash: "x" } });
  userIds.push(user.id);
  return db.event.create({
    data: {
      userId: user.id,
      title: "Noura's Baby Shower",
      hostNames: "Noura",
      language: "EN",
      timezone: "Asia/Riyadh",
      startsAt: new Date(Date.now() + 3600_000),
      venueName: "Home",
      address: "Riyadh",
      themeKey: "minimal",
      design: THEMES.minimal.defaults as object,
      plan: "BASIC",
      guestLimit: 200,
      sectionsEnabled: sections,
    },
  });
}

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("check-in dashboard", () => {
  it("logs every door scan, including the ones turned away", async () => {
    const event = await makeEvent();
    const other = await makeEvent();
    const reem = await db.guest.create({ data: { eventId: event.id, name: "Reem", phone: "+966501110001", rsvpStatus: "ACCEPTED", attendingCount: 2, allowedCount: 3 } });
    const maha = await db.guest.create({ data: { eventId: event.id, name: "Maha", phone: "+966501110002" } });
    const gone = await db.guest.create({ data: { eventId: event.id, name: "Cancelled", phone: "+966501110003", rsvpStatus: "ACCEPTED" } });
    const tester = await db.guest.create({ data: { eventId: event.id, name: "Host test", phone: "+966501110004", isTest: true } });
    const stranger = await db.guest.create({ data: { eventId: other.id, name: "Stranger", phone: "+966501110005" } });

    const reemInv = await ensureInvitation(reem);
    await doorScan(event, invitationQrText(reemInv.token));
    await doorScan(event, invitationQrText(reemInv.token)); // the same code twice in a row → logged once
    await doorScan(event, (await ensureInvitation(maha)).token);
    const goneInv = await ensureInvitation(gone);
    await db.invitation.update({ where: { id: goneInv.id }, data: { status: "REVOKED" } });
    await doorScan(event, goneInv.token);
    await doorScan(event, (await ensureInvitation(tester)).token); // the host's test: works, not logged
    await doorScan(event, (await ensureInvitation(stranger)).token);
    await doorScan(event, "not a code");
    await doorCheckIn(event, reem.id, { count: 2 });
    await doorScan(event, reemInv.token);

    const log = await db.doorScan.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "asc" } });
    expect(log.map((s) => [s.result, s.guestId])).toEqual([
      ["VALID", reem.id],
      ["NOT_ACCEPTED", maha.id],
      ["REVOKED", gone.id],
      ["OTHER_EVENT", null],
      ["UNKNOWN", null],
      ["ALREADY_IN", reem.id],
    ]);
    // The stranger's event knows nothing about it.
    expect(await db.doorScan.count({ where: { eventId: other.id } })).toBe(0);

    const data = await checkinDashboard(event);
    expect(data.full).toBe(true);
    expect(data.total).toMatchObject({ accepted: 2, arrivedGuests: 1, arrived: 2 });
    expect(data.guests.map((g) => g.name)).toEqual(["Cancelled", "Maha", "Reem"]); // test guest left out
    expect(data.guests.find((g) => g.id === gone.id)?.revoked).toBe(true);
    expect(data.guests.find((g) => g.id === reem.id)).toMatchObject({ checkedInCount: 2, phone: "+966501110001", phoneTail: "0001" });
    expect(data.scans[0]).toMatchObject({ result: "ALREADY_IN", name: "Reem" });
    expect(data.scans.find((s) => s.result === "UNKNOWN")?.name).toBeNull();
    expect(data.scanTotals).toEqual({ VALID: 1, ALREADY_IN: 1, NOT_ACCEPTED: 1, UNKNOWN: 1, OTHER_EVENT: 1, REVOKED: 1 });
    expect(data.door.url).toBeNull();
  });

  it("returns only guests changed since the last poll, and checks guests in for the host", async () => {
    const event = await makeEvent(true);
    const a = await db.guest.create({ data: { eventId: event.id, name: "Abdullah", phone: "+966502220001", section: "MEN", rsvpStatus: "ACCEPTED", allowedCount: 4 } });
    await db.guest.create({ data: { eventId: event.id, name: "Bayan", phone: "+966502220002", section: "WOMEN", rsvpStatus: "ACCEPTED" } });

    const first = await checkinDashboard(event);
    expect(first.guests).toHaveLength(2);
    expect(first.sections?.MEN).toMatchObject({ expected: 4, arrived: 0 });

    const since = new Date(first.now);
    expect((await checkinDashboard(event, since)).guests).toHaveLength(0);

    const checked = await doorCheckIn(event, a.id, { count: 3, byHost: true });
    expect(checked).toMatchObject({ checkedInCount: 3, section: "MEN" });
    const activity = await db.activity.findFirst({ where: { eventId: event.id, kind: "guest.checked_in" } });
    expect(activity?.data).toMatchObject({ name: "Abdullah", count: 3, door: false });

    const next = await checkinDashboard(event, since);
    expect(next.full).toBe(false);
    expect(next.guests.map((g) => g.name)).toEqual(["Abdullah"]);
    expect(next.sections?.MEN).toMatchObject({ arrived: 3, arrivedGuests: 1 });

    // Changing the count keeps the original arrival time.
    const again = await doorCheckIn(event, a.id, { count: 4, byHost: true });
    expect(again.checkedInAt).toBe(checked.checkedInAt);

    const csv = await exportCheckinCsv(event);
    const [head, firstRow, secondRow] = csv.split(/\r?\n/);
    expect(head).toBe("Name,Phone,Group,Section,RSVP,Invited for,Confirmed,Arrived,People arrived,Arrival time");
    expect(firstRow).toMatch(/^Abdullah,\+966502220001,,Men's section,ACCEPTED,4,,Yes,4,\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    expect(secondRow).toBe("Bayan,+966502220002,,Women's section,ACCEPTED,1,,No,,");

    expect((await doorCheckIn(event, a.id, { undo: true, byHost: true })).checkedInAt).toBeNull();
  });
});
