import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/server/env";
import { clientIp } from "@/server/http";
import { rateLimit } from "@/server/security/rate-limit";
import { signinConfig } from "@/server/apple/config";
import { APPLE_STATE_COOKIE, appleAuthorizeUrl, createAppleState } from "@/server/apple/signin";
import { safeNext } from "@/components/auth/next-path";

/** "Continue with Apple": off to Apple, with a signed state cookie for the way back. */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"), "/dashboard");
  const config = await signinConfig();
  if (!config || !(await rateLimit(`apple-start:${clientIp(req)}`, 30, 600)).ok) {
    return NextResponse.redirect(appUrl(`/login?error=apple&next=${encodeURIComponent(next)}`), 303);
  }
  const { state, nonce, cookie } = createAppleState(next);
  const res = NextResponse.redirect(appleAuthorizeUrl(config, state, nonce), 303);
  // Apple posts back from its own site, so the cookie must be allowed on that cross-site POST.
  res.cookies.set(APPLE_STATE_COOKIE, cookie, { httpOnly: true, secure: true, sameSite: "none", path: "/api/auth/apple", maxAge: 600 });
  return res;
}
