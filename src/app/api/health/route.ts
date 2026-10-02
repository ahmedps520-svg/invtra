import { NextResponse } from "next/server";
import { db } from "@/server/db";

/** Liveness/readiness probe for the hosting platform. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
