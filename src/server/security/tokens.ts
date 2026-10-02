import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/** Unambiguous alphabet (no 0/O, 1/I/L) — easy to read aloud, safe in URLs. */
const INVITATION_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** 10 symbols × log2(31) ≈ 49.5 bits of entropy per invitation token. */
export const INVITATION_TOKEN_LENGTH = 10;

/** Cryptographically secure, unbiased random invitation token, e.g. "8F3K92QXHT". */
export function generateInvitationToken(): string {
  let out = "";
  for (let i = 0; i < INVITATION_TOKEN_LENGTH; i++) {
    out += INVITATION_ALPHABET[randomInt(INVITATION_ALPHABET.length)];
  }
  return out;
}

export function isWellFormedInvitationToken(token: string): boolean {
  if (token.length !== INVITATION_TOKEN_LENGTH) return false;
  for (const ch of token) if (!INVITATION_ALPHABET.includes(ch)) return false;
  return true;
}

/** Opaque secret for sessions / password resets (256 bits, base64url). */
export function generateSecretToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Secrets are stored hashed so a database leak does not leak live sessions. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string, secret = env().APP_SECRET): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
