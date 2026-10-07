import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { clientIp } from "@/server/http";
import { logError } from "@/server/log";
import { rateLimit } from "@/server/security/rate-limit";
import { createSession } from "@/server/auth/session";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { signinConfig } from "@/server/apple/config";
import { accountForApple, APPLE_STATE_COOKIE, appleName, exchangeAppleCode, readAppleState, verifyAppleIdToken } from "@/server/apple/signin";

/**
 * Apple posts the sign-in result here (response_mode=form_post). Exempt from the proxy's
 * same-origin check; protected by the signed state cookie and the id_token's nonce.
 */
export async function POST(req: NextRequest) {
  const back = (path: string) => {
    const res = NextResponse.redirect(appUrl(path), 303);
    res.cookies.set(APPLE_STATE_COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", path: "/api/auth/apple", maxAge: 0 });
    return res;
  };
  if (!(await rateLimit(`apple-callback:${clientIp(req)}`, 30, 600)).ok) return back("/login?error=apple");
  const form = await req.formData().catch(() => null);
  const saved = readAppleState(req.cookies.get(APPLE_STATE_COOKIE)?.value);
  const next = saved?.next ?? "/dashboard";
  const failed = `/login?error=apple&next=${encodeURIComponent(next)}`;
  if (!form || !saved || form.get("state") !== saved.state) return back(failed);
  if (form.get("error")) return back(`/login?next=${encodeURIComponent(next)}`); // the user cancelled
  const config = await signinConfig();
  const code = form.get("code");
  if (!config || typeof code !== "string") return back(failed);
  try {
    const idToken = await exchangeAppleCode(config, code);
    const identity = await verifyAppleIdToken(idToken, config, saved.nonce);
    const user = await accountForApple(identity, appleName(form.get("user") as string | null), requestLocale(req));
    if (user.status !== "ACTIVE") return back("/login?error=deactivated");
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id, req.headers.get("user-agent"));
    return back(next);
  } catch (e) {
    await logError("auth:apple", e);
    return back(failed);
  }
}

/** The visitor's language from their choice (cookie) or browser — for a new account. */
function requestLocale(req: NextRequest): "en" | "ar" {
  const chosen = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return (req.headers.get("accept-language") ?? "").trim().toLowerCase().startsWith("ar") ? "ar" : "en";
}
