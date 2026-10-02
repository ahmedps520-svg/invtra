import type { Event, Guest } from "@prisma/client";
import { db } from "@/server/db";
import { isTemplateButtons, renderTemplateBody, type TemplateVariable } from "@/lib/whatsapp/templates";
import { pickTemplate, templateValues, deliveryCopy, eventLocale } from "@/server/whatsapp/compose";

/**
 * What a guest will see in WhatsApp: the Accept/Decline message (and, after accepting,
 * the invitation delivery message). Uses the first guest on the list, or a sample name.
 */
export async function messagePreview(event: Event, guest?: Pick<Guest, "name" | "locale"> | null) {
  const sample = guest ?? (await db.guest.findFirst({ where: { eventId: event.id, isTest: false }, orderBy: { createdAt: "asc" }, select: { name: true, locale: true } }));
  const g = sample ?? { name: event.language === "AR" ? "خالد" : "Khalid", locale: null };
  const template = await pickTemplate(event, g, "INVITATION");
  const values = templateValues(event, g, "SAMPLE0000");
  const delivery = deliveryCopy(eventLocale(event), event);
  return {
    guestName: g.name,
    template: template
      ? {
          id: template.id,
          name: template.name,
          headerType: template.headerType,
          body: renderTemplateBody({ body: template.body, variables: template.variables as TemplateVariable[] }, values),
          footer: template.footer,
          buttons: isTemplateButtons(template.buttons) ? template.buttons.map((b) => b.text) : [],
        }
      : null,
    delivery: { body: delivery.body, footer: delivery.footer, button: delivery.button },
  };
}

export type MessagePreview = Awaited<ReturnType<typeof messagePreview>>;
