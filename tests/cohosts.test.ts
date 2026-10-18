/**
 * Co-hosts: inviting someone to keep their own guest list, accepting the signed link, and
 * what each side can then see and change — a co-host only their own list, through every
 * guest route — plus list limits, numbers already on another list, and removing a co-host.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { THEMES } from "@/lib/themes/registry";

const session = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/server/auth/session", async (orig) => ({ ...(await orig<object>()), getSessionUser: vi.fn(async () => session.user) }));
const mail = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock("@/server/email", () => ({ sendEmail: vi.fn(async (m: (typeof mail)[number]) => void mail.push(m)) }));

import { acceptInvite, findGuestAccess, findInvite, inviteCoHost, inviteToken, MAX_COHOSTS } from "@/server/events/cohosts";
import * as guestsRoute from "@/app/api/events/[id]/guests/route";
import * as guestRoute from "@/app/api/events/[id]/guests/[guestId]/route";
import * as bulkDelete from "@/app/api/events/[id]/guests/bulk-delete/route";
import * as sectionRoute from "@/app/api/events/[id]/guests/section/route";
import * as exportRoute from "@/app/api/events/[id]/guests/export/route";
import * as importRoute from "@/app/api/events/[id]/guests/import/route";
import * as rsvpRoute from "@/app/api/events/[id]/guests/[guestId]/rsvp/route";
import * as coHostsRoute from "@/app/api/events/[id]/cohosts/route";
import * as coHostRoute from "@/app/api/events/[id]/cohosts/[coHostId]/route";
import * as acceptRoute from "@/app/api/cohost/accept/route";
import * as statsRoute from "@/app/api/events/[id]/stats/route";

const run = randomBytes(4).toString("hex");
const userIds: string[] = [];
let phone = 0;
const nextPhone = () => `+9665${String(30000000 + Number.parseInt(run.slice(0, 4), 16) * 100 + phone++).slice(-8)}`;

async function makeUser(name = "Host") {
  const user = await db.user.create({
    data: { email: `cohost-${run}-${userIds.length}@example.test`, name, passwordHash: "x", emailVerifiedAt: new Date(), locale: "en" },
  });
  userIds.push(user.id);
  return user;
}
async function makeEvent(userId: string) {
  return db.event.create({
    data: {
      userId,
      title: "Noura & Faisal",
      hostNames: "Noura & Faisal",
      startsAt: new Date(Date.now() + 30 * 86_400_000),
      venueName: "Ritz-Carlton",
      address: "Riyadh",
      themeKey: "royal",
      design: THEMES.royal.defaults as object,
      plan: "BASIC",
      sectionsEnabled: true,
    },
  });
}

const base = "https://invtra.store";
const req = (path: string, method = "GET", body?: unknown) =>
  new NextRequest(`${base}${path}`, { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
const as = (user: unknown) => (session.user = user);
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });
const json = async (res: Response) => ({ status: res.status, body: await res.json().catch(() => null) });

/** An owner, their event, and a co-host who has accepted. */
async function setup(guestLimit: number | null = null) {
  const owner = await makeUser("Noura");
  const event = await makeEvent(owner.id);
  const family = await makeUser("Faisal's mother");
  const invited = await inviteCoHost(owner, event, { label: "Groom's family", email: family.email, guestLimit });
  await acceptInvite(family, inviteToken(invited));
  const coHost = await db.coHost.findUniqueOrThrow({ where: { id: invited.id } });
  return { owner, event, family, coHost };
}
async function addGuest(user: unknown, eventId: string, name: string, number = nextPhone()) {
  as(user);
  return json(await guestsRoute.POST(req(`/api/events/${eventId}/guests`, "POST", { name, phone: number, allowedCount: 1 }), ctx({ id: eventId })));
}
async function listGuests(user: unknown, eventId: string, query = "") {
  as(user);
  const r = await json(await guestsRoute.GET(req(`/api/events/${eventId}/guests${query}`), ctx({ id: eventId })));
  return (r.body.guests as { name: string; coHostId: string | null }[]).map((g) => g.name).sort();
}

