import type { NextRequest } from "next/server";
import { ok, requireApiAdmin, route } from "@/server/http";
import { audit } from "@/server/log";
import { saveProductPrices } from "@/server/orders/pricing";

/** Prices for the custom event design, Photo only and custom design requests (minor units). */
export const PUT = route("admin.payments.products", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const prices = await saveProductPrices(await req.json().catch(() => null));
  await audit(admin.id, "admin.products.prices", "setting", "products.prices", prices);
  return ok({ prices, message: "Prices saved" });
});
