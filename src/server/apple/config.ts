import { createPrivateKey, generateKeyPairSync, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import forge from "node-forge";
import { badRequest } from "@/server/http";
import { getSettings, setSetting } from "@/server/settings";

/**
 * Apple Developer integrations, configured from Admin → Apple (no command line needed):
 *  - Apple Wallet: INVTRA creates a private key and a certificate signing request; the admin
 *    uploads the request to Apple (Pass Type ID certificate) and the .cer Apple returns.
 *  - Sign in with Apple: the Services ID, the key id and the .p8 key file.
 * Keys are stored encrypted (src/server/settings.ts).
 */

export const APPLE = {
  teamId: "apple.teamId",
  passTypeId: "apple.wallet.passTypeId",
  walletKey: "apple.wallet.key",
  walletCert: "apple.wallet.cert",
  walletPendingKey: "apple.wallet.pendingKey",
  walletCsr: "apple.wallet.csr",
  signinClientId: "apple.signin.clientId",
  signinKeyId: "apple.signin.keyId",
  signinKey: "apple.signin.key",
  domainAssociation: "apple.domainAssociation",
} as const;

const ALL = Object.values(APPLE);

export type CertInfo = { passTypeId: string | null; teamId: string | null; name: string | null; expiresAt: string; issuer: string | null };

/** What a Pass Type ID certificate says: UID = pass type id, OU = team id. */
export function describeCertificate(pem: string): CertInfo {
  const x = new X509Certificate(pem);
  const subject = parseDn(x.subject);
  const issuer = parseDn(x.issuer);
  return {
    passTypeId: subject.UID ?? null,
    teamId: subject.OU ?? null,
    name: subject.O ?? null,
    expiresAt: new Date(x.validTo).toISOString(),
    issuer: issuer.OU ?? null,
  };
}

function parseDn(dn: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of dn.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/** Apple's intermediate certificate that issued this one (bundled in assets/apple). */
export function wwdrFor(certPem: string): string {
  const generation = describeCertificate(certPem).issuer ?? "G4";
  const file = ["G3", "G4", "G6"].includes(generation) ? generation : "G4";
  return readFileSync(path.join(process.cwd(), "assets", "apple", `AppleWWDRCA${file}.pem`), "utf8");
}

export type WalletConfig = { teamId: string; passTypeId: string; certPem: string; keyPem: string; wwdrPem: string; expiresAt: string };

/** Everything needed to sign Wallet passes — null until set up in Admin → Apple. */
export async function walletConfig(): Promise<WalletConfig | null> {
  const s = await getSettings([APPLE.walletCert, APPLE.walletKey, APPLE.passTypeId, APPLE.teamId]);
  if (!s[APPLE.walletCert] || !s[APPLE.walletKey] || !s[APPLE.passTypeId] || !s[APPLE.teamId]) return null;
  const info = describeCertificate(s[APPLE.walletCert]!);
  if (new Date(info.expiresAt) < new Date()) return null;
  return {
    teamId: s[APPLE.teamId]!,
    passTypeId: s[APPLE.passTypeId]!,
    certPem: s[APPLE.walletCert]!,
    keyPem: s[APPLE.walletKey]!,
    wwdrPem: wwdrFor(s[APPLE.walletCert]!),
    expiresAt: info.expiresAt,
  };
}

export type SigninConfig = { teamId: string; clientId: string; keyId: string; privateKeyPem: string };

export async function signinConfig(): Promise<SigninConfig | null> {
  const s = await getSettings([APPLE.teamId, APPLE.signinClientId, APPLE.signinKeyId, APPLE.signinKey]);
  if (!s[APPLE.teamId] || !s[APPLE.signinClientId] || !s[APPLE.signinKeyId] || !s[APPLE.signinKey]) return null;
  return { teamId: s[APPLE.teamId]!, clientId: s[APPLE.signinClientId]!, keyId: s[APPLE.signinKeyId]!, privateKeyPem: s[APPLE.signinKey]! };
}

/** The setup page's view: what's configured (never the keys themselves). */
export async function appleStatus() {
  const s = await getSettings(ALL, { fresh: true });
  const cert = s[APPLE.walletCert] ? describeCertificate(s[APPLE.walletCert]!) : null;
  return {
    teamId: s[APPLE.teamId],
    wallet: {
      passTypeId: s[APPLE.passTypeId],
      certificate: cert,
      ready: Boolean(cert && s[APPLE.walletKey] && s[APPLE.passTypeId] && s[APPLE.teamId] && new Date(cert.expiresAt) > new Date()),
      csrPending: Boolean(s[APPLE.walletCsr] && s[APPLE.walletPendingKey]),
    },
    signin: {
      clientId: s[APPLE.signinClientId],
      keyId: s[APPLE.signinKeyId],
      hasKey: Boolean(s[APPLE.signinKey]),
      ready: Boolean(s[APPLE.teamId] && s[APPLE.signinClientId] && s[APPLE.signinKeyId] && s[APPLE.signinKey]),
    },
    domainAssociation: Boolean(s[APPLE.domainAssociation]),
  };
}

export type AppleStatus = Awaited<ReturnType<typeof appleStatus>>;

/** Step 1 (Wallet): a new private key and the certificate signing request for Apple. */
export async function createWalletCsr(email: string): Promise<string> {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const keyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" }).toString());
  csr.setSubject([
    { name: "commonName", value: "INVTRA Wallet" },
    { name: "emailAddress", value: email },
    { name: "countryName", value: "SA" },
  ]);
  csr.sign(forge.pki.privateKeyFromPem(keyPem), forge.md.sha256.create());
  const csrPem = forge.pki.certificationRequestToPem(csr);
  await setSetting(APPLE.walletPendingKey, keyPem, { secret: true });
  await setSetting(APPLE.walletCsr, csrPem);
  return csrPem;
}

export async function pendingCsr(): Promise<string | null> {
  return (await getSettings([APPLE.walletCsr], { fresh: true }))[APPLE.walletCsr];
}

/**
 * Step 2 (Wallet): the certificate Apple issued (.cer, DER or PEM) for our request — or a
 * .p12 exported from a Mac's Keychain (certificate + key, with its password).
 */
export async function installWalletCertificate(file: Buffer, p12Password?: string | null): Promise<CertInfo> {
  let certPem: string;
  let keyPem: string;
  const cert = asCertificatePem(file);
  if (!cert) {
    ({ certPem, keyPem } = readP12(file, p12Password ?? ""));
  } else {
    certPem = cert;
    const pending = (await getSettings([APPLE.walletPendingKey], { fresh: true }))[APPLE.walletPendingKey];
    if (!pending) throw badRequest("no_request", "Create a certificate request first, then upload the certificate Apple gives you for it.");
    keyPem = pending;
  }
  const x = new X509Certificate(certPem);
  if (!x.checkPrivateKey(createPrivateKey(keyPem))) {
    throw badRequest("key_mismatch", "This certificate wasn't made from INVTRA's latest request. Upload the certificate Apple created for the request you downloaded here.");
  }
  const info = describeCertificate(certPem);
  if (!info.passTypeId?.startsWith("pass.")) throw badRequest("not_pass_cert", "This isn't a Pass Type ID certificate. In Apple Developer, create the certificate under Identifiers → Pass Type IDs.");
  if (!info.teamId) throw badRequest("no_team", "The certificate doesn't name your Team ID.");
  if (new Date(info.expiresAt) < new Date()) throw badRequest("expired", "This certificate has expired.");
  await setSetting(APPLE.walletCert, certPem);
  await setSetting(APPLE.walletKey, keyPem, { secret: true });
  await setSetting(APPLE.passTypeId, info.passTypeId);
  await setSetting(APPLE.teamId, info.teamId);
  await setSetting(APPLE.walletPendingKey, null);
  await setSetting(APPLE.walletCsr, null);
  return info;
}

/** A certificate file (.cer DER, or PEM) as PEM — null when it's something else (e.g. a .p12). */
function asCertificatePem(file: Buffer): string | null {
  const text = file.toString("utf8");
  try {
    if (text.includes("-----BEGIN CERTIFICATE-----")) return new X509Certificate(text.slice(text.indexOf("-----BEGIN CERTIFICATE-----"))).toString();
    return new X509Certificate(file).toString();
  } catch {
    return null;
  }
}

function readP12(file: Buffer, password: string): { certPem: string; keyPem: string } {
  try {
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(file.toString("binary"))), password);
    const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ?? p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.find((b) => /pass\./.test(b.cert?.subject.getField("UID")?.value ?? ""));
    if (!keyBag?.key || !certBag?.cert) throw new Error("missing");
    return { certPem: forge.pki.certificateToPem(certBag.cert), keyPem: forge.pki.privateKeyToPem(keyBag.key) };
  } catch {
    throw badRequest("bad_p12", "Couldn't open this .p12 file — check the password, and that it contains the Pass Type ID certificate and its key.");
  }
}