beforeEach(() => {
  mail.length = 0;
  session.user = null;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("inviting a co-host", () => {
  it("emails a signed link that opens only for that invitation", async () => {
    const owner = await makeUser("Noura");
    const event = await makeEvent(owner.id);
    as(owner);
    const res = await json(await coHostsRoute.POST(req(`/api/events/${event.id}/cohosts`, "POST", { label: "Groom's family", email: "  Family@Example.TEST ", guestLimit: 150 }), ctx({ id: event.id })));
    expect(res.status).toBe(201);
    expect(res.body.coHosts).toEqual([expect.objectContaining({ label: "Groom's family", email: "family@example.test", guestLimit: 150, joined: false, guests: 0 })]);
    const link = res.body.coHosts[0].inviteUrl as string;
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ to: "family@example.test", subject: "Noura invited you to keep the guest list for Noura & Faisal" });
    expect(mail[0].text).toContain(link);

    const token = link.split("/cohost/")[1];
    expect((await findInvite(token))?.label).toBe("Groom's family");
    expect(await findInvite(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"))).toBeNull(); // tampered
    expect(await findInvite("nope")).toBeNull();
  });

  it("refuses the owner's own email, the same person twice, and more than five", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await expect(inviteCoHost(owner, event, { label: "Me", email: owner.email })).rejects.toMatchObject({ code: "cohost_self" });
    await inviteCoHost(owner, event, { label: "A", email: `a-${run}@example.test` });
    await expect(inviteCoHost(owner, event, { label: "A again", email: `a-${run}@example.test` })).rejects.toMatchObject({ code: "cohost_exists" });
    for (let i = 1; i < MAX_COHOSTS; i++) await inviteCoHost(owner, event, { label: `L${i}`, email: `l${i}-${run}@example.test` });
    await expect(inviteCoHost(owner, event, { label: "One more", email: `x-${run}@example.test` })).rejects.toMatchObject({ code: "too_many_cohosts" });
  });

  it("is managed by the owner only", async () => {
    const { event, family } = await setup();
    as(family);
    expect((await coHostsRoute.GET(req(`/api/events/${event.id}/cohosts`), ctx({ id: event.id }))).status).toBe(404);
    expect((await coHostsRoute.POST(req(`/api/events/${event.id}/cohosts`, "POST", { label: "X", email: `y-${run}@example.test` }), ctx({ id: event.id }))).status).toBe(404);
  });
});

describe("accepting", () => {
  it("binds the invitation to the account that accepts it, once", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    const invited = await inviteCoHost(owner, event, { label: "Bride's family", email: `bride-${run}@example.test` });
    const token = inviteToken(invited);

    await expect(acceptInvite(owner, token)).rejects.toMatchObject({ code: "cohost_own_event" });
    const family = await makeUser();
    as(family);
    const res = await json(await acceptRoute.POST(req("/api/cohost/accept", "POST", { token }), ctx({})));
    expect(res.body).toEqual({ redirectTo: `/dashboard/events/${event.id}/guests` });
    expect(await acceptInvite(family, token)).toEqual({ eventId: event.id }); // again: fine
    await expect(acceptInvite(await makeUser(), token)).rejects.toMatchObject({ code: "cohost_taken" });

    expect(await db.activity.findFirst({ where: { eventId: event.id, kind: "cohost.joined" } })).toMatchObject({ data: { label: "Bride's family" } });
    as(owner);
    const list = await json(await coHostsRoute.GET(req(`/api/events/${event.id}/cohosts`), ctx({ id: event.id })));
    expect(list.body.coHosts[0]).toMatchObject({ joined: true, joinedAs: "Host", inviteUrl: null });
  });

  it("needs a signed-in account", async () => {
    const res = await acceptRoute.POST(req("/api/cohost/accept", "POST", { token: "abcdefghijkl.mnop" }), ctx({}));
    expect(res.status).toBe(401);
  });
});

