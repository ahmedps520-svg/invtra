import type { NextRequest } from "next/server";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { customPackageSchema, saveCustomPackage } from "@/server/custom/service";

type Ctx = { params: Promise<{ eventId: string }> };

/** Admin: add the host and the package to a custom event (creates or updates its payment link). */
export const POST = route<Ctx>("admin.custom.package", async (req: NextRequest, ctx) => {
  const admin = await requireApiAdmin();
  const { eventId } = await ctx.params;
  const input = await parseJson(req, customPackageSchema);
  const r = await saveCustomPackage(admin.id, eventId, input);
  return ok({
    orderId: r.order.id,
    payUrl: r.payUrl,
    newCustomer: r.newCustomer,
    customer: { name: r.user.name, email: r.user.email },
  });
});
