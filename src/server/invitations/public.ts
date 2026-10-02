import type { ViewSource } from "@prisma/client";
import { db } from "@/server/db";
import { recordActivity } from "@/server/activity";
import { updateGuest } from "@/server/guests/status";
import { isWellFormedInvitationToken } from "@/server/security/tokens";

export const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|skype|curl|wget|python|httpclient|headless|lighthouse/i;

/**
 * Resolve a public invitation token. Returns null for unknown tokens (and malformed
 * ones, without touching the database).
 */
export async function loadPublicInvitation(token: string) {
  if (!isWellFormedInvitationToken(token)) return null;
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      guest: true,
      event: { include: { scheduleItems: { orderBy: { sortOrder: "asc" } }, galleryImages: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!invitation) return null;
  const e = invitation.event;
  const state: "active" | "deleted" | "deactivated" | "revoked" = e.deletedAt
    ? "deleted"
    : e.deactivatedAt
      ? "deactivated"
      : invitation.status === "REVOKED"
        ? "revoked"
        : "active";
  return { invitation, guest: invitation.guest, event: e, state };
}

export type PublicInvitation = NonNullable<Awaited<ReturnType<typeof loadPublicInvitation>>>;

/** Count a page view (link or QR). Repeat views within a minute aren't double counted. */
export async function recordView(token: string, source: ViewSource, userAgent: string | null) {
  if (userAgent && BOT_UA.test(userAgent)) return;
  const inv = await db.invitation.findUnique({ where: { token }, include: { guest: true, event: { select: { deletedAt: true, deactivatedAt: true } } } });
  if (!inv || inv.event.deletedAt || inv.event.deactivatedAt) return;
  const g = inv.guest;
  if (g.lastViewedAt && Date.now() - g.lastViewedAt.getTime() < 60_000) return;
  const now = new Date();
  const device = userAgent && /mobile|iphone|android/i.test(userAgent) ? "mobile" : "desktop";
  await db.invitationView.create({ data: { invitationId: inv.id, eventId: inv.eventId, guestId: g.id, source, device } });
  await updateGuest(db, g.id, {
    viewCount: { increment: 1 },
    firstViewedAt: g.firstViewedAt ?? now,
    lastViewedAt: now,
    lastActivityAt: now,
  });
  if (!g.firstViewedAt && !g.isTest) await recordActivity(db, inv.eventId, "guest.viewed", { name: g.name }, g.id);
}

/** Record a QR scan. Camera apps sometimes open a URL twice — ignore repeats within 10s. */
export async function recordScan(token: string, byHost: boolean) {
  if (!isWellFormedInvitationToken(token)) return null;
  const inv = await db.invitation.findUnique({ where: { token }, include: { guest: true } });
  if (!inv) return null;
  const g = inv.guest;
  if (g.lastScannedAt && Date.now() - g.lastScannedAt.getTime() < 10_000) return inv;
  const now = new Date();
  await db.qRScan.create({ data: { invitationId: inv.id, eventId: inv.eventId, guestId: g.id, byHost } });
  await updateGuest(db, g.id, {
    scanCount: { increment: 1 },
    firstScannedAt: g.firstScannedAt ?? now,
    lastScannedAt: now,
    lastActivityAt: now,
  });
  if (!g.firstScannedAt && !g.isTest) await recordActivity(db, inv.eventId, "guest.scanned", { name: g.name, byHost }, g.id);
  return inv;
}
