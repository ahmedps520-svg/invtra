import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { User } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { HttpError } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { sendEmail } from "@/server/email";
import { renderEmail, renderEmailText } from "@/server/email-template";
import { verificationCodeEmail } from "@/server/emails";

/**
 * Email verification. Every account proves it owns its email with a 4-digit code sent there.
 * Accounts have VERIFY_DAYS to do it; after that they are deactivated (signed in, but locked to
 * the verification page) until they verify. Staff accounts are never locked.
 */

export { VERIFY_DAYS, newAccountDeadline, verificationOf, isLocked, type Verification } from "@/lib/auth/verification";
export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_CODES_PER_HOUR = 5;
export const MAX_CODES_PER_DAY = 10;
export const MAX_ATTEMPTS = 5;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

function hashCode(userId: string, code: string) {
  return createHmac("sha256", env().APP_SECRET).update(`email-code:${userId}:${code}`).digest("hex");
}

const tooMany = (code: string, message: string, retryAfterMs: number) =>
  new HttpError(429, code, message, { retryAfter: String(Math.max(1, Math.ceil(retryAfterMs / 1000))) });

/** The latest code, while it can still be entered. */
export async function activeCode(userId: string, now = new Date()) {
  const code = await db.emailCode.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!code || code.usedAt || code.expiresAt <= now || code.attempts >= MAX_ATTEMPTS) return null;
  return code;
}

/** When the user may ask for another code (now if they may already). */
export async function nextSendAt(userId: string, now = new Date()): Promise<Date> {
  const recent = await db.emailCode.findMany({
    where: { userId, createdAt: { gt: new Date(now.getTime() - DAY) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const times = recent.map((r) => r.createdAt.getTime());
  let at = now.getTime();
  if (times.length) at = Math.max(at, times[0] + RESEND_COOLDOWN_MS);
  const lastHour = times.filter((t) => t > now.getTime() - HOUR);
  if (lastHour.length >= MAX_CODES_PER_HOUR) at = Math.max(at, lastHour[MAX_CODES_PER_HOUR - 1] + HOUR);
  if (times.length >= MAX_CODES_PER_DAY) at = Math.max(at, times[MAX_CODES_PER_DAY - 1] + DAY);
  return new Date(at);
}

export type CodeStatus = { email: string; expiresAt: string | null; resendAt: string };

export async function codeStatus(user: Pick<User, "id" | "email">, now = new Date()): Promise<CodeStatus> {
  const [code, resendAt] = await Promise.all([activeCode(user.id, now), nextSendAt(user.id, now)]);
  return { email: user.email, expiresAt: code?.expiresAt.toISOString() ?? null, resendAt: resendAt.toISOString() };
}

/**
 * Email a new code. One a minute at most, five an hour and ten a day per account (plus a
 * per-network limit); a new code replaces the previous one.
 */
export async function sendVerificationCode(
  user: Pick<User, "id" | "email" | "name" | "locale" | "emailVerifiedAt">,
  ip: string,
  now = new Date(),
): Promise<CodeStatus> {
  if (user.emailVerifiedAt) throw new HttpError(409, "already_verified", "This email is already verified.");
  await enforceRateLimit(`verify-send:ip:${ip}`, 30, 3600);
  const recent = await db.emailCode.findMany({
    where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - DAY) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const times = recent.map((r) => r.createdAt.getTime());
  if (times.length && now.getTime() - times[0] < RESEND_COOLDOWN_MS) {
    throw tooMany("resend_cooldown", "Please wait a minute before asking for another code.", times[0] + RESEND_COOLDOWN_MS - now.getTime());
  }
  const lastHour = times.filter((t) => t > now.getTime() - HOUR);
  if (lastHour.length >= MAX_CODES_PER_HOUR) {
    throw tooMany("code_limit", "You've asked for several codes. Please try again later.", lastHour[MAX_CODES_PER_HOUR - 1] + HOUR - now.getTime());
  }
  if (times.length >= MAX_CODES_PER_DAY) {
    throw tooMany("code_limit", "You've asked for several codes. Please try again later.", times[MAX_CODES_PER_DAY - 1] + DAY - now.getTime());
  }

  const code = String(randomInt(0, 10_000)).padStart(4, "0");
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  const row = await db.emailCode.create({ data: { userId: user.id, codeHash: hashCode(user.id, code), expiresAt, createdAt: now } });
  try {
    const mail = verificationCodeEmail({ name: user.name, locale: user.locale, code, minutes: CODE_TTL_MS / 60_000 });
    await sendEmail({ to: user.email, subject: mail.subject, text: renderEmailText(mail), html: renderEmail(mail) });
  } catch (e) {
    // Nothing was sent, so it doesn't count against the limits.
    await db.emailCode.delete({ where: { id: row.id } });
    const { logError } = await import("@/server/log");
    await logError("auth:verify-email", e, { userId: user.id });
    throw new HttpError(502, "email_failed", "We couldn't send the email. Please try again in a moment.");
  }
  // Older codes stop working once a new one is on its way.
  await db.emailCode.updateMany({ where: { userId: user.id, id: { not: row.id }, usedAt: null }, data: { usedAt: now } });
  return codeStatus(user, now);
}

/** Check a code; on success the email is verified (and a locked account is active again). */
export async function confirmVerificationCode(user: Pick<User, "id" | "emailVerifiedAt">, input: string, ip: string, now = new Date()) {
  if (user.emailVerifiedAt) return { verified: true as const };
  await enforceRateLimit(`verify-code:ip:${ip}`, 60, 600);
  await enforceRateLimit(`verify-code:user:${user.id}`, 20, 600);
  const latest = await db.emailCode.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (!latest || latest.usedAt || latest.expiresAt <= now) {
    throw new HttpError(400, "code_expired", "This code has expired. Ask for a new one.");
  }
  if (latest.attempts >= MAX_ATTEMPTS) {
    throw new HttpError(400, "too_many_attempts", "Too many wrong codes. Ask for a new one.");
  }
  const expected = Buffer.from(latest.codeHash, "hex");
  const given = Buffer.from(hashCode(user.id, input.trim()), "hex");
  if (!/^\d{4}$/.test(input.trim()) || !timingSafeEqual(expected, given)) {
    const updated = await db.emailCode.update({ where: { id: latest.id }, data: { attempts: { increment: 1 } } });
    const left = Math.max(0, MAX_ATTEMPTS - updated.attempts);
    if (!left) throw new HttpError(400, "too_many_attempts", "Too many wrong codes. Ask for a new one.");
    throw new HttpError(400, "invalid_code", "That code isn't right.", { attemptsLeft: String(left) });
  }
  await db.$transaction([
    db.emailCode.update({ where: { id: latest.id }, data: { usedAt: now } }),
    db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now } }),
  ]);
  await db.emailCode.deleteMany({ where: { userId: user.id, id: { not: latest.id } } });
  return { verified: true as const };
}

/** Proof of the email some other way (a password reset link, Apple, staff). */
export async function markEmailVerified(userId: string, now = new Date()) {
  await db.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
}
