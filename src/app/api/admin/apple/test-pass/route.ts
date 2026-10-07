import { NextResponse } from "next/server";
import { requireApiAdmin, route } from "@/server/http";
import { sampleWalletPass } from "@/server/apple/wallet";

/** A sample pass (sample event and guest) to check the setup on an iPhone. */
export const GET = route("admin.apple.test-pass", async () => {
  await requireApiAdmin();
  const pass = await sampleWalletPass();
  if (!pass) return new NextResponse("Apple Wallet isn't set up yet.", { status: 404 });
  return new NextResponse(new Uint8Array(pass), {
    headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": 'attachment; filename="INVTRA-sample.pkpass"', "Cache-Control": "no-store" },
  });
});
