import { conflict, HttpError, notFound, ok, requireApiAdmin, route } from "@/server/http";
import { db } from "@/server/db";
import { audit, logError } from "@/server/log";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { EDITABLE_STATUSES, templateInputSchema } from "@/server/admin/templates";
import { MetaGraphError, submitTemplateToMeta } from "@/server/whatsapp/meta-templates";

type Ctx = { params: Promise<{ id: string }> };

/** Submit a DRAFT / REJECTED template to Meta for review. */
export const POST = route<Ctx>("admin.templates.submit", async (_req, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  await enforceRateLimit(`admin.meta:${admin.id}`, 30, 600);
  const template = await db.messageTemplate.findUnique({ where: { id } });
  if (!template) throw notFound("Template");
  if (!(EDITABLE_STATUSES as readonly string[]).includes(template.status)) {
    throw conflict("not_submittable", `This template is ${template.status.toLowerCase()} — only drafts and rejected templates can be submitted.`);
  }
  // Re-validate the stored content (seeded / older rows) before Meta sees it.
  const check = templateInputSchema.safeParse({ ...template, nameAr: template.nameAr, eventTypes: template.eventTypes });
  if (!check.success) {
    const first = check.error.issues[0];
    throw new HttpError(422, "invalid_template", `Fix the template before submitting: ${first.path.join(".")} — ${first.message}`);
  }
  try {
    const r = await submitTemplateToMeta(template);
    await audit(admin.id, "admin.template.submit", "template", id, {
      metaName: template.metaName,
      language: template.language,
      simulated: r.simulated,
      edited: r.edited,
      status: r.template.status,
      metaTemplateId: r.template.metaTemplateId,
    });
    return ok({
      template: r.template,
      ...(r.simulated
        ? { notice: "Simulated approval — WhatsApp is in mock mode, so nothing was sent to Meta." }
        : { message: r.template.status === "APPROVED" ? "Approved by Meta" : `Submitted to Meta — status ${r.template.status.toLowerCase()}` }),
    });
  } catch (e) {
    if (e instanceof MetaGraphError) {
      await logError("admin:templates.submit", e, { templateId: id, code: e.code, subcode: e.subcode, fbtraceId: e.fbtraceId }, "warn");
      throw new HttpError(502, "meta_error", `Meta: ${e.message}${e.code ? ` (code ${e.code}${e.subcode ? `/${e.subcode}` : ""})` : ""}`);
    }
    throw e;
  }
});
