import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { updateTheme } from "@/server/admin/themes";

type Ctx = { params: Promise<{ key: string }> };

const schema = z.object({
  isActive: z.boolean().optional(),
  isPremium: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

/** Toggle a theme's availability / premium flag or change its position in the picker. */
export const PATCH = route<Ctx>("admin.themes.update", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { key } = await ctx.params;
  const patch = await parseJson(req, schema);
  if (!Object.keys(patch).length) throw badRequest("empty_patch", "Nothing to update.");
  const theme = await updateTheme(admin.id, key, patch);
  return ok({ theme, message: "Theme updated" });
});
