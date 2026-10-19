import type { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, conflict, ok, parseJson, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { eventDesign } from "@/server/events/design";
import { orderInReview } from "@/server/orders/service";
import { isUnlocked } from "@/server/render/preview";
import { normalizePhone } from "@/lib/phone";
import { DESIGN_SOURCES, PRODUCTS, designSourceFor, designSourcesFor, readFeatures } from "@/lib/products";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  product: z.enum(PRODUCTS).optional(),
  designSource: z.enum(DESIGN_SOURCES).optional(),
  designBrief: z.string().trim().max(3000).nullable().optional(),
  features: z
    .object({ qr: z.enum(["add", "skip", "later"]).optional(), whatsapp: z.boolean().optional(), tier: z.enum(["BASIC", "PREMIUM"]).optional() })
    .optional(),
  /** Order updates on WhatsApp: an explicit opt-in, with the number to use. */
  whatsappUpdates: z.object({ enabled: z.boolean(), phone: z.string().trim().max(30).nullable().optional() }).optional(),
});

/**
 * The wizard's choices: what's being bought (product), how it's designed, the brief for a custom
 * design and the optional features. What decides the price is fixed while an order is with staff
 * and once the event is paid for.
 */
export const PATCH = route<Ctx>("events.setup", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const event = await getOwnedEvent(user, id);
  const body = await parseJson(req, schema);

  const priced = body.product !== undefined || body.designSource !== undefined || body.features?.tier !== undefined;
  if (priced) {
    if (isUnlocked(event)) throw conflict("already_purchased", "This event has already been paid for.");
    if (await orderInReview(event.id)) throw conflict("order_in_review", "Your order is with our team — it can't be changed until it's been checked.");
  }
  if (body.designBrief !== undefined && event.designSource === "REQUEST" && (await orderInReview(event.id))) {
    throw conflict("order_in_review", "Your order is with our team — it can't be changed until it's been checked.");
  }

  const product = body.product ?? event.product;
  let designSource = body.designSource ?? event.designSource;
  if (body.designSource && !designSourcesFor(product).includes(body.designSource))
    throw badRequest("invalid_design_source", "That design option isn't available for this product.");
  designSource = designSourceFor(product, designSource);

  const data: Prisma.EventUpdateInput = { product, designSource };
  // Our designs and uploads are drawn differently; switching keeps both ready to come back to.
  if (designSource === "UPLOAD" && event.designSource !== "UPLOAD") data.imageMode = "CUSTOM";
  if (designSource !== "UPLOAD" && event.designSource === "UPLOAD") data.imageMode = "GENERATED";
  if (data.imageMode && data.imageMode !== event.imageMode) data.contentVersion = { increment: 1 };
  if (body.designBrief !== undefined) data.designBrief = body.designBrief || null;

  if (body.features || body.product) {
    const current = readFeatures(event.features);
    const next = { ...current, ...body.features };
    if (product === "PHOTO_ONLY") Object.assign(next, { qr: "skip", whatsapp: false });
    data.features = next as Prisma.InputJsonValue;
    // QR codes on or off are a design setting too ("decide later" leaves the design as it is).
    if (next.qr !== "later" && next.qr !== current.qr) {
      const design = eventDesign(event);
      const enabled = next.qr === "add";
      if (design.card.qr.enabled !== enabled) {
        data.design = { ...design, card: { ...design.card, qr: { ...design.card.qr, enabled } } } as unknown as Prisma.InputJsonValue;
        data.contentVersion = { increment: 1 };
      }
    }
  }

  if (body.whatsappUpdates) {
    if (body.whatsappUpdates.enabled) {
      const phone = normalizePhone(body.whatsappUpdates.phone ?? user.phone ?? "");
      if (!phone.ok) throw badRequest("invalid_phone", "Enter your WhatsApp number with the country code.", { phone: "Enter a valid number" });
      const current = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { whatsappUpdatesAt: true } });
      await db.user.update({ where: { id: user.id }, data: { phone: phone.e164, whatsappUpdatesAt: current.whatsappUpdatesAt ?? new Date() } });
    } else {
      await db.user.update({ where: { id: user.id }, data: { whatsappUpdatesAt: null } });
    }
  }

  const updated = await db.event.update({ where: { id: event.id }, data });
  return ok({ product: updated.product, designSource: updated.designSource, features: readFeatures(updated.features) });
});
