import type { NextRequest } from "next/server";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import {
  createCustomPackage,
  customPackageSchema,
} from "@/server/custom/service";

/** Admin: create a custom package (host + event + payment link) and optionally send it. */
export const POST = route("admin.custom.create", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const input = await parseJson(req, customPackageSchema);
  const r = await createCustomPackage(admin.id, input);
  return ok(
    {
      orderId: r.order.id,
      eventId: r.event.id,
      payUrl: r.payUrl,
      newCustomer: r.newCustomer,
      sent: r.sent,
      customer: { name: r.user.name, email: r.user.email },
    },
    { status: 201 },
  );
});
