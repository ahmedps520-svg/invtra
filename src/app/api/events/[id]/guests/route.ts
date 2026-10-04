import type { NextRequest } from "next/server";
import { z } from "zod";
import type { GuestStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { ok, parseJson, parseQuery, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { addGuest, defaultCountryFor } from "@/server/guests/service";
import { invitationUrl } from "@/server/invitations";
import { guestInputSchema } from "@/lib/validation/guest";
import { sectionCounts } from "@/server/guests/sections";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES = ["PENDING", "MESSAGE_SENT", "ACCEPTED", "DECLINED", "INVITATION_SENT", "VIEWED", "QR_SCANNED", "FAILED"] as const;

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  rsvp: z.enum(["PENDING", "ACCEPTED", "DECLINED"]).optional(),
  section: z.enum(["MEN", "WOMEN", "NONE"]).optional(),
  sort: z.enum(["name", "status", "activity", "created"]).default("created"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});

export const GET = route<Ctx>("guests.list", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const q = parseQuery(req, querySchema);
  const where: Prisma.GuestWhereInput = {
    eventId: event.id,
    isTest: false,
    ...(q.status ? { status: q.status as GuestStatus } : {}),
    ...(q.rsvp ? { rsvpStatus: q.rsvp } : {}),
    ...(q.section ? { section: q.section === "NONE" ? null : q.section } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { groupName: { contains: q.q, mode: "insensitive" } },
            { phone: { contains: q.q.replace(/[^\d+]/g, "") || q.q } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.GuestOrderByWithRelationInput =
    q.sort === "name" ? { name: "asc" } : q.sort === "status" ? { status: "asc" } : q.sort === "activity" ? { lastActivityAt: "desc" } : { createdAt: "asc" };
  const [total, guests, counts, bySection] = await Promise.all([
    db.guest.count({ where }),
    db.guest.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { invitation: { select: { token: true } } },
    }),
    db.guest.groupBy({ by: ["status"], where: { eventId: event.id, isTest: false }, _count: true }),
    db.guest.groupBy({ by: ["section"], where: { eventId: event.id, isTest: false }, _count: true }),
  ]);
  return ok({
    sectionCounts: sectionCounts(bySection),
    total,
    page: q.page,
    pageSize: q.pageSize,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    guests: guests.map(({ invitation, ...g }) => ({ ...g, invitationUrl: invitation ? invitationUrl(invitation.token) : null })),
  });
});

export const POST = route<Ctx>("guests.add", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const input = await parseJson(req, guestInputSchema);
  const guest = await addGuest(event.id, input, defaultCountryFor(event.timezone));
  return ok({ guest }, { status: 201 });
});
