/**
 * Email verification: 4-digit codes (10 minutes), one resend a minute with hourly and daily
 * caps, a few tries per code, the 5-day deadline and the lock after it, and the other ways an
 * email counts as verified (Apple, a password reset link, staff).
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";

const sent: { to: string; subject: string; text: string }[] = [];
let failNext = false;
vi.mock("@/server/email", () => ({
  sendEmail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    if (failNext) {
      failNext = false;
      throw new Error("SMTP down");
    }
    sent.push(m);
  }),
}));
const session = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/server/auth/session", async (orig) => ({
  ...(await orig<object>()),
  getSessionUser: vi.fn(async () => session.user),
  createSession: vi.fn(async () => undefined),
}));

import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  codeStatus,
  confirmVerificationCode,
  sendVerificationCode,
  verificationOf,
  isLocked,
  newAccountDeadline,
} from "@/server/auth/verification";
import { requireApiSession, requireApiUser } from "@/server/http";
import { accountForApple } from "@/server/apple/signin";
import { verifyCustomerEmail } from "@/server/admin/customers";
import { POST as resetRoute } from "@/app/api/auth/reset/route";
import { generateSecretToken, sha256 } from "@/server/security/tokens";
import { renderEmail } from "@/server/email-template";
import { verificationCodeEmail } from "@/server/emails";

const run = randomBytes(5).toString("hex");
const userIds: string[] = [];
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
let ipN = 0;
const ip = () => `10.99.${run.length}.${++ipN}`;

async function makeUser(extra: Record<string, unknown> = {}) {
  const user = await db.user.create({
    data: { email: `verify-${run}-${userIds.length}@example.test`, name: "Noura", passwordHash: "x", verifyBy: newAccountDeadline(), ...extra },
  });
  userIds.push(user.id);
  return user;
}
const lastCode = () => sent.at(-1)!.subject.match(/\d{4}/)![0];
const wrong = (code: string) => String((Number(code) + 1) % 10000).padStart(4, "0");

beforeEach(() => {
  sent.length = 0;
  failNext = false;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("verification state", () => {
  it("counts down five days, then locks — except staff", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    const base = { role: "CUSTOMER", emailVerifiedAt: null, createdAt: now };
    expect(verificationOf({ ...base, verifyBy: newAccountDeadline(now) }, now)).toMatchObject({ verified: false, daysLeft: 5, locked: false });
    expect(verificationOf({ ...base, verifyBy: new Date(now.getTime() + 2 * HOUR) }, now)).toMatchObject({ daysLeft: 1, locked: false });
    expect(verificationOf({ ...base, verifyBy: new Date(now.getTime() - 1) }, now)).toMatchObject({ daysLeft: 0, locked: true });
    expect(isLocked({ ...base, role: "ADMIN", verifyBy: new Date(now.getTime() - DAY) }, now)).toBe(false);
    expect(verificationOf({ ...base, emailVerifiedAt: now, verifyBy: null }, now)).toEqual({ verified: true });
    // No deadline stored: five days from sign-up.
    expect(verificationOf({ ...base, verifyBy: null, createdAt: new Date(now.getTime() - 6 * DAY) }, now)).toMatchObject({ locked: true });
  });

  it("refuses the app's API to a locked account, but not the verification endpoints", async () => {
    const user = await makeUser({ verifyBy: new Date(Date.now() - MIN) });
    session.user = user;
    await expect(requireApiUser()).rejects.toMatchObject({ status: 403, code: "email_unverified" });
    await expect(requireApiSession()).resolves.toMatchObject({ id: user.id });
    session.user = { ...user, verifyBy: new Date(Date.now() + DAY) };
    await expect(requireApiUser()).resolves.toMatchObject({ id: user.id });
    session.user = null;
  });
});

describe("codes", () => {
  it("emails a 4-digit code that works for 10 minutes and verifies the account", async () => {
    const user = await makeUser();
    const t0 = new Date();
    const status = await sendVerificationCode(user, ip(), t0);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
    expect(sent[0].subject).toMatch(/^\d{4} is your INVTRA verification code$/);
    expect(new Date(status.expiresAt!).getTime() - t0.getTime()).toBe(CODE_TTL_MS);
    expect(new Date(status.resendAt).getTime() - t0.getTime()).toBe(MIN);
    const stored = await db.emailCode.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.codeHash).not.toContain(lastCode()); // only a hash is kept

    await expect(confirmVerificationCode(user, lastCode(), ip(), new Date(t0.getTime() + CODE_TTL_MS + 1000))).rejects.toMatchObject({ code: "code_expired" });
    await expect(confirmVerificationCode(user, lastCode(), ip(), new Date(t0.getTime() + 9 * MIN))).resolves.toEqual({ verified: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
    // Used once only, and nothing more to send.
    await expect(sendVerificationCode({ ...user, emailVerifiedAt: new Date() }, ip())).rejects.toMatchObject({ status: 409 });
  });

  it("waits a minute between codes, and a new code replaces the old one", async () => {
    const user = await makeUser();
    const t0 = new Date();
    await sendVerificationCode(user, ip(), t0);
    const first = lastCode();
    const early = sendVerificationCode(user, ip(), new Date(t0.getTime() + 30_000));
    await expect(early).rejects.toMatchObject({ status: 429, code: "resend_cooldown", fields: { retryAfter: "30" } });
    expect(sent).toHaveLength(1);

    await sendVerificationCode(user, ip(), new Date(t0.getTime() + 61_000));
    const second = lastCode();
    const at = new Date(t0.getTime() + 62_000);
    if (first !== second) await expect(confirmVerificationCode(user, first, ip(), at)).rejects.toMatchObject({ code: "invalid_code" });
    await expect(confirmVerificationCode(user, second, ip(), at)).resolves.toEqual({ verified: true });
  });

  it("allows five codes an hour and ten a day", async () => {
    const user = await makeUser();
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) await sendVerificationCode(user, ip(), new Date(t0 + i * 2 * MIN));
    const blocked = sendVerificationCode(user, ip(), new Date(t0 + 12 * MIN));
    await expect(blocked).rejects.toMatchObject({ status: 429, code: "code_limit" });
    // The first of those five leaves the hour 60 minutes after it was sent.
    const status = await codeStatus(user, new Date(t0 + 12 * MIN));
    expect(new Date(status.resendAt).getTime()).toBe(t0 + HOUR);

    for (let i = 0; i < 5; i++) await sendVerificationCode(user, ip(), new Date(t0 + HOUR + i * 2 * MIN));
    await expect(sendVerificationCode(user, ip(), new Date(t0 + 3 * HOUR))).rejects.toMatchObject({ code: "code_limit" });
    expect(new Date((await codeStatus(user, new Date(t0 + 3 * HOUR))).resendAt).getTime()).toBe(t0 + DAY);
    await expect(sendVerificationCode(user, ip(), new Date(t0 + DAY + MIN))).resolves.toBeTruthy();
  });

  it("gives each code five tries", async () => {
    const user = await makeUser();
    const t0 = new Date();
    await sendVerificationCode(user, ip(), t0);
    const code = lastCode();
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await expect(confirmVerificationCode(user, wrong(code), ip(), t0)).rejects.toMatchObject({ code: "invalid_code", fields: { attemptsLeft: String(MAX_ATTEMPTS - i) } });
    }
    await expect(confirmVerificationCode(user, wrong(code), ip(), t0)).rejects.toMatchObject({ code: "too_many_attempts" });
    // Even the right code no longer works: a new one is needed.
    await expect(confirmVerificationCode(user, code, ip(), t0)).rejects.toMatchObject({ code: "too_many_attempts" });
    expect((await codeStatus(user, t0)).expiresAt).toBeNull();
  });

  it("doesn't count an email that failed to send", async () => {
    const user = await makeUser();
    failNext = true;
    await expect(sendVerificationCode(user, ip())).rejects.toMatchObject({ status: 502, code: "email_failed" });
    expect(await db.emailCode.count({ where: { userId: user.id } })).toBe(0);
    await expect(sendVerificationCode(user, ip())).resolves.toBeTruthy(); // no cooldown
  });

  it("unlocks an account that passed its deadline", async () => {
    const user = await makeUser({ verifyBy: new Date(Date.now() - DAY) });
    expect(isLocked(user)).toBe(true);
    await sendVerificationCode(user, ip());
    await confirmVerificationCode(user, lastCode(), ip());
    expect(isLocked(await db.user.findUniqueOrThrow({ where: { id: user.id } }))).toBe(false);
  });

  it("renders the code in the email, in both languages", () => {
    const en = verificationCodeEmail({ name: "Noura", locale: "en", code: "0427", minutes: 10 });
    const ar = verificationCodeEmail({ name: "نورة", locale: "ar", code: "0427", minutes: 10 });
    expect(renderEmail(en)).toContain("0427");
    expect(renderEmail(en)).toContain("Valid for 10 minutes");
    expect(ar.subject).toContain("0427");
    expect(renderEmail(ar)).toContain('dir="ltr"');
  });
});

describe("other proof of the email", () => {
  it("Sign in with Apple accounts are verified; linking an Apple ID with the same email verifies it", async () => {
    const sub = `apple-${run}-new`;
    const created = await accountForApple({ sub, email: `apple-${run}@privaterelay.appleid.com`, emailVerified: true, privateEmail: true }, "Reem", "en");
    userIds.push(created.id);
    expect(created.emailVerifiedAt).not.toBeNull();

    const existing = await makeUser();
    const linked = await accountForApple({ sub: `apple-${run}-link`, email: existing.email, emailVerified: true, privateEmail: false }, null, "en");
    expect(linked.id).toBe(existing.id);
    expect(linked.emailVerifiedAt).not.toBeNull();
  });

  it("a password reset link verifies the email", async () => {
    const user = await makeUser();
    const token = generateSecretToken();
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + HOUR) } });
    const res = await resetRoute(
      new NextRequest("https://invtra.store/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, password: "a-brand-new-password" }),
        headers: { "content-type": "application/json", "x-forwarded-for": ip() },
      }),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
  });

  it("staff can mark an email verified (audited)", async () => {
    const user = await makeUser({ verifyBy: new Date(Date.now() - DAY) });
    await verifyCustomerEmail(user.id, user.id, "Replied from the address on WhatsApp");
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "admin.user.verify_email", targetId: user.id } })).toBe(1);
    await expect(verifyCustomerEmail(user.id, user.id, "again")).rejects.toMatchObject({ status: 409 });
    await db.auditLog.deleteMany({ where: { targetId: user.id } });
  });
});
