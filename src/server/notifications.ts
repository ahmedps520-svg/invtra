import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";

/**
 * In-app notifications: the bell in the dashboard. Each has a dedupe key, so retried jobs and
 * repeated clicks never show the same news twice. The text is written by the browser from the
 * kind and its data, in the reader's language.
 */

export type NotificationKind = "order.submitted" | "order.approved" | "order.in_production" | "order.delivered" | "order.rejected" | "order.info_required";

type Client = Prisma.TransactionClient | typeof db;

/** Adds a notification once. Returns false when one with the same key already exists. */
export async function notify(
  client: Client,
  input: { userId: string; kind: NotificationKind; href: string; dedupeKey: string; data?: Record<string, string | number | null> },
): Promise<boolean> {
  const r = await client.notification.createMany({
    data: [{ userId: input.userId, kind: input.kind, href: input.href, dedupeKey: input.dedupeKey, data: input.data ?? undefined }],
    skipDuplicates: true,
  });
  return r.count > 0;
}

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  data: Record<string, string | number | null>;
  href: string;
  read: boolean;
  createdAt: string;
};

export async function listNotifications(userId: string, limit = 20): Promise<{ items: NotificationView[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    unread,
    items: rows.map((n) => ({
      id: n.id,
      kind: n.kind as NotificationKind,
      data: (n.data ?? {}) as Record<string, string | number | null>,
      href: n.href,
      read: Boolean(n.readAt),
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

/** Marks some (or all) of the user's notifications read. */
export async function markNotificationsRead(userId: string, ids?: string[]) {
  await db.notification.updateMany({ where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
}
