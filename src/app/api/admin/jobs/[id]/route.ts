import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { dismissFailedJob, retryFailedJob } from "@/server/admin/jobs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ action: z.enum(["retry", "dismiss"]) });

export const POST = route<Ctx>("admin.jobs.action", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  const { action } = await parseJson(req, schema);
  if (action === "retry") {
    await retryFailedJob(admin.id, id);
    return ok({ message: "Job queued to run again" });
  }
  await dismissFailedJob(admin.id, id);
  return ok({ message: "Job dismissed" });
});
