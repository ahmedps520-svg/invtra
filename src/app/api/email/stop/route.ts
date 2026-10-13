import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/server/env";
import { stopReminders, validStopSignature } from "@/server/reminders/unpaid";

/**
 * Turn off reminder emails. The signed link is the authorisation, so it works without signing in
 * — from the page's button, or as the one-click unsubscribe that mail apps send (RFC 8058).
 */
export async function POST(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const s = req.nextUrl.searchParams.get("s");
  if (!u || !validStopSignature(u, s)) return NextResponse.json({ error: { code: "invalid_link" } }, { status: 400 });
  await stopReminders(u);
  return NextResponse.redirect(appUrl(`/email/stop?u=${encodeURIComponent(u)}&s=${encodeURIComponent(s!)}&done=1`), 303);
}
