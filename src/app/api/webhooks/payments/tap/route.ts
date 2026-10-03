import { NextResponse, type NextRequest } from "next/server";
import { handleTapWebhook } from "@/server/payments/tap-webhook";

/** Tap Payments webhook — verified by the hashstring header and by re-fetching the charge (src/server/payments/tap-webhook.ts). */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new NextResponse(null, { status: 413 });
  const r = await handleTapWebhook(raw, req.headers.get("hashstring"));
  return NextResponse.json(r.body ?? null, { status: r.status });
}
