import type { NextRequest } from "next/server";
import { badRequest, ok, requireApiAdmin, route } from "@/server/http";
import { addFinalFile } from "@/server/orders/service";

type Ctx = { params: Promise<{ id: string }> };

/** Upload a final deliverable (the finished custom design) for an approved order. */
export const POST = route<Ctx>("admin.orders.files", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("missing_file", "Choose a file to upload.");
  const saved = await addFinalFile(admin.id, id, { name: file.name, data: Buffer.from(await file.arrayBuffer()) });
  return ok({ file: { id: saved.id, name: saved.name }, message: "File added" }, { status: 201 });
});
