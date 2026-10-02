import { db } from "@/server/db";
import { storage } from "@/server/storage";
import { logError } from "@/server/log";

/** Events are soft-deleted; their data and files are permanently removed after 30 days. */
export const EVENT_RETENTION_DAYS = 30;

export async function purgeDeletedEvents() {
  const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 86_400_000);
  const events = await db.event.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true, userId: true }, take: 50 });
  for (const e of events) {
    try {
      await storage().deletePrefix(`renders/${e.id}/`);
      const uploads = await db.upload.findMany({ where: { eventId: e.id }, select: { key: true } });
      for (const u of uploads) await storage().delete(u.key).catch(() => undefined);
      await db.upload.deleteMany({ where: { eventId: e.id } });
      await db.job.deleteMany({ where: { eventId: e.id } });
      await db.event.delete({ where: { id: e.id } });
    } catch (err) {
      await logError("maintenance:purge-event", err, { eventId: e.id });
    }
  }
}
