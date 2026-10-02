import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { CUSTOMIZABLE_VARIABLES } from "@/lib/whatsapp/templates";

type Ctx = { params: Promise<{ id: string }> };

const varsSchema = z.record(z.string(), z.string().trim().max(120)).refine(
  (o) => Object.keys(o).every((k) => (CUSTOMIZABLE_VARIABLES as string[]).includes(k)),
  "Only event-level variables can be customised",
);

/** Choose the approved template and per-event variable wording. */
export const PATCH = route<Ctx>("events.messaging", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const body = await parseJson(req, z.object({ messageTemplateId: z.string().nullable().optional(), templateVariables: varsSchema.optional() }));
  if (body.messageTemplateId) {
    const t = await db.messageTemplate.findFirst({ where: { id: body.messageTemplateId, purpose: "INVITATION", status: "APPROVED", isActive: true } });
    if (!t) throw badRequest("invalid_template", "That message template isn't available.");
  }
  const vars = body.templateVariables
    ? Object.fromEntries(Object.entries(body.templateVariables).filter(([, v]) => v.trim()))
    : undefined;
  await db.event.update({
    where: { id: event.id },
    data: {
      ...(body.messageTemplateId !== undefined ? { messageTemplateId: body.messageTemplateId } : {}),
      ...(vars !== undefined ? { templateVariables: vars as Prisma.InputJsonValue } : {}),
    },
  });
  return ok();
});
