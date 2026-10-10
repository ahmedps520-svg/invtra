import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createEvent, eventToInput, updateEvent } from "@/server/events/service";
import { cardContent } from "@/server/events/design";
import { templateValues } from "@/server/whatsapp/compose";
import { reminderDue } from "@/server/reminders/service";
import { googleCalendarUrl, icsCalendar } from "@/server/invitations/calendar";
import { eventInputSchema, withDateRules } from "@/lib/validation/event";
import { whenLabel } from "@/lib/event-when";

const run = randomBytes(5).toString("hex");
let userId = "";

const base = (over: Record<string, unknown> = {}) =>
  eventInputSchema.parse({
    type: "NEWBORN",
    language: "BILINGUAL",
    title: "Welcome baby",
    hostNames: "Sara & Omar",
    timezone: "Asia/Riyadh",
    venueName: "Home",
    address: "Riyadh",
    date: "",
    time: "",
    ...over,
  });

beforeAll(async () => {
  userId = (await db.user.create({ data: { email: `dates-${run}@example.test`, name: "Dates", passwordHash: "x" } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: userId } });
});

describe("date and time to be announced", () => {
  it("needs a date and a time unless they're marked to be announced", () => {
    const rules = withDateRules(eventInputSchema);
    expect(rules.safeParse(base()).success).toBe(false);
    expect(rules.safeParse(base({ dateTbd: true, time: "19:00" })).success).toBe(true);
    expect(rules.safeParse(base({ dateTbd: true, timeTbd: true })).success).toBe(true);
    expect(rules.safeParse(base({ date: "2027-03-01", timeTbd: true })).success).toBe(true);
    const missing = rules.safeParse(base({ date: "2027-03-01" }));
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.map((i) => i.path.join("."))).toEqual(["time"]);
  });

  it("parks an unknown date about a year ahead and keeps it until the date is set", async () => {
    const event = await createEvent(userId, base({ dateTbd: true, timeTbd: true }));
    expect(event).toMatchObject({ dateTbd: true, timeTbd: true, endsAt: null });
    const ahead = event.startsAt.getTime() - Date.now();
    expect(ahead).toBeGreaterThan(300 * 86_400_000);
    expect(eventToInput({ ...event, scheduleItems: [] })).toMatchObject({ date: "", time: "", dateTbd: true, timeTbd: true });

    // Saving again (e.g. a new venue) keeps the same placeholder, so the card doesn't change for it.
    const again = await updateEvent(event, base({ dateTbd: true, timeTbd: true, venueName: "Grandma's" }));
    expect(again.event.startsAt.getTime()).toBe(event.startsAt.getTime());

    // The baby arrived: a real date and time.
    const set = await updateEvent(again.event, base({ date: "2027-03-01", time: "17:00" }));
    expect(set.cardChanged).toBe(true);
    expect(set.event).toMatchObject({ dateTbd: false, timeTbd: false });
    expect(set.event.startsAt.toISOString()).toBe("2027-03-01T14:00:00.000Z");
  });

  it("shows “to be announced” on the card, in messages and in labels", async () => {
    const event = await createEvent(userId, base({ dateTbd: true, timeTbd: true }));
    const c = cardContent(event);
    expect(c.date).toEqual({ en: "Date to be announced", ar: "الموعد يُعلن لاحقًا" });
    expect(c.time).toEqual({ en: "", ar: "" });
    const v = templateValues(event, { name: "Khalid" }, "TOKEN12345");
    expect(v.event_date).toBe("Date to be announced");
    expect(v.event_date_ar).toBe("الموعد يُعلن لاحقًا");
    expect(v.event_time).toBe("—");
    expect(whenLabel(event, "en")).toBe("Date to be announced");

    const timeOnly = await createEvent(userId, base({ date: "2027-03-01", timeTbd: true }));
    expect(cardContent(timeOnly).time.en).toBe("");
    expect(templateValues(timeOnly, { name: "Khalid" }, "TOKEN12345").event_time).toBe("Time to be announced");
    expect(whenLabel(timeOnly, "en")).toBe("Monday, 1 March 2027");
  });

  it("sends no reminder before the date is known, and an unknown time is an all-day calendar entry", async () => {
    const event = await createEvent(userId, base({ dateTbd: true, time: "19:00" }));
    const dayBefore = new Date(event.startsAt.getTime() - 20 * 3600_000);
    expect(reminderDue(event, { section: null, rsvpAt: null }, dayBefore)).toBe(false);
    const known = await createEvent(userId, base({ date: "2027-03-01", time: "19:00" }));
    expect(reminderDue(known, { section: null, rsvpAt: null }, new Date(known.startsAt.getTime() - 20 * 3600_000))).toBe(true);

    const allDay = await createEvent(userId, base({ date: "2027-03-01", timeTbd: true }));
    const ics = icsCalendar(allDay, { lang: "en", url: "https://invtra.store/i/X", uid: "u1" });
    expect(ics).toContain("DTSTART;VALUE=DATE:20270301");
    expect(ics).toContain("DTEND;VALUE=DATE:20270302");
    expect(googleCalendarUrl(allDay, { lang: "en", url: "https://invtra.store/i/X" })).toContain("dates=20270301%2F20270302");
  });
});
