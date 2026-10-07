import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/server/http";
import { logError } from "@/server/log";
import { rateLimit } from "@/server/security/rate-limit";

/** Wallet reports problems with our passes or web service here. */
export async function POST(req: NextRequest) {
  if ((await rateLimit(`wallet-log:${clientIp(req)}`, 30, 600)).ok) {
    const body = (await req.json().catch(() => null)) as { logs?: unknown } | null;
    const logs = Array.isArray(body?.logs) ? body.logs.slice(0, 10).map((l) => String(l).slice(0, 500)) : [];
    if (logs.length) await logError("wallet:device-log", new Error(logs[0]), { logs }, "warn");
  }
  return new NextResponse(null, { status: 200 });
}
