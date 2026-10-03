import type { NextRequest } from "next/server";
import { ok, requireApiAdmin, route } from "@/server/http";
import { lookupCustomer } from "@/server/custom/service";

/** Admin: is this email already a customer? (prefills the custom-event wizard) */
export const GET = route("admin.custom.lookup", async (req: NextRequest) => {
  await requireApiAdmin();
  return ok({
    customer: await lookupCustomer(req.nextUrl.searchParams.get("email") ?? ""),
  });
});
