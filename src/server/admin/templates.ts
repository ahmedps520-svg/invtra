import { Prisma, type MessageTemplate } from "@prisma/client";

/** What a template is for (see TemplatePurpose in prisma/schema.prisma). */
export const TEMPLATE_PURPOSES = ["INVITATION", "UPDATE", "PAYMENT_REQUEST", "PAYMENT_RECEIPT"] as const;
export type TemplatePurposeName = (typeof TEMPLATE_PURPOSES)[number];
import { z } from "zod";
import { db } from "@/server/db";
import { badRequest, conflict, notFound } from "@/server/http";
import { audit } from "@/server/log";
import { TEMPLATE_VARIABLES } from "@/lib/whatsapp/templates";

/**
 * Admin management of WhatsApp message templates. Content can only change while a
 * template is DRAFT or REJECTED (Meta reviews every change); availability (isActive)
 * can be toggled at any time.
 */

import { EVENT_TYPES } from "@/lib/events/types";
export { EVENT_TYPES };
export const TEMPLATE_LANGUAGES = ["en", "en_US", "en_GB", "ar"] as const;
export const EDITABLE_STATUSES = ["DRAFT", "REJECTED"] as const;

const buttonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_REPLY"), text: z.string().trim().min(1, "Button text is required").max(25, "Max 25 characters"), action: z.enum(["ACCEPT", "DECLINE"]) }),
  z.object({ type: z.literal("URL"), text: z.string().trim().min(1, "Button text is required").max(25, "Max 25 characters"), url: z.string().trim().max(2000) }),
]);

const PLACEHOLDER = /\{\{(\d+)\}\}/g;

/**
 * Meta's structural rules for a template body, plus INVTRA's button conventions.
 * Returns field → message (empty when valid).
 */
