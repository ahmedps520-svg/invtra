import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { walletConfig } from "./config";
import { buildWalletPass, checkWalletAuth, passLastModified } from "./wallet";

/**
 * Apple's PassKit web service (https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes):
 * iPhones register saved passes for updates, ask which ones changed, and download them again.
 */

const empty = (status: number) => new NextResponse(null, { status });

async function passFor(passType: string, serial: string) {
  const config = await walletConfig();
  if (!config || passType !== config.passTypeId) return null;
  const inv = await db.invitation.findUnique({ where: { id: serial }, include: { guest: true, event: true } });
  return inv ? { config, inv } : null;
}

/** POST …/devices/{device}/registrations/{passType}/{serial} — start sending updates to this device. */
export async function registerDevice(req: NextRequest, p: { device: string; passType: string; serial: string }) {
  if (!checkWalletAuth(req.headers.get("authorization"), p.serial)) return empty(401);
  if (!(await passFor(p.passType, p.serial))) return empty(404);
  const body = (await req.json().catch(() => null)) as { pushToken?: unknown } | null;
  const pushToken = typeof body?.pushToken === "string" ? body.pushToken.slice(0, 200) : null;
  if (!pushToken || !/^[A-Za-z0-9]+$/.test(pushToken) || p.device.length > 200) return empty(400);
  const key = { deviceLibraryId: p.device, passTypeId: p.passType, serialNumber: p.serial };
  const existing = await db.walletRegistration.findUnique({ where: { deviceLibraryId_passTypeId_serialNumber: key } });
  if (existing) {
    if (existing.pushToken !== pushToken) await db.walletRegistration.update({ where: { id: existing.id }, data: { pushToken } });
    return empty(200);
  }
  await db.walletRegistration.create({ data: { ...key, pushToken } });
  return empty(201);
}

/** DELETE …/devices/{device}/registrations/{passType}/{serial} — the pass was removed from Wallet. */
export async function unregisterDevice(req: NextRequest, p: { device: string; passType: string; serial: string }) {
  if (!checkWalletAuth(req.headers.get("authorization"), p.serial)) return empty(401);
  await db.walletRegistration.deleteMany({ where: { deviceLibraryId: p.device, passTypeId: p.passType, serialNumber: p.serial } });
  return empty(200);
}

/** GET …/devices/{device}/registrations/{passType}?passesUpdatedSince=tag — which of this device's passes changed. */
export async function changedPasses(req: NextRequest, p: { device: string; passType: string }) {
  const regs = await db.walletRegistration.findMany({ where: { deviceLibraryId: p.device, passTypeId: p.passType }, select: { serialNumber: true } });
  if (!regs.length) return empty(404);
  const since = Number(req.nextUrl.searchParams.get("passesUpdatedSince") ?? "");
  const invitations = await db.invitation.findMany({ where: { id: { in: regs.map((r) => r.serialNumber) } }, select: { id: true, walletUpdatedAt: true, createdAt: true } });
  const changed = invitations.filter((i) => !Number.isFinite(since) || since <= 0 || passLastModified(i).getTime() > since);
  if (!changed.length) return empty(204);
  const lastUpdated = Math.max(...invitations.map((i) => passLastModified(i).getTime()));
  return NextResponse.json({ serialNumbers: changed.map((i) => i.id), lastUpdated: String(lastUpdated) });
}

/** GET …/passes/{passType}/{serial} — the latest version of a pass. */
export async function latestPass(req: NextRequest, p: { passType: string; serial: string }) {
  if (!checkWalletAuth(req.headers.get("authorization"), p.serial)) return empty(401);
  const found = await passFor(p.passType, p.serial);
  if (!found) return empty(404);
  const modified = passLastModified(found.inv);
  const since = req.headers.get("if-modified-since");
  // HTTP dates have whole seconds.
  if (since && Math.floor(modified.getTime() / 1000) <= Math.floor(new Date(since).getTime() / 1000)) return empty(304);
  const pass = await buildWalletPass(found.inv, found.config);
  if (!pass) return empty(404);
  return new NextResponse(new Uint8Array(pass), {
    headers: { "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": modified.toUTCString(), "Cache-Control": "no-store" },
  });
}
