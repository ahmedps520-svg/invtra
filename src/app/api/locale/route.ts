import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";

/** Switch the UI language. Persists on the account too when signed in. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { locale?: unknown } | null;
  if (!isLocale(body?.locale)) return NextResponse.json({ error: { code: "invalid_locale" } }, { status: 400 });
  const user = await getSessionUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { locale: body.locale } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOCALE_COOKIE, body.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
