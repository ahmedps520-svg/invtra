import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiSession, route } from "@/server/http";
import { markNotificationsRead } from "@/server/notifications";

const schema = z.object({ ids: z.array(z.string().max(40)).max(100).optional() });

export const POST = route("notifications.read", async (req: NextRequest) => {
  const user = await requireApiSession();
  const { ids } = await parseJson(req, schema);
  await markNotificationsRead(user.id, ids);
  return ok();
});
