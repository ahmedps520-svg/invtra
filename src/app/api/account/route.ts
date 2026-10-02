import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { badRequest, ok, parseJson, requireApiUser, route } from "@/server/http";
import { storage } from "@/server/storage";
import { normalizePhone } from "@/lib/phone";

export const PATCH = route("account.update", async (req: NextRequest) => {
  const user = await requireApiUser();
  const input = await parseJson(
    req,
    z.object({
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().max(32).optional().nullable(),
      locale: z.enum(["en", "ar"]).optional(),
    }),
  );
  let phone: string | null = null;
  if (input.phone) {
    const p = normalizePhone(input.phone);
    if (!p.ok) throw badRequest("invalid_phone", "Enter a valid phone number with country code.", { phone: "Invalid number" });
    phone = p.e164;
  }
  const updated = await db.user.update({
    where: { id: user.id },
    data: { name: input.name, phone, ...(input.locale ? { locale: input.locale } : {}) },
    select: { id: true, name: true, email: true, phone: true, locale: true },
  });
  return ok({ user: updated });
});

/** Permanently delete the account and all of its events, guests and files. */
export const DELETE = route("account.delete", async (req: NextRequest) => {
  const user = await requireApiUser();
  const { confirm } = await parseJson(req, z.object({ confirm: z.literal("DELETE") }));
  void confirm;
  await db.event.updateMany({ where: { userId: user.id, deletedAt: null }, data: { deletedAt: new Date(0) } });
  const { purgeDeletedEvents } = await import("@/server/maintenance");
  await purgeDeletedEvents();
  await storage().deletePrefix(`u/${user.id}/`).catch(() => undefined);
  await db.user.delete({ where: { id: user.id } });
  return ok();
});
