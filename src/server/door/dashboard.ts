import type { DoorScanResult, Event } from "@prisma/client";
import Papa from "papaparse";
import { db } from "@/server/db";
import { formatNumericDateTime } from "@/lib/format";
import { SECTION_LABELS } from "@/lib/sections";
import { doorClosesAt, doorSummary, doorUrl, type DoorGuest } from "./service";

/**
 * The host's check-in dashboard (/dashboard/events/:id/checkin): arrivals against the guest
 * list, every scan at the door including the codes turned away, and the door link for staff.
 * The page polls with `since` so only guests changed since the last poll come back.
 */

export type CheckinGuest = DoorGuest & { phone: string; revoked: boolean };
export type CheckinScan = { id: string; result: DoorScanResult; guestId: string | null; name: string | null; at: string };

const SCAN_RESULTS = ["VALID", "ALREADY_IN", "NOT_ACCEPTED", "UNKNOWN", "OTHER_EVENT", "REVOKED"] as const satisfies readonly DoorScanResult[];

export async function checkinDashboard(event: Event, since?: Date) {
  const now = new Date();
  const [summary, guests, scans, totals] = await Promise.all([
    doorSummary(event),
    db.guest.findMany({
      where: { eventId: event.id, isTest: false, ...(since ? { updatedAt: { gte: since } } : {}) },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        groupName: true,
        phone: true,
        allowedCount: true,
        attendingCount: true,
        rsvpStatus: true,
        section: true,
        checkedInAt: true,
        checkedInCount: true,
        invitation: { select: { status: true } },
      },
    }),
    db.doorScan.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, result: true, guestId: true, createdAt: true, guest: { select: { name: true } } },
    }),
    db.doorScan.groupBy({ by: ["result"], where: { eventId: event.id }, _count: { _all: true } }),
  ]);
  return {
    now: now.toISOString(),
    full: !since,
    total: summary.total,
    sections: summary.sections,
    guests: guests.map(
      (g): CheckinGuest => ({
        id: g.id,
        name: g.name,
        groupName: g.groupName,
        phone: g.phone,
        phoneTail: g.phone.replace(/\D/g, "").slice(-4),
        allowedCount: g.allowedCount,
        attendingCount: g.attendingCount,
        rsvpStatus: g.rsvpStatus,
        section: event.sectionsEnabled ? g.section : null,
        checkedInAt: g.checkedInAt?.toISOString() ?? null,
        checkedInCount: g.checkedInCount,
        revoked: g.invitation?.status === "REVOKED",
      }),
    ),
    scans: scans.map((s): CheckinScan => ({ id: s.id, result: s.result, guestId: s.guestId, name: s.guest?.name ?? null, at: s.createdAt.toISOString() })),
    scanTotals: Object.fromEntries(SCAN_RESULTS.map((r) => [r, totals.find((t) => t.result === r)?._count._all ?? 0])) as Record<DoorScanResult, number>,
    door: { url: event.doorToken ? doorUrl(event.doorToken) : null, closesAt: doorClosesAt(event).toISOString() },
  };
}

export type CheckinData = Awaited<ReturnType<typeof checkinDashboard>>;

/** The arrivals list as a spreadsheet: who came, with how many people and when (event time). */
export async function exportCheckinCsv(event: Event): Promise<string> {
  const guests = await db.guest.findMany({
    where: { eventId: event.id, isTest: false },
    orderBy: [{ checkedInAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });
  return Papa.unparse({
    fields: [
      "Name",
      "Phone",
      "Group",
      ...(event.sectionsEnabled ? ["Section"] : []),
      "RSVP",
      "Invited for",
      "Confirmed",
      "Arrived",
      "People arrived",
      "Arrival time",
    ],
    data: guests.map((g) => [
      g.name,
      g.phone,
      g.groupName ?? "",
      ...(event.sectionsEnabled ? [g.section ? SECTION_LABELS[g.section].en : ""] : []),
      g.rsvpStatus,
      g.allowedCount,
      g.attendingCount ?? "",
      g.checkedInAt ? "Yes" : "No",
      g.checkedInCount ?? "",
      g.checkedInAt ? formatNumericDateTime(g.checkedInAt, event.timezone) : "",
    ]),
  });
}