export function templateShapeErrors(t: {
  purpose: TemplatePurposeName;
  body: string;
  variables: string[];
  footer?: string | null;
  buttons: z.infer<typeof buttonSchema>[];
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const body = t.body;
  const stray = body.replace(PLACEHOLDER, "").match(/\{\{|\}\}/);
  const nums = [...body.matchAll(PLACEHOLDER)].map((m) => Number(m[1]));
  const distinct = [...new Set(nums)].sort((a, b) => a - b);
  if (stray) errors.body = "Variables must look like {{1}}, {{2}} … (numbers only).";
  else if (distinct.some((n, i) => n !== i + 1)) errors.body = "Number variables in order, starting at {{1}} with no gaps.";
  else if (/^\s*\{\{\d+\}\}/.test(body)) errors.body = "The body can't start with a variable.";
  else if (/\{\{\d+\}\}\s*$/.test(body)) errors.body = "The body can't end with a variable — add text or punctuation after it.";
  else if (/\}\}\s*\{\{/.test(body)) errors.body = "Two variables can't be next to each other — put words between them.";
  else if (distinct.length && body.replace(PLACEHOLDER, "").trim().split(/\s+/).length < distinct.length * 2 + 1) {
    errors.body = "Too many variables for the length of the message — Meta rejects this. Add more text.";
  }
  if (!errors.body && distinct.length !== t.variables.length) {
    errors.variables = `The body uses ${distinct.length} variable${distinct.length === 1 ? "" : "s"} but ${t.variables.length} ${t.variables.length === 1 ? "is" : "are"} mapped.`;
  }
  if (t.footer && /\{\{/.test(t.footer)) errors.footer = "The footer can't contain variables.";

  const qr = t.buttons.filter((b) => b.type === "QUICK_REPLY");
  const url = t.buttons.filter((b) => b.type === "URL");
  if (t.purpose === "INVITATION") {
    const actions = qr.map((b) => (b.type === "QUICK_REPLY" ? b.action : null)).sort();
    if (url.length || qr.length !== 2 || actions[0] !== "ACCEPT" || actions[1] !== "DECLINE") {
      errors.buttons = "Invitation templates need exactly two quick-reply buttons: one Accept and one Decline.";
    }
  } else {
    const b = url[0];
    if (qr.length || url.length !== 1 || !b || b.type !== "URL") errors.buttons = "This kind of template needs exactly one URL button.";
    else if (!/^https?:\/\/[^\s{}]+\{\{1\}\}$/.test(b.url)) {
      errors["buttons.0.url"] =
        t.purpose === "UPDATE" ? "The URL must be https://… and end with {{1}} (the invitation code)." : "The URL must be https://… and end with {{1}} (the payment-link code).";
    }
  }
  return errors;
}

const contentFields = {
  name: z.string().trim().min(2, "Give the template a name").max(80),
  nameAr: z.string().trim().max(80).optional().nullable().transform((v) => v || null),
  description: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  metaName: z
    .string()
    .trim()
    .min(1, "Required")
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  language: z.enum(TEMPLATE_LANGUAGES),
  locale: z.enum(["en", "ar", "bilingual"]),
  purpose: z.enum(TEMPLATE_PURPOSES),
  category: z.enum(["UTILITY", "MARKETING"]),
  headerType: z.enum(["NONE", "IMAGE"]),
  body: z.string().trim().min(10, "Write the message").max(1024, "Max 1,024 characters"),
  variables: z.array(z.enum(TEMPLATE_VARIABLES)).max(10, "At most 10 variables"),
  footer: z.string().trim().max(60, "Max 60 characters").optional().nullable().transform((v) => v || null),
  buttons: z.array(buttonSchema).max(3),
  eventTypes: z.array(z.enum(EVENT_TYPES)).min(1, "Choose at least one event type"),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
};

export const templateInputSchema = z.object(contentFields).superRefine((t, ctx) => {
  for (const [path, message] of Object.entries(templateShapeErrors(t))) {
    ctx.addIssue({ code: "custom", path: path.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p)), message });
  }
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

export const templateToggleSchema = z.object({ isActive: z.boolean() }).strict();

function toData(input: TemplateInput) {
  return {
    name: input.name,
    nameAr: input.nameAr,
    description: input.description,
    metaName: input.metaName,
    language: input.language,
    locale: input.locale,
    purpose: input.purpose,
    category: input.category,
    headerType: input.headerType,
    headerText: null,
    body: input.body,
    variables: input.variables as unknown as Prisma.InputJsonValue,
    footer: input.footer,
    buttons: input.buttons as unknown as Prisma.InputJsonValue,
    eventTypes: [...input.eventTypes],
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };
}

async function uniqueKey(base: string) {
  const root = base.slice(0, 60) || "template";
  for (let i = 0; i < 50; i++) {
    const key = i ? `${root}_${i + 1}` : root;
    if (!(await db.messageTemplate.findUnique({ where: { key }, select: { id: true } }))) return key;
  }
  return `${root}_${Date.now()}`;
}

function duplicate(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw conflict("duplicate_template", "A template with this Meta name and language already exists.");
  }
  throw e;
}

export async function listTemplates() {
  const [templates, usage] = await Promise.all([
    db.messageTemplate.findMany({ orderBy: [{ purpose: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.event.groupBy({ by: ["messageTemplateId"], where: { deletedAt: null, messageTemplateId: { not: null } }, _count: { _all: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.messageTemplateId, u._count._all]));
  return templates.map((t) => ({ ...t, events: used.get(t.id) ?? 0 }));
}

export async function createTemplate(actorId: string, input: TemplateInput) {
  const last = await db.messageTemplate.aggregate({ _max: { sortOrder: true } });
  const t = await db.messageTemplate
    .create({
      data: {
        key: await uniqueKey(`${input.metaName}_${input.language.toLowerCase()}`),
        ...toData(input),
        sortOrder: input.sortOrder ?? (last._max.sortOrder ?? 0) + 1,
        status: "DRAFT",
        isActive: true,
      },
    })
    .catch(duplicate);
  await audit(actorId, "admin.template.create", "template", t.id, { metaName: t.metaName, language: t.language, purpose: t.purpose });
  return t;
}

export async function updateTemplate(actorId: string, id: string, input: TemplateInput) {
  const t = await db.messageTemplate.findUnique({ where: { id } });
  if (!t) throw notFound("Template");
  if (!(EDITABLE_STATUSES as readonly string[]).includes(t.status)) {
    throw conflict("template_locked", `${t.status.charAt(0)}${t.status.slice(1).toLowerCase()} templates can't be edited — Meta reviews every change. Create a new template instead.`);
  }
  const submitted = Boolean(t.metaTemplateId && !t.metaTemplateId.startsWith("mock_"));
  if (submitted && (input.metaName !== t.metaName || input.language !== t.language)) {
    throw badRequest("meta_identity_locked", "Meta doesn't allow renaming a submitted template or changing its language.", {
      metaName: "Can't change after submission",
    });
  }
  const updated = await db.messageTemplate
    .update({ where: { id }, data: { ...toData(input), status: "DRAFT", rejectedReason: t.status === "REJECTED" ? t.rejectedReason : null } })
    .catch(duplicate);
  await audit(actorId, "admin.template.update", "template", id, { metaName: updated.metaName, previousStatus: t.status });
  return updated;
}

export async function setTemplateActive(actorId: string, id: string, isActive: boolean) {
  const t = await db.messageTemplate.update({ where: { id }, data: { isActive } });
  await audit(actorId, isActive ? "admin.template.enable" : "admin.template.disable", "template", id, { metaName: t.metaName, language: t.language });
  return t;
}

export async function deleteTemplate(actorId: string, id: string) {
  const t = await db.messageTemplate.findUnique({ where: { id } });
  if (!t) throw notFound("Template");
  if (t.status !== "DRAFT" || (t.metaTemplateId && !t.metaTemplateId.startsWith("mock_"))) {
    throw conflict("template_in_use", "Only drafts that were never submitted to Meta can be deleted. Disable it instead.");
  }
  await db.messageTemplate.delete({ where: { id } });
  await audit(actorId, "admin.template.delete", "template", id, { metaName: t.metaName, language: t.language });
}

export type AdminTemplate = MessageTemplate & { events: number };
