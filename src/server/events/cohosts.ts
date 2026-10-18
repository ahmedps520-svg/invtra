import type { CoHost, Event, Prisma } from "@prisma/client";
import { Prisma as P } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { badRequest, conflict, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { recordActivity } from "@/server/activity";
import { generateSecretToken, hmac, safeEqual } from "@/server/security/tokens";
import { sendEmail } from "@/server/email";
import { renderEmail, renderEmailText } from "@/server/email-template";
import { coHostInviteEmail } from "@/server/emails";
import type { SessionUser } from "@/server/auth/session";

/**
 * Co-hosts: the owner invites someone (the groom's family, say) to keep their own guest list
 * for the event. The invitation goes by email as a signed link; whoever opens it signs in
 * with their own account and accepts. From then on they add, import and send to their own
 * guests only — they never see the owner's list or anyone else's, and can't change the
 * event, its design or its plan. Every list shares the plan's guest limit, and the owner can
 * also cap a co-host's list.
 */

export const MAX_COHOSTS = 5;

export const coHostInputSchema = z.object({
  label: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
  guestLimit: z.number().int().min(1).max(10_000).nullable().optional(),
});
export const coHostUpdateSchema = coHostInputSchema.pick({ label: true, guestLimit: true }).partial();

// ── Who can manage which guests ─────────────────────────────────────────────

export interface GuestAccess {
  event: Event;
  /** Set when the user is a co-host (they see and change only their own list). */
  coHost: CoHost | null;
  /** Narrows any guest query to what this user may see. */
  scope: Prisma.GuestWhereInput;
}

/** The event's guests this user may manage: all of them for the owner, their own list for a co-host. */
export async function findGuestAccess(user: Pick<SessionUser, "id">, eventId: string): Promise<GuestAccess | null> {
  const event = await db.event.findFirst({ where: { id: eventId, deletedAt: null } });
  if (!event) return null;
  if (event.userId === user.id) return { event, coHost: null, scope: {} };
  const coHost = await db.coHost.findFirst({ where: { eventId, userId: user.id } });
  return coHost ? { event, coHost, scope: { coHostId: coHost.id } } : null;
}

export async function getGuestAccess(user: Pick<SessionUser, "id">, eventId: string): Promise<GuestAccess> {
  const access = await findGuestAccess(user, eventId);
  if (!access) throw notFound("Event");
  return access;
}

/** One guest, if this user may manage them. */
export async function guestInScope(access: GuestAccess, guestId: string) {
  const guest = await db.guest.findFirst({ where: { id: guestId, eventId: access.event.id, ...access.scope } });
  if (!guest) throw notFound("Guest");
  return guest;
}

/** The ids, of those given, that this user may manage. */
export async function idsInScope(access: GuestAccess, ids: string[]): Promise<string[]> {
  if (!access.coHost) return ids;
  const rows = await db.guest.findMany({ where: { id: { in: ids }, eventId: access.event.id, ...access.scope }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** A co-host's own cap on their list, on top of the plan's limit for the whole event. */
export async function assertListRoom(coHost: Pick<CoHost, "id" | "guestLimit"> | null, adding: number) {
  if (!coHost?.guestLimit) return;
  const count = await db.guest.count({ where: { coHostId: coHost.id, isTest: false } });
  if (count + adding > coHost.guestLimit) {
    throw badRequest("list_full", `Your list can have up to ${coHost.guestLimit} guests.`, { limit: String(coHost.guestLimit) });
  }
}

// ── Invitation links ────────────────────────────────────────────────────────

const signature = (c: Pick<CoHost, "id" | "inviteNonce">) => hmac(`cohost:${c.id}:${c.inviteNonce}`).slice(0, 32);
export const inviteToken = (c: Pick<CoHost, "id" | "inviteNonce">) => `${c.id}.${signature(c)}`;
export const inviteUrl = (c: Pick<CoHost, "id" | "inviteNonce">) => appUrl(`/cohost/${inviteToken(c)}`);

/** The co-host behind an invitation link, if the link is genuine and current. */
export async function findInvite(token: string) {
  const [id, sig] = token.split(".");
  if (!id || !sig || id.length > 40) return null;
  const coHost = await db.coHost.findUnique({
    where: { id },
    include: { event: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!coHost || coHost.event.deletedAt || !safeEqual(sig, signature(coHost))) return null;
  return coHost;
}

// ── The owner's side ────────────────────────────────────────────────────────

export type CoHostView = {
  id: string;
  label: string;
  email: string;
  guestLimit: number | null;
  /** Accepted and signed in with an account. */
  joined: boolean;
  joinedAs: string | null;
  invitedAt: string;
  guests: number;
  /** The invitation link, until they join (the owner can copy it or send it on WhatsApp). */
  inviteUrl: string | null;
};

export async function coHostViews(eventId: string): Promise<CoHostView[]> {
  const [rows, counts] = await Promise.all([
    db.coHost.findMany({ where: { eventId }, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, email: true } } } }),
    db.guest.groupBy({ by: ["coHostId"], where: { eventId, isTest: false, coHostId: { not: null } }, _count: { _all: true } }),
  ]);
  const count = new Map(counts.map((c) => [c.coHostId, c._count._all]));
  return rows.map((c) => ({
    id: c.id,
    label: c.label,
    email: c.email,
    guestLimit: c.guestLimit,
    joined: Boolean(c.userId),
    joinedAs: c.user ? c.user.name || c.user.email : null,
    invitedAt: c.invitedAt.toISOString(),
    guests: count.get(c.id) ?? 0,
    inviteUrl: c.userId ? null : inviteUrl(c),
  }));
}

type Owner = Pick<SessionUser, "id" | "name" | "email" | "locale">;

export async function inviteCoHost(owner: Owner, event: Event, input: z.infer<typeof coHostInputSchema>) {
  if (input.email === owner.email.toLowerCase()) throw badRequest("cohost_self", "That's your own email address.", { email: "own" });
  if ((await db.coHost.count({ where: { eventId: event.id } })) >= MAX_COHOSTS) {
    throw conflict("too_many_cohosts", `An event can have up to ${MAX_COHOSTS} co-hosts.`);
  }
  let coHost: CoHost;
  try {
    coHost = await db.coHost.create({
      data: { eventId: event.id, label: input.label, email: input.email, guestLimit: input.guestLimit ?? null, inviteNonce: generateSecretToken(9) },
    });
  } catch (e) {
    if (e instanceof P.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("cohost_exists", "This person is already invited.");
    throw e;
  }
  await audit(owner.id, "cohost.invited", "Event", event.id, { coHostId: coHost.id });
  await sendInvite(owner, event, coHost);
  return coHost;
}

/** Emails the invitation link (again). */
export async function sendInvite(owner: Owner, event: Event, coHost: CoHost) {
  const ar = owner.locale === "ar";
  const mail = coHostInviteEmail({
    locale: owner.locale,
    inviter: owner.name || owner.email,
    label: coHost.label,
    event: ar && event.titleAr ? event.titleAr : event.title,
    link: inviteUrl(coHost),
  });
  await sendEmail({ to: coHost.email, subject: mail.subject, text: renderEmailText(mail), html: renderEmail(mail) });
}

/** Emails the same invitation link again. Only before they've joined. */
export async function resendInvite(owner: Owner, event: Event, coHostId: string) {
  const coHost = await db.coHost.findFirst({ where: { id: coHostId, eventId: event.id } });
  if (!coHost) throw notFound("Co-host");
  if (coHost.userId) throw conflict("cohost_joined", "They've already joined.");
  await db.coHost.update({ where: { id: coHost.id }, data: { invitedAt: new Date() } });
  await sendInvite(owner, event, coHost);
}

export async function updateCoHost(event: Event, coHostId: string, input: z.infer<typeof coHostUpdateSchema>) {
  const r = await db.coHost.updateMany({
    where: { id: coHostId, eventId: event.id },
    data: { ...(input.label !== undefined ? { label: input.label } : {}), ...(input.guestLimit !== undefined ? { guestLimit: input.guestLimit } : {}) },
  });
  if (!r.count) throw notFound("Co-host");
}

/** Removes a co-host. Their guests stay invited and move to the owner's list. */
export async function removeCoHost(owner: Pick<SessionUser, "id">, event: Event, coHostId: string) {
  const coHost = await db.coHost.findFirst({ where: { id: coHostId, eventId: event.id } });
  if (!coHost) throw notFound("Co-host");
  const moved = await db.guest.count({ where: { coHostId: coHost.id } });
  await db.coHost.delete({ where: { id: coHost.id } });
  await audit(owner.id, "cohost.removed", "Event", event.id, { coHostId: coHost.id, moved });
  return { moved };
}

// ── The co-host's side ──────────────────────────────────────────────────────

/** Accepts an invitation for the signed-in user. Returns the event to open. */
export async function acceptInvite(user: Pick<SessionUser, "id">, token: string): Promise<{ eventId: string }> {
  const invite = await findInvite(token);
  if (!invite) throw notFound("Invitation");
  if (invite.event.userId === user.id) throw conflict("cohost_own_event", "This is your own event.");
  if (invite.userId === user.id) return { eventId: invite.eventId };
  if (invite.userId) throw conflict("cohost_taken", "This invitation has already been accepted by someone else.");
  if (await db.coHost.findFirst({ where: { eventId: invite.eventId, userId: user.id } })) return { eventId: invite.eventId };
  // Only if still unclaimed, so two people opening the same link can't both join.
  const r = await db.coHost.updateMany({ where: { id: invite.id, userId: null }, data: { userId: user.id, acceptedAt: new Date() } });
  if (!r.count) throw conflict("cohost_taken", "This invitation has already been accepted by someone else.");
  await recordActivity(db, invite.eventId, "cohost.joined", { label: invite.label });
  await audit(user.id, "cohost.joined", "Event", invite.eventId, { coHostId: invite.id });
  return { eventId: invite.eventId };
}

/** Events this user keeps a list for, newest first (for their dashboard). */
export async function coHostedEvents(userId: string) {
  return db.coHost.findMany({
    where: { userId, event: { deletedAt: null } },
    orderBy: { acceptedAt: "desc" },
    include: { event: { include: { user: { select: { name: true, email: true } } } }, _count: { select: { guests: true } } },
  });
}
