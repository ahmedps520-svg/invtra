import { NextResponse, type NextRequest } from "next/server";
import { storage, contentTypeFor } from "@/server/storage";
import { signLocal } from "@/server/storage/local";
import { safeEqual } from "@/server/security/tokens";
import { env } from "@/server/env";

/** Serves files for the local storage driver. Requires a valid, unexpired signature. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  if (env().STORAGE_DRIVER !== "local") return new NextResponse(null, { status: 404 });
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  const exp = Number(req.nextUrl.searchParams.get("exp"));
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() || !safeEqual(sig, signLocal(key, exp))) {
    return new NextResponse(null, { status: 403 });
  }
  let data: Buffer | null = null;
  try {
    data = await storage().get(key);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!data) return new NextResponse(null, { status: 404 });
  const maxAge = Math.max(0, Math.min(exp - Math.floor(Date.now() / 1000), 7 * 86400));
  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(key),
    "Cache-Control": `private, max-age=${maxAge}, immutable`,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  // Byte ranges are required by Safari/iOS for <audio> playback.
  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    const size = data.length;
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const chunk = data.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(chunk.length) },
    });
  }
  return new NextResponse(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
}
