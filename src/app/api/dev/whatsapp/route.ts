import type { NextRequest } from "next/server";
import { ok, requireApiUser, route } from "@/server/http";
import { assertSimulatorEnabled, conversation, listConversations } from "@/server/dev/simulator";

export const GET = route("dev.whatsapp", async (req: NextRequest) => {
  assertSimulatorEnabled();
  const user = await requireApiUser();
  const phone = req.nextUrl.searchParams.get("phone");
  if (phone) return ok({ messages: await conversation(user, phone) });
  return ok({ conversations: await listConversations(user) });
});
