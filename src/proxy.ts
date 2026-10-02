import { NextResponse, type NextRequest } from "next/server";

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
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Runs before every request:
 *  1. CSRF defence for the JSON API — state-changing requests must come from our own origin.
 *  2. Optimistic redirect to sign-in for app areas (real authorisation happens server-side).
 *  3. Per-request CSP nonce for pages.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    const method = req.method.toUpperCase();
    const isWebhook = pathname.startsWith("/api/webhooks/");
    if (!isWebhook && !["GET", "HEAD", "OPTIONS"].includes(method)) {
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

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", policy);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|fonts/|brand/|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
