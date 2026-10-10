import type { NextRequest } from "next/server";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { createCustomDraft } from "@/server/custom/service";
import { customEventInputSchema } from "@/lib/validation/event";

/** Admin: start a custom event (a draft, designed before the host and price are added). */
export const POST = route("admin.custom.draft", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const input = await parseJson(req, customEventInputSchema);
  const event = await createCustomDraft(admin.id, input);
  return ok({ event: { id: event.id } }, { status: 201 });
});
