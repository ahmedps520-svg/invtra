import type { NextRequest } from "next/server";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { createTemplate, listTemplates, templateInputSchema } from "@/server/admin/templates";

export const GET = route("admin.templates.list", async () => {
  await requireApiAdmin();
  return ok({ templates: await listTemplates() });
});

/** Create a DRAFT template (submit it to Meta separately). */
export const POST = route("admin.templates.create", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const input = await parseJson(req, templateInputSchema);
  const template = await createTemplate(admin.id, input);
  return ok({ template, message: "Template saved as a draft" }, { status: 201 });
});
