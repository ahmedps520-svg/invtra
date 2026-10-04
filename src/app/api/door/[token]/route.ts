import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, ok, parseJson, parseQuery, route, tooManyRequests } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { doorCheckIn, doorGuest, doorScan, doorSearch, doorSummary, requireDoorEvent } from "@/server/door/service";

type Ctx = { params: Promise<{ token: string }> };

/** Staff with the door link: no sign-in, so every call is rate limited per device. */
async function load(req: NextRequest, ctx: Ctx) {
  // Several staff phones at a venue often share one IP (venue Wi-Fi), so the limit is generous.
  if (!(await rateLimit(`door:${clientIp(req)}`, 3000, 600)).ok) throw tooManyRequests();
  const { token } = await ctx.params;
  return requireDoorEvent(token);
}

/** Arrivals so far, or a name search (?q=), or one guest (?guest=). */
export const GET = route<Ctx>("door.get", async (req: NextRequest, ctx) => {
  const event = await load(req, ctx);
  const q = parseQuery(req, z.object({ q: z.string().max(80).optional(), guest: z.string().max(40).optional() }));
  if (q.guest) return ok({ guest: await doorGuest(event, q.guest) });
  if (q.q !== undefined) return ok({ results: await doorSearch(event, q.q) });
  return ok(await doorSummary(event));
});

const body = z.union([
  z.object({ scan: z.string().min(1).max(500) }),
  z.object({ guestId: z.string().min(1).max(40), count: z.number().int().min(1).max(50).optional(), undo: z.boolean().optional() }),
]);

/** A scanned QR code ({ scan }), or check a guest in / undo ({ guestId, count?, undo? }). */
export const POST = route<Ctx>("door.post", async (req: NextRequest, ctx) => {
  const event = await load(req, ctx);
  const input = await parseJson(req, body);
  if ("scan" in input) return ok(await doorScan(event, input.scan));
  return ok({ guest: await doorCheckIn(event, input.guestId, { count: input.count, undo: input.undo }) });
});
