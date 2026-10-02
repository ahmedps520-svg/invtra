import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { safeEqual } from "@/server/security/tokens";
import { handleWhatsAppWebhook } from "@/server/whatsapp/webhook";

/**
 * WhatsApp Cloud API webhook.
 *   GET  — subscription verification (hub.challenge echo when hub.verify_token matches)
 *   POST — messages & status updates, authenticated by X-Hub-Signature-256
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = env().WHATSAPP_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && expected && safeEqual(p.get("hub.verify_token") ?? "", expected)) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new NextResponse(null, { status: 413 });
  try {
    const r = await handleWhatsAppWebhook(raw, req.headers.get("x-hub-signature-256"));
    return new NextResponse(r.body ?? null, { status: r.status });
  } catch {
    // Processing failed after verification — 500 makes Meta retry; de-duplication keeps retries safe.
    return new NextResponse(null, { status: 500 });
  }
}