/** Sign in with Apple: the Services ID, the key id and the .p8 private key. */
export async function installSigninKey(input: { teamId: string; clientId: string; keyId: string; p8?: string | null }) {
  if (!/^[A-Z0-9]{10}$/.test(input.teamId)) throw badRequest("team_id", "The Team ID is 10 letters and numbers (Apple Developer → Membership).", { teamId: "10 characters" });
  if (!/^[A-Za-z0-9.-]{3,100}$/.test(input.clientId)) throw badRequest("client_id", "Enter the Services ID, e.g. store.invtra.signin.", { clientId: "Services ID" });
  if (!/^[A-Z0-9]{10}$/.test(input.keyId)) throw badRequest("key_id", "The Key ID is 10 letters and numbers.", { keyId: "10 characters" });
  if (input.p8) {
    try {
      const key = createPrivateKey(input.p8);
      if (key.asymmetricKeyType !== "ec") throw new Error();
    } catch {
      throw badRequest("p8", "This isn't the .p8 key file Apple gave you for Sign in with Apple.", { p8: "Upload the .p8 file" });
    }
    await setSetting(APPLE.signinKey, input.p8.trim(), { secret: true });
  } else if (!(await getSettings([APPLE.signinKey]))[APPLE.signinKey]) {
    throw badRequest("p8", "Upload the .p8 key file.", { p8: "Upload the .p8 file" });
  }
  await setSetting(APPLE.teamId, input.teamId);
  await setSetting(APPLE.signinClientId, input.clientId);
  await setSetting(APPLE.signinKeyId, input.keyId);
}

export async function removeApple(part: "wallet" | "signin") {
  const keys = part === "wallet" ? [APPLE.walletCert, APPLE.walletKey, APPLE.passTypeId, APPLE.walletPendingKey, APPLE.walletCsr] : [APPLE.signinClientId, APPLE.signinKeyId, APPLE.signinKey];
  for (const k of keys) await setSetting(k, null);
}
