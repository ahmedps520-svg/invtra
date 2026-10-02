import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, ok, parseJson, route } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { recordView } from "@/server/invitations/public";

type Ctx = { params: Promise<{ token: string }> };

/** Beacon sent by the invitation page after it renders in a real browser (bots don't run JS). */
export const POST = route<Ctx>("invitation.view", async (req: NextRequest, ctx) => {
  const { token } = await ctx.params;
  if (!(await rateLimit(`view:${clientIp(req)}`, 60, 60)).ok) return ok();
  const { source } = await parseJson(req, z.object({ source: z.enum(["LINK", "QR"]).default("LINK") }));
  await recordView(token, source, req.headers.get("user-agent"));
  return ok();
});
