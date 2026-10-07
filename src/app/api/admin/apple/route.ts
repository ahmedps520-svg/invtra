import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseJson, requireApiAdmin, route } from "@/server/http";
import { audit } from "@/server/log";
import { createWalletCsr, removeApple } from "@/server/apple/config";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_csr") }),
  z.object({ action: z.literal("remove"), part: z.enum(["wallet", "signin"]) }),
]);

/** Admin → Apple: start a Wallet certificate request, or remove a configured part. */
export const POST = route("admin.apple", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const input = await parseJson(req, schema);
  if (input.action === "create_csr") {
    await createWalletCsr(admin.email);
    await audit(admin.id, "admin.apple.wallet_csr", "setting", "apple.wallet");
    return ok({ message: "Certificate request ready — download it and upload it to Apple." });
  }
  await removeApple(input.part);
  await audit(admin.id, `admin.apple.remove_${input.part}`, "setting", `apple.${input.part}`);
  return ok({ message: input.part === "wallet" ? "Apple Wallet turned off" : "Sign in with Apple turned off" });
});
