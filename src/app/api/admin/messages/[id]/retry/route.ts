import { ok, requireApiAdmin, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { retryInvitationRequest } from "@/server/admin/messages";

type Ctx = { params: Promise<{ id: string }> };

/** Retry a failed Accept/Decline invitation request. */
export const POST = route<Ctx>("admin.messages.retry", async (_req, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  await enforceRateLimit(`admin.retry:${admin.id}`, 120, 60);
  await retryInvitationRequest(admin.id, id);
  return ok({ message: "Invitation request queued again" });
});
