import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@prisma/client";
import { db } from "@/server/db";
import { generateSecretToken, sha256 } from "@/server/security/tokens";

export const SESSION_COOKIE = "invtra_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "status" | "locale" | "phone">;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = generateSecretToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 255) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/**
 * Resolve the signed-in user from the session cookie. Cached per request.
 * Deactivated accounts are treated as signed out.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: { select: { id: true, email: true, name: true, role: true, status: true, locale: true, phone: true } },
    },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;
  if (now - session.lastSeenAt.getTime() > SESSION_REFRESH_AFTER_MS) {
    // Sliding expiry: extend active sessions at most once a day.
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), expiresAt } });
    try {
      jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
    } catch {
      // Cookies are read-only while rendering Server Components; the DB expiry still moved.
    }
  }
  return session.user;
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string, exceptCurrent = false): Promise<void> {
  if (!exceptCurrent) {
    await db.session.deleteMany({ where: { userId } });
    return;
  }
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await db.session.deleteMany({ where: { userId, NOT: token ? { tokenHash: sha256(token) } : undefined } });
}
