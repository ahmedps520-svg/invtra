import { NextResponse } from "next/server";
import { requireApiAdmin, route } from "@/server/http";
import { pendingCsr } from "@/server/apple/config";

/** Download the certificate signing request to upload to Apple. */
export const GET = route("admin.apple.csr", async () => {
  await requireApiAdmin();
  const csr = await pendingCsr();
  if (!csr) return new NextResponse("Create a request first.", { status: 404 });
  return new NextResponse(csr, {
    headers: { "Content-Type": "application/pkcs10", "Content-Disposition": 'attachment; filename="INVTRA-Wallet.certSigningRequest"', "Cache-Control": "no-store" },
  });
});