describe("each list stays separate", () => {
  it("a co-host adds to and sees only their own list; the owner sees every list and can filter", async () => {
    const { owner, event, family, coHost } = await setup();
    expect((await addGuest(owner, event.id, "Aunt Huda")).status).toBe(201);
    const added = await addGuest(family, event.id, "Uncle Saad");
    expect(added.body.guest.coHostId).toBe(coHost.id);

    expect(await listGuests(family, event.id)).toEqual(["Uncle Saad"]);
    expect(await listGuests(owner, event.id)).toEqual(["Aunt Huda", "Uncle Saad"]);
    expect(await listGuests(owner, event.id, "?list=own")).toEqual(["Aunt Huda"]);
    expect(await listGuests(owner, event.id, `?list=${coHost.id}`)).toEqual(["Uncle Saad"]);
    // A co-host can't widen their view with the owner's filter.
    expect(await listGuests(family, event.id, "?list=own")).toEqual(["Uncle Saad"]);
  });

  it("a co-host can't open, edit, answer for, move or delete anyone else's guests", async () => {
    const { owner, event, family } = await setup();
    const theirs = (await addGuest(owner, event.id, "Aunt Huda")).body.guest;
    const mine = (await addGuest(family, event.id, "Uncle Saad")).body.guest;
    as(family);
    const g = (id: string) => ctx({ id: event.id, guestId: id });
    expect((await guestRoute.GET(req(`/api/events/${event.id}/guests/${theirs.id}`), g(theirs.id))).status).toBe(404);
    expect((await guestRoute.PATCH(req("/x", "PATCH", { name: "Changed", phone: theirs.phone, allowedCount: 1 }), g(theirs.id))).status).toBe(404);
    expect((await rsvpRoute.POST(req("/x", "POST", { response: "DECLINED" }), g(theirs.id))).status).toBe(404);
    expect((await guestRoute.DELETE(req("/x", "DELETE"), g(theirs.id))).status).toBe(404);

    const moved = await json(await sectionRoute.POST(req("/x", "POST", { ids: [theirs.id, mine.id], section: "MEN" }), ctx({ id: event.id })));
    expect(moved.body).toEqual({ updated: 1 });
    const deleted = await json(await bulkDelete.POST(req("/x", "POST", { ids: [theirs.id, mine.id] }), ctx({ id: event.id })));
    expect(deleted.body).toEqual({ deleted: 1 });
    expect(await db.guest.findUnique({ where: { id: theirs.id } })).toMatchObject({ name: "Aunt Huda", section: null, rsvpStatus: "PENDING" });
    expect(await db.guest.findUnique({ where: { id: mine.id } })).toBeNull();
  });

  it("exports a co-host's own list, and the owner's whole list with each guest's list", async () => {
    const { owner, event, family } = await setup();
    await addGuest(owner, event.id, "Aunt Huda");
    await addGuest(family, event.id, "Uncle Saad");
    as(family);
    const theirs = await (await exportRoute.GET(req("/x"), ctx({ id: event.id }))).text();
    expect(theirs).toContain("Uncle Saad");
    expect(theirs).not.toContain("Aunt Huda");
    expect(theirs.split("\n")[0]).not.toContain("List");
    as(owner);
    const all = await (await exportRoute.GET(req("/x"), ctx({ id: event.id }))).text();
    expect(all.split("\n")[0]).toContain("List");
    expect(all).toMatch(/Aunt Huda,[^\n]*Your list/);
    expect(all).toMatch(/Uncle Saad,[^\n]*Groom's family/);
  });

  it("imports onto the co-host's list, within its limit", async () => {
    const { event, family, coHost } = await setup(2);
    as(family);
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Cousin ${i}`, phone: nextPhone() }));
    const tooMany = await json(await importRoute.POST(req("/x", "POST", { rows: rows(3) }), ctx({ id: event.id })));
    expect(tooMany).toMatchObject({ status: 400, body: { error: { code: "list_full", fields: { limit: "2" } } } });
    const ok = await json(await importRoute.POST(req("/x", "POST", { rows: rows(2) }), ctx({ id: event.id })));
    expect(ok.body).toMatchObject({ created: 2 });
    expect(await db.guest.count({ where: { coHostId: coHost.id } })).toBe(2);
    expect((await addGuest(family, event.id, "One more")).body.error.code).toBe("list_full");
  });

  it("says when a number is already invited on another list", async () => {
    const { owner, event, family } = await setup();
    const number = nextPhone();
    await addGuest(owner, event.id, "Aunt Huda", number);
    expect((await addGuest(family, event.id, "Huda", number)).body.error.code).toBe("duplicate_other_list");
    expect((await addGuest(owner, event.id, "Huda again", number)).body.error.code).toBe("duplicate_phone");
  });

  it("keeps the owner-only parts of the event from co-hosts", async () => {
    const { event, family } = await setup();
    as(family);
    expect((await statsRoute.GET(req("/x"), ctx({ id: event.id }))).status).toBe(404);
    expect(await findGuestAccess(await makeUser(), event.id)).toBeNull(); // a stranger
  });
});

describe("removing a co-host", () => {
  it("ends their access and moves their guests to the owner's list", async () => {
    const { owner, event, family, coHost } = await setup();
    const guest = (await addGuest(family, event.id, "Uncle Saad")).body.guest;
    as(owner);
    const res = await json(await coHostRoute.DELETE(req("/x", "DELETE"), ctx({ id: event.id, coHostId: coHost.id })));
    expect(res.body).toMatchObject({ moved: 1, coHosts: [] });
    expect(await db.guest.findUnique({ where: { id: guest.id } })).toMatchObject({ coHostId: null, name: "Uncle Saad" });
    expect(await findGuestAccess(family, event.id)).toBeNull();
    as(family);
    expect((await guestsRoute.GET(req("/x"), ctx({ id: event.id }))).status).toBe(404);
  });

  it("lets the owner rename a list, change its limit, and email the invitation again before they join", async () => {
    const owner = await makeUser("Noura");
    const event = await makeEvent(owner.id);
    const invited = await inviteCoHost(owner, event, { label: "Friends", email: `friends-${run}@example.test` });
    mail.length = 0;
    as(owner);
    const c = ctx({ id: event.id, coHostId: invited.id });
    const edited = await json(await coHostRoute.PATCH(req("/x", "PATCH", { label: "School friends", guestLimit: 40 }), c));
    expect(edited.body.coHosts[0]).toMatchObject({ label: "School friends", guestLimit: 40 });
    await coHostRoute.POST(req("/x", "POST", { action: "resend" }), c);
    expect(mail).toHaveLength(1);
    expect(mail[0].text).toContain(inviteToken(invited)); // the same link
  });
});
