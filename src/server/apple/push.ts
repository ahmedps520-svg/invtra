import { connect, constants } from "node:http2";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue/queue";
import { logError } from "@/server/log";
import { walletConfig } from "./config";

/**
 * Keeping saved Wallet passes current. When something on a pass changes (time, venue,
 * section, check-in, a cancelled invitation), the invitations are marked updated and the
 * iPhones that saved them get an (empty) push from Apple's servers; Wallet then downloads
 * the new pass from our web service (src/app/api/wallet/v1).
 */

type Target = { eventId: string } | { guestIds: string[] };

/** Mark passes changed and queue the push — a no-op when nobody saved them to Wallet. */
export async function walletChanged(target: Target) {
  try {
    const invitations = await db.invitation.findMany({
      where: "eventId" in target ? { eventId: target.eventId } : { guestId: { in: target.guestIds } },
      select: { id: true },
    });
    if (!invitations.length) return;
    const ids = invitations.map((i) => i.id);
    const registered = await db.walletRegistration.findMany({ where: { serialNumber: { in: ids } }, select: { serialNumber: true }, distinct: ["serialNumber"] });
    if (!registered.length) return;
    const serials = registered.map((r) => r.serialNumber);
    await db.invitation.updateMany({ where: { id: { in: serials } }, data: { walletUpdatedAt: new Date() } });
    // A few seconds' delay groups quick successive changes into one push.
    const bucket = Math.floor(Date.now() / 5000);
    await enqueue("wallet.push", { serials }, { delayMs: 5000, maxAttempts: 4, dedupeKey: `wallet:${"eventId" in target ? target.eventId : serials.join(",").slice(0, 120)}:${bucket}` });
  } catch (e) {
    await logError("wallet:changed", e, { target });
  }
}

/** Queue job: push to every device registered for these passes. */
export async function pushWalletUpdates(serials: string[]) {
  const config = await walletConfig();
  if (!config) return { sent: 0 };
  const regs = await db.walletRegistration.findMany({ where: { serialNumber: { in: serials }, passTypeId: config.passTypeId } });
  const tokens = [...new Set(regs.map((r) => r.pushToken))];
  if (!tokens.length) return { sent: 0 };
  const session = connect(process.env.APNS_HOST ?? "https://api.push.apple.com", { cert: config.certPem, key: config.keyPem });
  let sent = 0;
  try {
    for (const token of tokens) {
      const status = await new Promise<number>((resolve, reject) => {
        const req = session.request({
          [constants.HTTP2_HEADER_METHOD]: "POST",
          [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
          "apns-topic": config.passTypeId,
          "content-type": "application/json",
        });
        req.setTimeout(10_000, () => req.close(constants.NGHTTP2_CANCEL));
        req.on("response", (h) => resolve(Number(h[constants.HTTP2_HEADER_STATUS])));
        req.on("error", reject);
        req.end("{}");
      });
      if (status === 200) sent++;
      else if (status === 410 || status === 400) {
        // The device removed the pass or the token is no longer valid.
        await db.walletRegistration.deleteMany({ where: { pushToken: token } });
      } else {
        await logError("wallet:push", new Error(`APNs responded ${status}`), { token: token.slice(0, 8) }, "warn");
      }
    }
  } finally {
    session.close();
  }
  return { sent };
}
