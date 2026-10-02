import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiUser, route } from "@/server/http";
import { assertSimulatorEnabled, simulateReply } from "@/server/dev/simulator";

export const POST = route("dev.whatsapp.reply", async (req: NextRequest) => {
  assertSimulatorEnabled();
  const user = await requireApiUser();
  const body = await parseJson(req, z.object({ messageId: z.string(), buttonIndex: z.number().int().min(0).max(2).optional(), text: z.string().max(1000).optional() }));
  const r = await simulateReply(user, body);
  return ok({ status: r.status });
});
