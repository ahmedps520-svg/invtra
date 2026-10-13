import type { NextRequest } from "next/server";
import { ok, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getEditableEvent } from "@/server/events/access";
import { requestStatusVideo, statusVideo } from "@/server/video/status";

type Ctx = { params: Promise<{ id: string }> };

/** The "video for your Status": where it stands for the current design (polled while it renders). */
export const GET = route<Ctx>("events.video", async (_req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const event = await getEditableEvent(user, (await ctx.params).id);
  return ok(await statusVideo(event));
});

/** Make the video for the current design. Rendering takes CPU, so new requests are rate limited. */
export const POST = route<Ctx>("events.video.create", async (_req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const event = await getEditableEvent(user, (await ctx.params).id);
  const current = await statusVideo(event);
  if (current.state === "ready" || current.state === "rendering") return ok(current);
  await enforceRateLimit(`video:${user.id}`, 12, 3600);
  return ok(await requestStatusVideo(event));
});
