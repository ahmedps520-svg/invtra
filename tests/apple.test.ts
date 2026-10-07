/**
 * Apple Developer integrations: settings encryption, the Wallet certificate setup, Wallet
 * passes and their update web service (+ APNs pushes), and Sign in with Apple.
 */
import { createSecureServer, type Http2SecureServer } from "node:http2";
import { generateKeyPairSync, createPublicKey, randomBytes, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import JSZip from "jszip";
import forge from "node-forge";
import { db } from "@/server/db";
import { THEMES } from "@/lib/themes/registry";
import { clearSettingsCache, decryptSecret, getSetting, setSetting } from "@/server/settings";
import { APPLE, appleStatus, createWalletCsr, installSigninKey, installWalletCertificate, signinConfig, walletConfig } from "@/server/apple/config";
import { walletAuthToken } from "@/server/apple/wallet";
import { pushWalletUpdates, walletChanged } from "@/server/apple/push";
import { appleClientSecret } from "@/server/apple/signin";
import { ensureInvitation } from "@/server/invitations";
import { respond } from "@/server/rsvp";

vi.mock("@/server/auth/session", async (orig) => ({ ...(await orig<object>()), createSession: vi.fn(async () => undefined) }));

const run = randomBytes(5).toString("hex");
const userIds: string[] = [];
const PASS_TYPE = `pass.store.invtra.test${run}`;

afterAll(async () => {
  for (const k of Object.values(APPLE)) await setSetting(k, null);
  await db.walletRegistration.deleteMany({ where: { passTypeId: PASS_TYPE } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

/** Stand-in for Apple signing our request: a CA (subject OU G4, like Apple's WWDR) issues a Pass Type ID certificate. */
function issuePassCert(csrPem: string, opts: { uid?: string | null; otherKey?: boolean } = {}) {
  const caKeys = forge.pki.rsa.generateKeyPair(2048);
  const ca = forge.pki.createCertificate();
  ca.publicKey = caKeys.publicKey;
  ca.serialNumber = "01";
  ca.validity.notBefore = new Date(Date.now() - 86_400_000);
  ca.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const caSubject = [{ name: "commonName", value: "Test WWDR" }, { shortName: "OU", value: "G4" }, { name: "organizationName", value: "Test" }];
  ca.setSubject(caSubject);
  ca.setIssuer(caSubject);
  ca.sign(caKeys.privateKey, forge.md.sha256.create());
  const csr = forge.pki.certificationRequestFromPem(csrPem);
  const cert = forge.pki.createCertificate();
  cert.publicKey = opts.otherKey ? forge.pki.rsa.generateKeyPair(2048).publicKey : csr.publicKey!;
  cert.serialNumber = "02";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  cert.setSubject([
    ...(opts.uid === null ? [] : [{ type: "0.9.2342.19200300.100.1.1", value: opts.uid ?? PASS_TYPE }]),
    { name: "commonName", value: `Pass Type ID: ${opts.uid ?? PASS_TYPE}` },
    { shortName: "OU", value: "ABCDE12345" },
    { name: "organizationName", value: "INVTRA Test" },
    { name: "countryName", value: "SA" },
  ]);
  cert.setIssuer(caSubject);
  cert.sign(caKeys.privateKey, forge.md.sha256.create());
  return Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary");
}

async function guestWithInvitation(opts: { rsvp?: "ACCEPTED" | "PENDING"; section?: "WOMEN" } = {}) {
  const user = await db.user.create({ data: { email: `apple-${run}-${userIds.length}@example.test`, name: "Apple Host", passwordHash: "x" } });
  userIds.push(user.id);
  const event = await db.event.create({
    data: {
      userId: user.id,
      title: 'Ahmed & Sara "Wedding"',
      titleAr: "زفاف أحمد وسارة",
      hostNames: "Ahmed & Sara",
      language: "BILINGUAL",
      timezone: "Asia/Riyadh",
      startsAt: new Date(Date.now() + 20 * 86_400_000),
      venueName: "Riyadh Front",
      venueNameAr: "واجهة الرياض",
      address: "Airport Rd",
      themeKey: "minimal",
      design: THEMES.minimal.defaults as object,
      plan: "BASIC",
      guestLimit: 100,
      sectionsEnabled: Boolean(opts.section),
      sections: opts.section ? { MEN: {}, WOMEN: { venueName: "Ladies Hall", venueNameAr: "قاعة السيدات" } } : undefined,
    },
  });
  const guest = await db.guest.create({
    data: { eventId: event.id, name: "Noura", phone: `+9665${String(Date.now()).slice(-8)}`, rsvpStatus: opts.rsvp ?? "ACCEPTED", attendingCount: 2, allowedCount: 3, section: opts.section },
  });
  const inv = await ensureInvitation(guest);
  return { user, event, guest, inv };
}

describe("settings", () => {
  it("stores secrets encrypted and reads them back", async () => {
    await setSetting(`test.secret.${run}`, "-----BEGIN PRIVATE KEY-----abc", { secret: true });
    const row = await db.setting.findUniqueOrThrow({ where: { key: `test.secret.${run}` } });
    expect(row.value.startsWith("enc:v1:")).toBe(true);
    expect(row.value).not.toContain("PRIVATE KEY");
    clearSettingsCache();
    expect(await getSetting(`test.secret.${run}`)).toBe("-----BEGIN PRIVATE KEY-----abc");
    expect(decryptSecret(row.value)).toBe("-----BEGIN PRIVATE KEY-----abc");
    await setSetting(`test.secret.${run}`, null);
    expect(await getSetting(`test.secret.${run}`)).toBeNull();
  });
});

describe("Apple Wallet", () => {
  beforeAll(async () => {
    expect(await walletConfig()).toBeNull();
    const csr = await createWalletCsr("admin@invtra.store");
    expect(csr).toContain("BEGIN CERTIFICATE REQUEST");
    expect(forge.pki.certificationRequestFromPem(csr).verify()).toBe(true);
    // Wrong certificates are refused…
    await expect(installWalletCertificate(issuePassCert(csr, { otherKey: true }))).rejects.toMatchObject({ code: "key_mismatch" });
    await expect(installWalletCertificate(issuePassCert(csr, { uid: null }))).rejects.toMatchObject({ code: "not_pass_cert" });
    await expect(installWalletCertificate(Buffer.from("hello"))).rejects.toMatchObject({ code: "bad_p12" });
    // …the right one sets everything up (pass type and team come from the certificate).
    const info = await installWalletCertificate(issuePassCert(csr));
    expect(info).toMatchObject({ passTypeId: PASS_TYPE, teamId: "ABCDE12345" });
    const status = await appleStatus();
    expect(status.wallet).toMatchObject({ ready: true, csrPending: false, passTypeId: PASS_TYPE });
    expect(status.teamId).toBe("ABCDE12345");
  });

  it("gives accepted guests a signed pass with their section, in English and Arabic", async () => {
    const { inv, guest } = await guestWithInvitation({ section: "WOMEN" });
    const { GET } = await import("@/app/i/[token]/wallet/route");
    const res = await GET(new NextRequest(`https://invtra.store/i/${inv.token}/wallet`, { headers: { "x-forwarded-for": `10.88.${run.length}.1` } }), { params: Promise.resolve({ token: inv.token }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.apple.pkpass");
    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
    expect(Object.keys(zip.files).sort()).toEqual(
      ["ar.lproj/", "ar.lproj/pass.strings", "icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png", "manifest.json", "pass.json", "signature"].filter((f) => zip.files[f]).sort(),
    );
    const pass = JSON.parse(await zip.file("pass.json")!.async("string"));
    expect(pass).toMatchObject({ passTypeIdentifier: PASS_TYPE, teamIdentifier: "ABCDE12345", serialNumber: inv.id, voided: false, sharingProhibited: true });
    expect(pass.barcodes[0]).toMatchObject({ format: "PKBarcodeFormatQR", message: expect.stringMatching(new RegExp(`/Q/${inv.token}$`)) });
    expect(pass.eventTicket.secondaryFields).toEqual(expect.arrayContaining([expect.objectContaining({ key: "guest", value: "Noura" }), expect.objectContaining({ key: "people", value: "2" })]));
    expect(pass.eventTicket.auxiliaryFields).toEqual(expect.arrayContaining([expect.objectContaining({ key: "venue", value: "Ladies Hall" }), expect.objectContaining({ key: "section", value: "Women's section" })]));
    const strings = await zip.file("ar.lproj/pass.strings")!.async("string");
    expect(strings).toContain('"Ahmed & Sara \\"Wedding\\"" = "زفاف أحمد وسارة";');
    expect(strings).toContain('"Ladies Hall" = "قاعة السيدات";');
    expect((await zip.file("signature")!.async("nodebuffer")).length).toBeGreaterThan(1000);

    // Not for guests who haven't accepted.
    await db.guest.update({ where: { id: guest.id }, data: { rsvpStatus: "PENDING" } });
    const pending = await GET(new NextRequest(`https://invtra.store/i/${inv.token}/wallet`, { headers: { "x-forwarded-for": `10.88.${run.length}.1` } }), { params: Promise.resolve({ token: inv.token }) });
    expect(pending.status).toBe(404);
  });

  it("serves updates to registered iPhones and voids the pass when the guest declines", async () => {
    const { inv, guest } = await guestWithInvitation();
    const reg = await import("@/app/api/wallet/v1/devices/[device]/registrations/[passType]/[serial]/route");
    const list = await import("@/app/api/wallet/v1/devices/[device]/registrations/[passType]/route");
    const latest = await import("@/app/api/wallet/v1/passes/[passType]/[serial]/route");
    const device = `dev${run}`;
    const params = { device, passType: PASS_TYPE, serial: inv.id };
    const call = (method: string, auth?: string, body?: object) =>
      new NextRequest(`https://invtra.store/api/wallet/v1/devices/${device}/registrations/${PASS_TYPE}/${inv.id}`, {
        method,
        headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    expect((await reg.POST(call("POST", "ApplePass wrong", { pushToken: "abc123" }), { params: Promise.resolve(params) })).status).toBe(401);
    const auth = `ApplePass ${walletAuthToken(inv.id)}`;
    expect((await reg.POST(call("POST", auth, { pushToken: "abc123" }), { params: Promise.resolve(params) })).status).toBe(201);
    expect((await reg.POST(call("POST", auth, { pushToken: "abc123" }), { params: Promise.resolve(params) })).status).toBe(200);

    const listReq = (since?: string) => new NextRequest(`https://invtra.store/api/wallet/v1/devices/${device}/registrations/${PASS_TYPE}${since ? `?passesUpdatedSince=${since}` : ""}`);
    const first = await list.GET(listReq(), { params: Promise.resolve({ device, passType: PASS_TYPE }) });
    const body = await first.json();
    expect(body.serialNumbers).toEqual([inv.id]);
    expect((await list.GET(listReq(body.lastUpdated), { params: Promise.resolve({ device, passType: PASS_TYPE }) })).status).toBe(204);

    // The guest declines → the pass is marked changed, a push is queued, and the new pass is void.
    await new Promise((r) => setTimeout(r, 5));
    await respond({ guestId: guest.id, response: "DECLINED", source: "WEB" });
    const updated = await db.invitation.findUniqueOrThrow({ where: { id: inv.id } });
    expect(updated.walletUpdatedAt).toBeInstanceOf(Date);
    expect(await db.job.count({ where: { type: "wallet.push", status: "PENDING", payload: { path: ["serials"], array_contains: [inv.id] } } })).toBe(1);
    const changed = await list.GET(listReq(body.lastUpdated), { params: Promise.resolve({ device, passType: PASS_TYPE }) });
    expect((await changed.json()).serialNumbers).toEqual([inv.id]);

    const passReq = (h: Record<string, string> = {}) => new NextRequest(`https://invtra.store/api/wallet/v1/passes/${PASS_TYPE}/${inv.id}`, { headers: { authorization: auth, ...h } });
    const fresh = await latest.GET(passReq(), { params: Promise.resolve({ passType: PASS_TYPE, serial: inv.id }) });
    expect(fresh.status).toBe(200);
    const zip = await JSZip.loadAsync(Buffer.from(await fresh.arrayBuffer()));
    expect(JSON.parse(await zip.file("pass.json")!.async("string")).voided).toBe(true);
    const notModified = await latest.GET(passReq({ "if-modified-since": fresh.headers.get("last-modified")! }), { params: Promise.resolve({ passType: PASS_TYPE, serial: inv.id }) });
    expect(notModified.status).toBe(304);
    expect((await latest.GET(new NextRequest(`https://invtra.store/api/wallet/v1/passes/${PASS_TYPE}/${inv.id}`), { params: Promise.resolve({ passType: PASS_TYPE, serial: inv.id }) })).status).toBe(401);

    expect((await reg.DELETE(call("DELETE", auth), { params: Promise.resolve(params) })).status).toBe(200);
    expect(await db.walletRegistration.count({ where: { serialNumber: inv.id } })).toBe(0);
    await db.job.deleteMany({ where: { type: "wallet.push", payload: { path: ["serials"], array_contains: [inv.id] } } });
  });

  it("pushes to Apple and forgets devices that removed the pass", async () => {
    const { inv } = await guestWithInvitation();
    await db.walletRegistration.createMany({
      data: [
        { deviceLibraryId: `a${run}`, pushToken: "tokenok", passTypeId: PASS_TYPE, serialNumber: inv.id },
        { deviceLibraryId: `b${run}`, pushToken: "tokengone", passTypeId: PASS_TYPE, serialNumber: inv.id },
      ],
    });
    // A stand-in for APNs (HTTP/2 over TLS) that records what it receives.
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "03";
    cert.validity.notBefore = new Date(Date.now() - 86_400_000);
    cert.validity.notAfter = new Date(Date.now() + 86_400_000);
    cert.setSubject([{ name: "commonName", value: "localhost" }]);
    cert.setIssuer([{ name: "commonName", value: "localhost" }]);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const seen: { path: string; topic: string; body: string }[] = [];
    const server: Http2SecureServer = createSecureServer({ key: forge.pki.privateKeyToPem(keys.privateKey), cert: forge.pki.certificateToPem(cert) }, (req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ path: req.url, topic: String(req.headers["apns-topic"]), body });
        res.statusCode = req.url.endsWith("tokengone") ? 410 : 200;
        res.end();
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const prev = { host: process.env.APNS_HOST, tls: process.env.NODE_TLS_REJECT_UNAUTHORIZED };
    process.env.APNS_HOST = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    try {
      expect(await pushWalletUpdates([inv.id])).toEqual({ sent: 1 });
    } finally {
      process.env.APNS_HOST = prev.host;
      if (prev.tls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev.tls;
      server.close();
    }
    expect(seen.map((s) => [s.path, s.topic, s.body]).sort()).toEqual([
      ["/3/device/tokengone", PASS_TYPE, "{}"],
      ["/3/device/tokenok", PASS_TYPE, "{}"],
    ]);
    expect((await db.walletRegistration.findMany({ where: { serialNumber: inv.id } })).map((r) => r.pushToken)).toEqual(["tokenok"]);
    // Nothing to do (and no job) for passes nobody saved.
    const other = await guestWithInvitation();
    await walletChanged({ guestIds: [other.guest.id] });
    expect((await db.invitation.findUniqueOrThrow({ where: { id: other.inv.id } })).walletUpdatedAt).toBeNull();
  });
});

describe("Sign in with Apple", () => {
  const { privateKey: ecKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const p8 = ecKey.export({ type: "pkcs8", format: "pem" }).toString();
  const { privateKey: rsaKey, publicKey: rsaPub } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...rsaPub.export({ format: "jwk" }), kid: `kid${run}`, alg: "RS256", use: "sig" };
  let identity: Record<string, unknown> = {};
  const realFetch = globalThis.fetch;

  const idToken = (nonce: string) => {
    const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const p = Buffer.from(JSON.stringify({ iss: "https://appleid.apple.com", aud: "store.invtra.signin", iat: now, exp: now + 600, nonce, ...identity })).toString("base64url");
    return `${h}.${p}.${cryptoSign("RSA-SHA256", Buffer.from(`${h}.${p}`), rsaKey).toString("base64url")}`;
  };

  beforeAll(async () => {
    await expect(installSigninKey({ teamId: "bad", clientId: "store.invtra.signin", keyId: "KEY1234567", p8 })).rejects.toMatchObject({ code: "team_id" });
    await expect(installSigninKey({ teamId: "ABCDE12345", clientId: "store.invtra.signin", keyId: "KEY1234567", p8: "nope" })).rejects.toMatchObject({ code: "p8" });
    await installSigninKey({ teamId: "ABCDE12345", clientId: "store.invtra.signin", keyId: "KEY1234567", p8 });
    expect(await signinConfig()).toMatchObject({ clientId: "store.invtra.signin", keyId: "KEY1234567" });
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  it("signs the client secret with the .p8 key (ES256)", async () => {
    const jwt = appleClientSecret((await signinConfig())!);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toMatchObject({ iss: "ABCDE12345", sub: "store.invtra.signin", aud: "https://appleid.apple.com" });
    expect(cryptoVerify("sha256", Buffer.from(`${h}.${p}`), { key: createPublicKey(ecKey), dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);
  });

  it("creates the account on first sign-in, links existing accounts, and refuses a bad state", async () => {
    const { GET: start } = await import("@/app/api/auth/apple/start/route");
    const { POST: callback } = await import("@/app/api/auth/apple/callback/route");
    const ip = { "x-forwarded-for": `10.99.${run.length}.7` };
    let nonce = "";
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/auth/keys")) return Response.json({ keys: [jwk] });
      if (u.endsWith("/auth/token")) return Response.json({ id_token: idToken(nonce) });
      throw new Error(`unexpected fetch ${u}`);
    }) as typeof fetch;

    async function signIn(user?: object, tamper = false) {
      const s = await start(new NextRequest("https://invtra.store/api/auth/apple/start?next=%2Fdashboard%2Fevents%2Fnew", { headers: ip }));
      expect(s.status).toBe(303);
      const to = new URL(s.headers.get("location")!);
      expect(to.origin + to.pathname).toBe("https://appleid.apple.com/auth/authorize");
      expect(to.searchParams.get("response_mode")).toBe("form_post");
      nonce = to.searchParams.get("nonce")!;
      const cookie = s.cookies.get("invtra_apple")!;
      expect(cookie).toMatchObject({ sameSite: "none", secure: true, httpOnly: true });
      const form = new URLSearchParams({ state: tamper ? "forged" : to.searchParams.get("state")!, code: "c0de" });
      if (user) form.set("user", JSON.stringify(user));
      return callback(
        new NextRequest("https://invtra.store/api/auth/apple/callback", {
          method: "POST",
          body: form,
          headers: { ...ip, "content-type": "application/x-www-form-urlencoded", cookie: `invtra_apple=${cookie.value}` },
        }),
      );
    }

    const sub = `001234.${run}.0001`;
    identity = { sub, email: `relay-${run}@privaterelay.appleid.com`, email_verified: "true", is_private_email: "true" };
    const first = await signIn({ name: { firstName: "Sara", lastName: "Al Mansoori" } });
    expect(first.status).toBe(303);
    expect(new URL(first.headers.get("location")!).pathname).toBe("/dashboard/events/new");
    const created = await db.user.findUniqueOrThrow({ where: { appleSub: sub } });
    userIds.push(created.id);
    expect(created).toMatchObject({ name: "Sara Al Mansoori", email: `relay-${run}@privaterelay.appleid.com`, passwordHash: "" });

    // Signing in again finds the same account.
    await signIn();
    expect(await db.user.count({ where: { appleSub: sub } })).toBe(1);

    // An existing email account is linked rather than duplicated.
    const existing = await db.user.create({ data: { email: `host-${run}@example.test`, name: "Existing", passwordHash: "x" } });
    userIds.push(existing.id);
    identity = { sub: `002222.${run}.0002`, email: `host-${run}@example.test`, email_verified: true };
    await signIn();
    expect((await db.user.findUniqueOrThrow({ where: { id: existing.id } })).appleSub).toBe(`002222.${run}.0002`);

    // A forged state goes nowhere.
    const forged = await signIn(undefined, true);
    expect(forged.headers.get("location")).toContain("/login?error=apple");

    // Deactivated accounts can't sign in.
    await db.user.update({ where: { id: existing.id }, data: { status: "DEACTIVATED" } });
    expect((await signIn()).headers.get("location")).toContain("/login?error=deactivated");
  });
});
