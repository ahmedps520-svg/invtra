import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { resolveErrors } from "@/server/admin/errors";

const schema = z.union([
  z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(500), resolved: z.boolean().default(true) }),
  z.object({
    match: z.object({ source: z.string().max(120).optional(), level: z.enum(["error", "warn"]).optional(), q: z.string().max(200).optional() }),
    resolved: z.boolean().default(true),
  }),
]);

/** Resolve / reopen error log entries — by id (single or selection) or everything matching a filter. */
export const POST = route("admin.errors.resolve", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const input = await parseJson(req, schema);
  const count = await resolveErrors(admin.id, input);
  return ok({ count, message: `${count} error${count === 1 ? "" : "s"} ${input.resolved ? "marked resolved" : "reopened"}` });
});
