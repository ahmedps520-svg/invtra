import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { paging, type SearchParams, str } from "./params";

export async function listAudit(sp: SearchParams) {
  const action = str(sp, "action", 80) || undefined;
  const target = str(sp, "target", 80) || undefined;
  const actor = str(sp, "actor", 40) || undefined;
  const { page, pageSize, skip, take } = paging(sp, 40);
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(target ? { targetId: target } : {}),
    ...(actor ? { actorId: actor } : {}),
  };
  const [total, rows, actions] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => Boolean(x)))];
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : [];
  const byId = new Map(actors.map((a) => [a.id, a]));
  return {
    total,
    page,
    pageSize,
    rows: rows.map((r) => ({ ...r, actor: r.actorId ? (byId.get(r.actorId) ?? null) : null })),
    actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
  };
}

/** Where an audit target lives in the admin UI. */
export function targetHref(targetType: string, targetId: string): string | null {
  switch (targetType) {
    case "user":
      return `/admin/customers/${targetId}`;
    case "event":
      return `/admin/events/${targetId}`;
    case "order":
      return `/admin/payments?q=${targetId}`;
    case "template":
      return "/admin/templates";
    case "theme":
      return "/admin/themes";
    case "message":
      return "/admin/messages";
    case "error_log":
      return "/admin/errors?state=all";
    default:
      return null;
  }
}
