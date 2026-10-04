/**
 * Men's and women's sections, add-to-calendar, the door check-in link for staff, and
 * reminders (day before + reply reminders), against the test database and the mock
 * WhatsApp provider.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { THEMES } from "@/lib/themes/registry";
import { parseSections, parseSectionValue, sectionsSchema } from "@/lib/sections";
import { eventForGuest, sectionStartsAt } from "@/server/events/sections";
import { eventToInput, updateEvent } from "@/server/events/service";
import { templateValues } from "@/server/whatsapp/compose";
import { manualMessage } from "@/server/sending/manual";
import { previewImport, importGuests } from "@/server/guests/service";
import { ensureInvitation, invitationQrText } from "@/server/invitations";
import { buildInvitationVM } from "@/server/invitations/view-model";
import { googleCalendarUrl, icsCalendar } from "@/server/invitations/calendar";
import { doorCheckIn, doorScan, doorSearch, doorSummary, findDoorEvent, setDoorLink, tokenFromCode } from "@/server/door/service";
import { followUpList, markFollowUp, queueDueReminders, reminderDue, reminderOverview, startNudges } from "@/server/reminders/service";
import { claimJobs, completeJob, failJob, type JobType } from "@/server/queue/queue";
import { handlers } from "@/server/queue/handlers";
import { templateCatalog } from "@/server/whatsapp/catalog";
import { GET as calendarRoute } from "@/app/i/[token]/calendar/route";
import { GET as doorGet, POST as doorPost } from "@/app/api/door/[token]/route";
import { GET as qrRoute } from "@/app/Q/[token]/route";

const run = randomBytes(5).toString("hex");
const userIds: string[] = [];
const HOUR = 3600_000;

const SECTIONS = {
  MEN: { time: null, venueName: null, venueNameAr: null, address: null, addressAr: null, mapsUrl: null, note: null, noteAr: null },
  WOMEN: {
    time: "21:30",
    venueName: "Al Faisaliah Ballroom",
    venueNameAr: "قاعة الفيصلية",
    address: "King Fahd Rd, Riyadh",
    addressAr: "طريق الملك فهد، الرياض",
    mapsUrl: null,
    note: "Ladies' entrance from gate 2",
    noteAr: "مدخل السيدات من البوابة ٢",
  },
};

async function makeEvent(opts: { startsAt?: Date; sections?: boolean; language?: "EN" | "AR" | "BILINGUAL"; autoReminder?: boolean } = {}) {
  const user = await db.user.create({ data: { email: `features-${run}-${userIds.length}@example.test`, name: "Feature Host", passwordHash: "x" } });
  userIds.push(user.id);
  return db.event.create({
    data: {
      userId: user.id,
      title: "Ahmed & Sara's Wedding",
      titleAr: "زفاف أحمد وسارة",
      hostNames: "The Al Saleh family",
      hostNamesAr: "عائلة الصالح",
      language: opts.language ?? "EN",
      timezone: "Asia/Riyadh",
      startsAt: opts.startsAt ?? new Date("2026-12-10T17:00:00Z"), // 20:00 Riyadh
      venueName: "Riyadh Front",
      venueNameAr: "واجهة الرياض",
      address: "Airport Rd, Riyadh",
      themeKey: "minimal",
      design: THEMES.minimal.defaults as object,
      plan: "BASIC",
      guestLimit: 200,
      sectionsEnabled: opts.sections ?? false,
      sections: opts.sections ? (SECTIONS as unknown as Prisma.InputJsonValue) : undefined,
      autoReminder: opts.autoReminder ?? true,
    },
  });
}

async function drain() {
  for (let i = 0; i < 50; i++) {
    await db.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date(0) } });
    const jobs = await claimJobs("features-test", 50);
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
}

beforeAll(async () => {
  // Mock provider: the standard templates count as approved (as on a fresh mock deploy).
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
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("men's and women's sections", () => {
  it("reads section names from spreadsheets in English and Arabic", () => {
    for (const v of ["Men", "men's section", "M", "رجال", "قسم الرجال", "Male"]) expect(parseSectionValue(v)).toBe("MEN");
    for (const v of ["Women", "Women's Section", "F", "نساء", "قسم النساء", "Ladies", "حريم"]) expect(parseSectionValue(v)).toBe("WOMEN");
    for (const v of ["", "both", "VIP", null]) expect(parseSectionValue(v)).toBeNull();
    expect(sectionsSchema.safeParse({ MEN: { mapsUrl: "https://evil.example/x" }, WOMEN: {} }).success).toBe(false);
    expect(parseSections(null).WOMEN.time).toBeNull();
  });

  it("gives each guest their section's time, place and note — on the page, in messages and in the calendar", async () => {
    const event = await makeEvent({ sections: true, language: "BILINGUAL" });
    const sara = await db.guest.create({ data: { eventId: event.id, name: "Sara", phone: "+966501230001", section: "WOMEN" } });
    const ali = await db.guest.create({ data: { eventId: event.id, name: "Ali", phone: "+966501230002", section: "MEN" } });

    // 21:30 Riyadh on the same day; a time after midnight belongs to the night after.
    expect(sectionStartsAt(event, "21:30").toISOString()).toBe("2026-12-10T18:30:00.000Z");
    expect(sectionStartsAt(event, "00:30").toISOString()).toBe("2026-12-10T21:30:00.000Z");

    const women = eventForGuest(event, sara);
    expect(women.startsAt.toISOString()).toBe("2026-12-10T18:30:00.000Z");
    expect(women.venueName).toBe("Al Faisaliah Ballroom");
    expect(women.endsAt).toBeNull();
    expect(eventForGuest(event, ali)).toStrictEqual(event); // nothing set for men → the main details

    const v = templateValues(event, sara, "TOKEN12345");
    expect(v.event_time).toBe("9:30 PM");
    expect(v.venue).toBe("Al Faisaliah Ballroom");
    expect(v.venue_ar).toBe("قاعة الفيصلية");
    expect(templateValues(event, ali, "TOKEN12345").event_time).toBe("8:00 PM");

    const text = manualMessage(event, sara, "TOKEN12345");
    expect(text).toContain("🚪 قسم النساء — مدخل السيدات من البوابة ٢");
    expect(text).toContain("🚪 Women's section — Ladies' entrance from gate 2");

    const inv = await ensureInvitation(sara);
    const full = await db.event.findUniqueOrThrow({ where: { id: event.id }, include: { scheduleItems: true, galleryImages: true } });
    const vm = await buildInvitationVM({ event: full, guest: sara, token: inv.token, mode: "guest" });
    expect(vm.section).toMatchObject({ key: "WOMEN", label: { en: "Women's section", ar: "قسم النساء" }, noteAr: "مدخل السيدات من البوابة ٢" });
    expect(vm.event.venueName).toBe("Al Faisaliah Ballroom");
    expect(vm.event.time.en).toBe("9:30 PM");
    expect(vm.event.googleCalendarUrl).toContain("dates=20261210T183000Z%2F20261210T223000Z");

    // Turning sections off: everyone sees the main details again (the choice is kept).
    const off = await buildInvitationVM({ event: { ...full, sectionsEnabled: false }, guest: sara, token: inv.token, mode: "guest" });
    expect(off.section).toBeNull();
    expect(off.event.venueName).toBe("Riyadh Front");
  });

  it("imports the section column and new section details print new cards", async () => {
    const event = await makeEvent({ sections: true });
    const csv = Buffer.from("Name,Phone,Section\nHuda,0501230011,نساء\nFahad,0501230012,Men\nZaid,0501230013,\n");
    const preview = await previewImport(event.id, { name: "list.csv", data: csv }, "SA");
    expect(preview.rows.map((r) => r.section)).toEqual(["WOMEN", "MEN", null]);
    await importGuests(
      event.id,
      preview.rows.map((r) => ({ name: r.name, phone: r.phone, groupName: null, allowedCount: 1, section: r.section, locale: null, notes: null })),
      "SA",
    );
    expect((await db.guest.findMany({ where: { eventId: event.id }, orderBy: { name: "asc" } })).map((g) => [g.name, g.section])).toEqual([
      ["Fahad", "MEN"],
      ["Huda", "WOMEN"],
      ["Zaid", null],
    ]);

    const withSchedule = await db.event.findUniqueOrThrow({ where: { id: event.id }, include: { scheduleItems: true } });
    const input = eventToInput(withSchedule);
    expect(input.sections?.WOMEN.venueName).toBe("Al Faisaliah Ballroom");
    const same = await updateEvent(withSchedule, input);
    expect(same.cardChanged).toBe(false);
    const moved = await updateEvent(same.event, { ...input, sections: { ...input.sections!, WOMEN: { ...input.sections!.WOMEN, time: "22:00" } } });
    expect(moved.cardChanged).toBe(true);
  });
});

describe("add to calendar", () => {
  it("builds a valid .ics and Google link at the guest's time and place", async () => {
    const event = await makeEvent({ sections: true });
    const sara = await db.guest.create({ data: { eventId: event.id, name: "Sara", phone: "+966501230021", section: "WOMEN" } });
    const inv = await ensureInvitation(sara);
    const res = await calendarRoute(new NextRequest(`https://invtra.store/i/${inv.token}/calendar`), { params: Promise.resolve({ token: inv.token }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("DTSTART:20261210T183000Z");
    expect(body).toContain("DTEND:20261210T223000Z");
    expect(body).toContain("LOCATION:Al Faisaliah Ballroom\\, King Fahd Rd\\, Riyadh");
    expect(body).toContain("BEGIN:VALARM");
    for (const line of body.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);

    // Semicolons are escaped (the old escape was a no-op).
    const ics = icsCalendar({ ...event, title: "A; B" }, { lang: "en", url: "https://invtra.store/i/X", uid: "u1" });
    expect(ics).toContain("SUMMARY:A\\; B");
    const g = new URL(googleCalendarUrl(event, { lang: "ar", url: "https://invtra.store/i/X" }));
    expect(g.searchParams.get("text")).toBe("زفاف أحمد وسارة");
    expect(g.searchParams.get("location")).toBe("واجهة الرياض, Airport Rd, Riyadh");

    // Declined guests have nothing to add.
    await db.guest.update({ where: { id: sara.id }, data: { rsvpStatus: "DECLINED" } });
    const declined = await calendarRoute(new NextRequest(`https://invtra.store/i/${inv.token}/calendar`), { params: Promise.resolve({ token: inv.token }) });
    expect(declined.status).toBe(404);
  });
});

describe("door check-in link", () => {
  it("lets staff scan, search and check guests in — and stops working when replaced", async () => {
    const event = await makeEvent({ sections: true, startsAt: new Date(Date.now() + 2 * HOUR) });
    const sara = await db.guest.create({
      data: { eventId: event.id, name: "Sara Al Harbi", phone: "+966501239876", section: "WOMEN", allowedCount: 3, rsvpStatus: "ACCEPTED", attendingCount: 2 },
    });
    const ali = await db.guest.create({ data: { eventId: event.id, name: "Ali", phone: "+966501230032", section: "MEN", rsvpStatus: "ACCEPTED", attendingCount: 1 } });
    const other = await makeEvent();
    const stranger = await db.guest.create({ data: { eventId: other.id, name: "Stranger", phone: "+966501230033" } });

    const token = (await setDoorLink(event, "create"))!;
    expect(await setDoorLink({ id: event.id, doorToken: token }, "create")).toBe(token); // idempotent
    expect((await findDoorEvent(token))?.id).toBe(event.id);
    expect(await findDoorEvent("not-a-real-door-link-123")).toBeNull();

    const inv = await ensureInvitation(sara);
    expect(tokenFromCode(invitationQrText(inv.token))).toBe(inv.token);
    expect(tokenFromCode(`https://invtra.store/i/${inv.token}?via=qr`)).toBe(inv.token);
    expect(tokenFromCode("hello")).toBeNull();

    const scanned = await doorScan(event, invitationQrText(inv.token));
    expect(scanned).toMatchObject({ ok: true, guest: { name: "Sara Al Harbi", section: "WOMEN", phoneTail: "9876", attendingCount: 2, checkedInAt: null } });
    expect(await db.qRScan.count({ where: { guestId: sara.id, byHost: true } })).toBe(1);
    expect(await doorScan(event, (await ensureInvitation(stranger)).token)).toEqual({ ok: false, reason: "other_event" });
    expect(await doorScan(event, "ZZZZZZZZZZ")).toEqual({ ok: false, reason: "unknown" });

    expect((await doorSearch(event, "harbi")).map((g) => g.name)).toEqual(["Sara Al Harbi"]);
    expect((await doorSearch(event, "9876")).map((g) => g.name)).toEqual(["Sara Al Harbi"]);
    expect(await doorSearch(event, "S")).toEqual([]);
    expect((await doorSearch(event, "Stranger")).length).toBe(0);

    const checked = await doorCheckIn(event, sara.id, { count: 3 });
    expect(checked.checkedInCount).toBe(3);
    await doorCheckIn(event, ali.id, {});
    const summary = await doorSummary(event);
    expect(summary.total).toMatchObject({ accepted: 2, expected: 3, arrivedGuests: 2, arrived: 4 });
    expect(summary.sections?.WOMEN).toMatchObject({ expected: 2, arrived: 3 });
    expect(summary.recent[0].name).toBeDefined();
    expect((await doorCheckIn(event, ali.id, { undo: true })).checkedInAt).toBeNull();
    await expect(doorCheckIn(event, stranger.id, {})).rejects.toMatchObject({ status: 404 });

    // The HTTP API (no sign-in) behind the link.
    const ip = { "x-forwarded-for": `10.77.${run.length}.9` };
    const get = await doorGet(new NextRequest(`https://invtra.store/api/door/${token}?q=ali`, { headers: ip }), { params: Promise.resolve({ token }) });
    expect((await get.json()).results.map((g: { name: string }) => g.name)).toEqual(["Ali"]);
    const post = await doorPost(
      new NextRequest(`https://invtra.store/api/door/${token}`, { method: "POST", body: JSON.stringify({ guestId: ali.id, count: 1 }), headers: { ...ip, "content-type": "application/json" } }),
      { params: Promise.resolve({ token }) },
    );
    expect((await post.json()).guest.checkedInCount).toBe(1);

    // A QR scanned with the staff phone's own camera opens the door view for that guest.
    const qr = await qrRoute(new NextRequest(`https://invtra.store/Q/${inv.token}`, { headers: { ...ip, cookie: `invtra_door=${token}` } }), {
      params: Promise.resolve({ token: inv.token }),
    });
    expect(qr.status).toBe(302);
    expect(qr.headers.get("location")).toContain(`/door/${token}?g=${inv.token}`);

    // A new link revokes the old one.
    const fresh = await setDoorLink({ id: event.id, doorToken: token }, "regenerate");
    expect(fresh).not.toBe(token);
    expect(await findDoorEvent(token)).toBeNull();
    const gone = await doorGet(new NextRequest(`https://invtra.store/api/door/${token}`, { headers: ip }), { params: Promise.resolve({ token }) });
    expect(gone.status).toBe(404);
    await setDoorLink({ id: event.id, doorToken: fresh }, "disable");
    expect(await findDoorEvent(fresh!)).toBeNull();

    // Links close two days after the event.
    const past = await makeEvent({ startsAt: new Date(Date.now() - 4 * 86_400_000) });
    const pastToken = (await setDoorLink(past, "create"))!;
    expect(await findDoorEvent(pastToken)).toBeNull();
  });
});

describe("reminders", () => {
  it("sends the day-before reminder once to accepted guests INVTRA invited, at their section's time", async () => {
    const now = new Date();
    // Men start in 20 hours (reminder due); women 3 hours later (due as well).
    const startsAt = new Date(now.getTime() + 20 * HOUR);
    const event = await makeEvent({ sections: true, startsAt });
    const sent = new Date(now.getTime() - 5 * 86_400_000);
    const base = { eventId: event.id, rsvpStatus: "ACCEPTED" as const, rsvpAt: sent, requestSentAt: sent, deliveryStatus: "READ" as const };
    const viaInvtra = await db.guest.create({ data: { ...base, name: "Khalid", phone: "+966501230041", section: "MEN" } });
    const manual = await db.guest.create({ data: { ...base, name: "Mona", phone: "+966501230042", manualSentAt: sent } });
    const recent = await db.guest.create({ data: { ...base, name: "Late", phone: "+966501230043", rsvpAt: new Date(now.getTime() - HOUR) } });
    const pending = await db.guest.create({ data: { ...base, name: "Pending", phone: "+966501230044", rsvpStatus: "PENDING", rsvpAt: null } });

    expect(reminderDue(event, viaInvtra, now)).toBe(true);
    expect(reminderDue(event, recent, now)).toBe(false); // accepted an hour ago
    expect(reminderDue(event, viaInvtra, new Date(now.getTime() - 6 * HOUR))).toBe(false); // too early

    await queueDueReminders(now);
    const jobs = await db.job.findMany({ where: { eventId: event.id, type: "reminder.send" } });
    expect(jobs.map((j) => (j.payload as { guestId: string }).guestId)).toEqual([viaInvtra.id]);
    await queueDueReminders(now); // never twice
    expect(await db.job.count({ where: { eventId: event.id, type: "reminder.send" } })).toBe(1);

    await drain();
    const msg = await db.whatsAppMessage.findFirstOrThrow({ where: { guestId: viaInvtra.id, purpose: "REMINDER" } });
    expect((msg.content as { body: string }).body).toContain("Riyadh Front");
    expect((await db.guest.findUniqueOrThrow({ where: { id: viaInvtra.id } })).reminderSentAt).toBeInstanceOf(Date);
    expect(await db.whatsAppMessage.count({ where: { guestId: { in: [manual.id, recent.id, pending.id] }, purpose: "REMINDER" } })).toBe(0);

    // The host's own list: every accepted guest, with INVTRA's ones marked.
    const list = await followUpList(event, "reminder");
    expect(list.map((g) => [g.name, Boolean(g.doneAt), g.auto])).toEqual([
      ["Khalid", true, true],
      ["Mona", false, false],
      ["Late", false, true],
    ]);
    const mona = list.find((g) => g.name === "Mona")!;
    expect(decodeURIComponent(mona.waUrl)).toContain("a reminder for Ahmed & Sara's Wedding");
    expect(decodeURIComponent(mona.waUrl)).toContain("google.com/maps");
    await markFollowUp(event, manual.id, "reminder");
    const overview = await reminderOverview(event);
    expect(overview).toMatchObject({ accepted: 3, reminded: 2, autoCount: 2, reminderTemplate: true });

    // A new date resets the reminders.
    const withSchedule = await db.event.findUniqueOrThrow({ where: { id: event.id }, include: { scheduleItems: true } });
    const input = eventToInput(withSchedule);
    await updateEvent(withSchedule, { ...input, date: "2027-01-15" });
    expect(await db.guest.count({ where: { eventId: event.id, reminderSentAt: { not: null } } })).toBe(0);
  });

  it("reminds guests who haven't replied — at most twice through INVTRA", async () => {
    const event = await makeEvent({ startsAt: new Date(Date.now() + 10 * 86_400_000) });
    const sent = new Date(Date.now() - 3 * 86_400_000);
    const waiting = await db.guest.create({ data: { eventId: event.id, name: "Waiting", phone: "+966501230051", requestSentAt: sent, deliveryStatus: "DELIVERED" } });
    const fresh = await db.guest.create({ data: { eventId: event.id, name: "Fresh", phone: "+966501230052", requestSentAt: new Date(), deliveryStatus: "DELIVERED" } });
    const manual = await db.guest.create({ data: { eventId: event.id, name: "Manual", phone: "+966501230053", manualSentAt: sent, requestSentAt: sent, deliveryStatus: "SENT" } });

    expect((await reminderOverview(event)).canNudge).toBe(1);
    expect(await startNudges(event)).toEqual({ queued: 1 });
    await drain();
    const msg = await db.whatsAppMessage.findFirstOrThrow({ where: { guestId: waiting.id, purpose: "NUDGE" } });
    expect((msg.content as { buttons: { payload?: string }[] }).buttons[0].payload).toMatch(/^INVTRA\|ACCEPT\|/);
    expect(await db.whatsAppMessage.count({ where: { guestId: { in: [fresh.id, manual.id] }, purpose: "NUDGE" } })).toBe(0);
    // Not again so soon.
    await expect(startNudges(event)).rejects.toMatchObject({ code: "nothing_to_send" });

    // Two days later, once more — then never through INVTRA.
    await db.guest.update({ where: { id: waiting.id }, data: { nudgedAt: new Date(Date.now() - 3 * 86_400_000) } });
    expect(await startNudges(event)).toEqual({ queued: 1 });
    await drain();
    await db.guest.update({ where: { id: waiting.id }, data: { nudgedAt: new Date(Date.now() - 3 * 86_400_000) } });
    expect((await db.guest.findUniqueOrThrow({ where: { id: waiting.id } })).nudgeCount).toBe(2);
    await expect(startNudges(event)).rejects.toMatchObject({ code: "nothing_to_send" });

    // From the host's WhatsApp: everyone invited who hasn't replied, no limit.
    const list = await followUpList(event, "nudge");
    expect(list.map((g) => g.name)).toEqual(["Waiting", "Fresh", "Manual"]);
    expect(decodeURIComponent(list[2].waUrl)).toContain("Please reply on your invitation");
  });
});
