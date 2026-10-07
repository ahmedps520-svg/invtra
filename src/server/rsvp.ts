import type { Event, Guest, RsvpSource } from "@prisma/client";
import { db } from "@/server/db";
import { recordActivity } from "@/server/activity";
import { updateGuest } from "@/server/guests/status";
import { zonedToUtc, utcToZoned } from "@/lib/time";
import { walletChanged } from "@/server/apple/push";

export type RsvpResponse = "ACCEPTED" | "DECLINED";

export type RsvpOutcome =
  | { kind: "closed"; guest: Guest; event: Event } // event deleted / deactivated / guest revoked
  | { kind: "deadline"; guest: Guest; event: Event } // RSVP deadline passed
  | { kind: "unchanged"; guest: Guest; event: Event } // same answer again (e.g. Accept pressed twice)
  | { kind: "changed"; previous: Guest["rsvpStatus"]; guest: Guest; event: Event };

/** End of the deadline day in the event's own timezone. */
export function rsvpDeadlinePassed(event: Pick<Event, "rsvpDeadline" | "timezone">, now = new Date()) {
  if (!event.rsvpDeadline) return false;
  const day = utcToZoned(event.rsvpDeadline, event.timezone).date;
  return now > zonedToUtc(day, "23:59", event.timezone);
}

export function eventIsActive(event: Pick<Event, "deletedAt" | "deactivatedAt">) {
  return !event.deletedAt && !event.deactivatedAt;
}

/**
 * Record a guest's answer. Rules:
 *  - Answers are accepted until the RSVP deadline (or the event start if none).
 *  - Pressing the same answer twice is idempotent ("unchanged").
 *  - A guest may change their mind: Accepted → Declined revokes access to the entry
 *    QR (the page shows the declined state); Declined → Accepted issues the invitation.
 *  - Every answer is kept in the Rsvp history table.
 *
 * Runs in a transaction holding a row lock on the guest so concurrent button presses
 * (WhatsApp retries, double taps) are serialised.
 */
export async function respond(input: {
  guestId: string;
  response: RsvpResponse;
  source: RsvpSource;
  attendingCount?: number | null;
}): Promise<RsvpOutcome> {
  const outcome = await respondTx(input);
  // A saved Apple Wallet pass becomes void when the guest declines (and valid again on accepting).
  if (outcome.kind === "changed") await walletChanged({ guestIds: [input.guestId] });
  return outcome;
}

function respondTx(input: { guestId: string; response: RsvpResponse; source: RsvpSource; attendingCount?: number | null }): Promise<RsvpOutcome> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Guest" WHERE "id" = ${input.guestId} FOR UPDATE`;
    const guest = await tx.guest.findUniqueOrThrow({ where: { id: input.guestId }, include: { invitation: true } });
    const event = await tx.event.findUniqueOrThrow({ where: { id: guest.eventId } });

    if (!eventIsActive(event) || guest.invitation?.status === "REVOKED") return { kind: "closed", guest, event };
    const now = new Date();
    if (rsvpDeadlinePassed(event, now) || (event.endsAt ?? event.startsAt) < now) return { kind: "deadline", guest, event };

    const attending =
      input.response === "ACCEPTED"
        ? Math.min(Math.max(1, input.attendingCount ?? guest.attendingCount ?? guest.allowedCount), guest.allowedCount)
        : 0;

    if (guest.rsvpStatus === input.response && (input.response === "DECLINED" || attending === guest.attendingCount)) {
      return { kind: "unchanged", guest, event };
    }

    const previous = guest.rsvpStatus;
    await updateGuest(tx, guest.id, {
      rsvpStatus: input.response,
      rsvpAt: now,
      rsvpSource: input.source,
      attendingCount: attending,
      lastActivityAt: now,
      // A fresh acceptance means the invitation image must be (re)sent.
      ...(input.response === "ACCEPTED" && previous !== "ACCEPTED" ? { invitationSentAt: null } : {}),
    });
    await tx.rsvp.create({
      data: { eventId: event.id, guestId: guest.id, response: input.response, source: input.source, attendingCount: attending },
    });
    const kind =
      previous === "PENDING"
        ? input.response === "ACCEPTED"
          ? "guest.accepted"
          : "guest.declined"
        : input.response === "ACCEPTED"
          ? "guest.changed_to_accepted"
          : "guest.changed_to_declined";
    if (previous !== input.response) {
      await recordActivity(tx, event.id, kind, { name: guest.name, source: input.source, attending }, guest.id);
    }
    const fresh = await tx.guest.findUniqueOrThrow({ where: { id: guest.id } });
    return { kind: "changed", previous, guest: fresh, event };
  });
}
