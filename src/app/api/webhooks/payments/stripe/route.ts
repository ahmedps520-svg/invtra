import { NextResponse, type NextRequest } from "next/server";
import { handleStripeWebhook } from "@/server/payments/webhook";

/** Stripe webhook — authenticated by the Stripe-Signature header (see src/server/payments/webhook.ts). */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new NextResponse(null, { status: 413 });
  const r = await handleStripeWebhook(raw, req.headers.get("stripe-signature"));
  return NextResponse.json(r.body ?? null, { status: r.status });
}
