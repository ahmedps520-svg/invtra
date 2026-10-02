import type { NextRequest } from "next/server";
import { badRequest, ok, requireApiAdmin, route } from "@/server/http";
import { deleteTemplate, setTemplateActive, templateInputSchema, templateToggleSchema, updateTemplate } from "@/server/admin/templates";

type Ctx = { params: Promise<{ id: string }> };

/** `{ isActive }` toggles availability (any status); a full body edits a DRAFT / REJECTED template. */
export const PATCH = route<Ctx>("admin.templates.update", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("invalid_json", "Request body must be JSON.");
  }
  if (body && typeof body === "object" && Object.keys(body).length === 1 && "isActive" in body) {
    const { isActive } = templateToggleSchema.parse(body);
    const template = await setTemplateActive(admin.id, id, isActive);
    return ok({ template, message: isActive ? "Template enabled" : "Template disabled — it won't be used for new sends" });
  }
  const input = templateInputSchema.parse(body);
  const template = await updateTemplate(admin.id, id, input);
  return ok({ template, message: "Template updated — submit it to Meta for review" });
});

export const DELETE = route<Ctx>("admin.templates.delete", async (_req, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  await deleteTemplate(admin.id, id);
  return ok({ message: "Draft deleted" });
});
