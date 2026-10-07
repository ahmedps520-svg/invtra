import type { NextRequest } from "next/server";
import { badRequest, ok, requireApiAdmin, route } from "@/server/http";
import { audit } from "@/server/log";
import { installWalletCertificate } from "@/server/apple/config";

/** Upload the Pass Type ID certificate Apple issued (.cer) — or a .p12 with its password. */
export const POST = route("admin.apple.certificate", async (req: NextRequest) => {
  const admin = await requireApiAdmin();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 64 * 1024) throw badRequest("file", "Choose the certificate file (.cer or .p12).");
  const password = form.get("password");
  const info = await installWalletCertificate(Buffer.from(await file.arrayBuffer()), typeof password === "string" ? password : null);
  await audit(admin.id, "admin.apple.wallet_certificate", "setting", "apple.wallet", { passTypeId: info.passTypeId, teamId: info.teamId, expiresAt: info.expiresAt });
  return ok({ message: `Apple Wallet is ready (${info.passTypeId})`, info });
});
