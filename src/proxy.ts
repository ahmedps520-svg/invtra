import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { LOCALE_HEADER, isLocalizedPath, localePath, splitLocale } from "@/lib/i18n/routing";

const SESSION_COOKIE = "invtra_session";

function storageOrigins(): string {
  const endpoint = process.env.S3_ENDPOINT;
  if (process.env.STORAGE_DRIVER !== "s3") return "";
  if (endpoint) {
    try {
      const u = new URL(endpoint);
      return ` ${u.protocol}//*.${u.host} ${u.origin}`;
    } catch {
      return "";
    }
  }
  return " https://*.amazonaws.com";
}

function csp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const media = storageOrigins();
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used for theme colours; styles cannot execute code.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${media}`,
    `media-src 'self' blob:${media}`,
    "font-src 'self' data:",
    `connect-src 'self'${media}`,
    "frame-src 'self' https://www.google.com https://maps.google.com https://checkout.stripe.com",
    "frame-ancestors 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * One public address for search engines: the Render default host (invtra.onrender.com) sends
 * visitors to APP_URL. Render itself redirects www → apex. API calls (health checks, webhooks)
 * are left alone.
 */
function canonicalHostRedirect(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production" || !process.env.APP_URL) return null;
  if (!["GET", "HEAD"].includes(req.method) || req.nextUrl.pathname.startsWith("/api/")) return null;
  const host = req.headers.get("host")?.toLowerCase();
  let canonical: URL;
  try {
    canonical = new URL(process.env.APP_URL);
  } catch {
    return null;
  }
  if (!host || host === canonical.host || !host.endsWith(".onrender.com") || canonical.host.endsWith(".onrender.com")) return null;
  return NextResponse.redirect(new URL(req.nextUrl.pathname + req.nextUrl.search, canonical.origin), 301);
}

/** Remember the Arabic choice for the app pages (same cookie as the language switcher). */
function rememberArabicOn(res: NextResponse) {
  res.cookies.set(LOCALE_COOKIE, "ar", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

const isPrefetch = (req: NextRequest) => req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch";

/**
 * Runs before every request:
 *  1. Canonical host redirect.
 *  2. CSRF defence for the JSON API — state-changing requests must come from our own origin.
 *  3. Optimistic redirect to sign-in for app areas (real authorisation happens server-side).
 *  4. Language-prefixed marketing URLs (/ar/…) and per-request CSP nonce for pages.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hostRedirect = canonicalHostRedirect(req);
  if (hostRedirect) return hostRedirect;

  if (pathname.startsWith("/api/")) {
    const method = req.method.toUpperCase();
    // Called by other services, not browsers on our pages: webhooks (signed), Apple Wallet on
    // guests' phones (pass authentication token) and Sign in with Apple's form post (state cookie).
    const external =
      pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/wallet/v1/") || pathname === "/api/auth/apple/callback";
    if (!external && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      let sameOrigin = false;
      if (origin && host) {
        try {
          sameOrigin = new URL(origin).host === host;
        } catch {
          sameOrigin = false;
        }
      }
      if (!sameOrigin) {
        return NextResponse.json({ error: { code: "bad_origin", message: "Cross-origin request blocked." } }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) && !req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  // Marketing pages: the URL decides the language (/ar/… is Arabic) so both versions are indexable.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(LOCALE_HEADER);
  const { locale: prefixed, path } = splitLocale(pathname);
  let rewrite: URL | null = null;
  let rememberArabic = false;
  if (prefixed) {
    if (!isLocalizedPath(path)) {
      // App pages have no /ar address — they follow the remembered language instead.
      const url = req.nextUrl.clone();
      url.pathname = path;
      const res = NextResponse.redirect(url, 307);
      rememberArabicOn(res);
      return res;
    }
    requestHeaders.set(LOCALE_HEADER, "ar");
    rewrite = req.nextUrl.clone();
    rewrite.pathname = path;
    rememberArabic = req.cookies.get(LOCALE_COOKIE)?.value !== "ar" && !isPrefetch(req);
  } else if (isLocalizedPath(pathname)) {
    const chosen = req.cookies.get(LOCALE_COOKIE)?.value;
    const prefersArabic = chosen ? chosen === "ar" : /^\s*ar\b/i.test(req.headers.get("accept-language") ?? "");
    if (prefersArabic && req.method === "GET" && !isPrefetch(req)) {
      const res = NextResponse.redirect(new URL(localePath("ar", pathname) + req.nextUrl.search, req.url), 307);
      res.headers.set("Vary", "Cookie, Accept-Language");
      return res;
    }
    requestHeaders.set(LOCALE_HEADER, "en");
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const res = rewrite ? NextResponse.rewrite(rewrite, { request: { headers: requestHeaders } }) : NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", policy);
  if (rememberArabic) rememberArabicOn(res);
  return res;
}

export const config = {
  matcher: [
    // Arabic marketing URLs must always be rewritten, prefetches included.
    "/ar",
    "/ar/:path*",
    {
      source: "/((?!_next/static|_next/image|fonts/|brand/|flags/|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
