import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify, type JsonWebKey } from "node:crypto";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { hmac, safeEqual } from "@/server/security/tokens";
import { signinConfig, type SigninConfig } from "./config";

/**
 * Sign in with Apple (web): OpenID Connect against appleid.apple.com. Apple posts the result
 * back to /api/auth/apple/callback (form_post); the state and nonce travel in a short-lived
 * signed cookie. The client secret is a JWT we sign with the .p8 key (ES256), and Apple's
 * id_token is verified against Apple's published keys.
 */

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_STATE_COOKIE = "invtra_apple";
const STATE_TTL_MS = 10 * 60_000;

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function appleRedirectUri() {
  return appUrl("/api/auth/apple/callback");
}

/** The signed state cookie value: state, nonce, where to go after, expiry. */
export function createAppleState(next: string) {
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const body = b64url(JSON.stringify({ state, nonce, next, exp: Date.now() + STATE_TTL_MS }));
  return { state, nonce, cookie: `${body}.${hmac(`apple-state:${body}`)}` };
}

export function readAppleState(cookie: string | undefined | null): { state: string; nonce: string; next: string } | null {
  if (!cookie) return null;
  const [body, mac] = cookie.split(".");
  if (!body || !mac || !safeEqual(mac, hmac(`apple-state:${body}`))) return null;
  try {
    const v = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { state: string; nonce: string; next: string; exp: number };
    return v.exp > Date.now() ? v : null;
  } catch {
    return null;
  }
}

export function appleAuthorizeUrl(config: Pick<SigninConfig, "clientId">, state: string, nonce: string) {
  const q = new URLSearchParams({
    response_type: "code id_token",
    response_mode: "form_post",
    client_id: config.clientId,
    redirect_uri: appleRedirectUri(),
    scope: "name email",
    state,
    nonce,
  });
  return `${APPLE_ISSUER}/auth/authorize?${q}`;
}

/** The client secret: a short-lived ES256 JWT signed with the Sign in with Apple key. */
export function appleClientSecret(config: SigninConfig, now = new Date()) {
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: config.teamId, iat, exp: iat + 300, aud: APPLE_ISSUER, sub: config.clientId }));
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key: createPrivateKey(config.privateKeyPem), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(sig)}`;
}

/** Exchange the authorization code for Apple's id_token. */
export async function exchangeAppleCode(config: SigninConfig, code: string): Promise<string> {
  const res = await fetch(`${APPLE_ISSUER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: appleClientSecret(config),
      code,
      grant_type: "authorization_code",
      redirect_uri: appleRedirectUri(),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !body.id_token) throw new Error(`Apple token exchange failed (${res.status} ${body.error ?? ""})`);
  return body.id_token;
}

let jwks: { keys: (JsonWebKey & { kid: string })[]; at: number } | null = null;
async function appleKeys(force = false) {
  if (!force && jwks && Date.now() - jwks.at < 3600_000) return jwks.keys;
  const res = await fetch(`${APPLE_ISSUER}/auth/keys`);
  if (!res.ok) throw new Error(`Apple keys unavailable (${res.status})`);
  jwks = { keys: ((await res.json()) as { keys: (JsonWebKey & { kid: string })[] }).keys, at: Date.now() };
  return jwks.keys;
}

export type AppleIdentity = { sub: string; email: string | null; emailVerified: boolean; privateEmail: boolean };

/** Check Apple's id_token: signature, issuer, audience, expiry and our nonce. */
export async function verifyAppleIdToken(idToken: string, config: Pick<SigninConfig, "clientId">, nonce: string): Promise<AppleIdentity> {
  const [h, p, s] = idToken.split(".");
  if (!h || !p || !s) throw new Error("Malformed id_token");
  const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as { kid?: string; alg?: string };
  if (header.alg !== "RS256") throw new Error("Unexpected id_token algorithm");
  let jwk = (await appleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await appleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown id_token key");
  const ok = verify("RSA-SHA256", Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
  if (!ok) throw new Error("Bad id_token signature");
  const c = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);
  if (c.iss !== APPLE_ISSUER) throw new Error("Wrong issuer");
  if (c.aud !== config.clientId) throw new Error("Wrong audience");
  if (typeof c.exp !== "number" || c.exp < now - 60) throw new Error("Expired id_token");
  // Apple returns the nonce as sent (some clients send its SHA-256 instead).
  if (c.nonce !== nonce && c.nonce !== createHash("sha256").update(nonce).digest("hex")) throw new Error("Nonce mismatch");
  if (typeof c.sub !== "string" || !c.sub) throw new Error("No subject");
  const flag = (v: unknown) => v === true || v === "true";
  return {
    sub: c.sub,
    email: typeof c.email === "string" ? c.email.toLowerCase() : null,
    emailVerified: flag(c.email_verified),
    privateEmail: flag(c.is_private_email),
  };
}

/** Name from Apple's first sign-in (the `user` form field), if any. */
export function appleName(userField: string | null | undefined): string | null {
  if (!userField) return null;
  try {
    const u = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string } };
    const n = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ").trim();
    return n ? n.slice(0, 80) : null;
  } catch {
    return null;
  }
}

/**
 * The INVTRA account for an Apple identity: the one already linked, else the account with
 * the same (Apple-verified) email, else a new account. Null when the account is deactivated.
 */
export async function accountForApple(id: AppleIdentity, name: string | null, locale: "en" | "ar") {
  const linked = await db.user.findUnique({ where: { appleSub: id.sub } });
  if (linked) return linked;
  if (id.email && id.emailVerified) {
    const byEmail = await db.user.findUnique({ where: { email: id.email } });
    if (byEmail) return db.user.update({ where: { id: byEmail.id }, data: { appleSub: id.sub } });
  }
  const email = id.email ?? `${id.sub.replace(/[^a-z0-9]/gi, "").slice(0, 40)}@apple.invtra.invalid`;
  return db.user.create({
    data: {
      email,
      name: name ?? (id.privateEmail || !id.email ? (locale === "ar" ? "ضيف إنفترا" : "INVTRA host") : id.email.split("@")[0]),
      passwordHash: "", // no password until they set one (Forgot password)
      appleSub: id.sub,
      locale,
    },
  });
}

export async function appleReady() {
  return Boolean(await signinConfig());
}
