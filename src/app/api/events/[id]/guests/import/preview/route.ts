import type { NextRequest } from "next/server";
import { badRequest, ok, requireApiUser, route } from "@/server/http";
import { getOwnedEvent } from "@/server/events/access";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { defaultCountryFor, previewImport } from "@/server/guests/service";

type Ctx = { params: Promise<{ id: string }> };

/** Parse a CSV / Excel guest list and report valid rows, invalid numbers and duplicates. Saves nothing. */
export const POST = route<Ctx>("guests.import.preview", async (req: NextRequest, ctx) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await enforceRateLimit(`import:${user.id}`, 30, 600);
  const event = await getOwnedEvent(user, id);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("missing_file", "Choose a CSV or Excel file.");
  if (file.size > 3 * 1024 * 1024) throw badRequest("file_too_large", "Guest lists can be up to 3 MB.");
  const country = String(form?.get("country") || defaultCountryFor(event.timezone)).toUpperCase().slice(0, 2);
  const result = await previewImport(event.id, { name: file.name, data: Buffer.from(await file.arrayBuffer()) }, country);
  return ok({ ...result, country });
});
