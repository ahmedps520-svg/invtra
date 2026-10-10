import { Prisma, type Event, type Guest, type Invitation } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl, env } from "@/server/env";
import { generateInvitationToken, sha256 } from "@/server/security/tokens";
import { qrTargetUrl } from "@/lib/qr";
import { cardQrText } from "@/lib/design/schema";
import { eventDesign } from "@/server/events/design";

/** Public invitation page for a guest. */
export function invitationUrl(token: string) {
  return appUrl(`/i/${token}`);
}

/** What the guest's QR encodes (scan-tracking redirect to the invitation page). */
export function invitationQrText(token: string) {
  return qrTargetUrl(env().APP_URL, token);
}

/**
 * The QR a guest is given for this event (card, guest page, Apple Wallet): null when the
 * design turns the QR off, the design's own link when one is set, else their personal link.
 */
export function eventQrText(event: Pick<Event, "themeKey" | "design">, token: string): string | null {
  return cardQrText(eventDesign(event), invitationQrText(token));
}

/** Create the guest's invitation (unique random token) if it doesn't exist yet. */
export async function ensureInvitation(guest: Pick<Guest, "id" | "eventId">): Promise<Invitation> {
  const existing = await db.invitation.findUnique({ where: { guestId: guest.id } });
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.invitation.create({
        data: { guestId: guest.id, eventId: guest.eventId, token: generateInvitationToken() },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const raced = await db.invitation.findUnique({ where: { guestId: guest.id } });
        if (raced) return raced;
        continue; // token collision — astronomically rare, retry with a new token
      }
      throw e;
    }
  }
  throw new Error("Could not allocate an invitation token");
}

/** Bulk variant used before sending a batch. */
export async function ensureInvitations(guests: Pick<Guest, "id" | "eventId">[]) {
  const have = new Set(
    (await db.invitation.findMany({ where: { guestId: { in: guests.map((g) => g.id) } }, select: { guestId: true } })).map(
      (i) => i.guestId,
    ),
  );
  for (const g of guests) if (!have.has(g.id)) await ensureInvitation(g);
}

/** Hash of everything that changes a guest's personalised image. */
export function personalImageVersion(
  event: Pick<Event, "id" | "contentVersion" | "design" | "themeKey" | "imageMode" | "customImageKey" | "language" | "updatedAt">,
  guest: Pick<Guest, "name" | "allowedCount"> & Partial<Pick<Guest, "section">>,
  token: string,
  /** The guest's section when it changes the card's time or place. */
  variant: string | null = null,
) {
  return sha256(
    JSON.stringify([
      ...(variant ? [variant] : []),
      event.id,
      event.contentVersion,
      event.design,
      event.themeKey,
      event.imageMode,
      event.customImageKey,
      event.language,
      guest.name,
      guest.allowedCount,
      token,
      env().APP_URL,
    ]),
  ).slice(0, 16);
}

export function teaserImageVersion(
  event: Pick<Event, "id" | "contentVersion" | "design" | "themeKey" | "imageMode" | "customImageKey" | "language">,
  variant: string | null = null,
) {
  return sha256(
    JSON.stringify(["teaser", ...(variant ? [variant] : []), event.id, event.contentVersion, event.design, event.themeKey, event.imageMode, event.customImageKey, event.language]),
  ).slice(0, 16);
}
