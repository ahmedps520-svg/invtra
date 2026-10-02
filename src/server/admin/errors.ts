import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/log";
import { paging, type SearchParams, oneOf, str } from "./params";

export const ERROR_STATES = ["unresolved", "resolved", "all"] as const;

function whereFor(f: { source?: string; level?: string; state?: (typeof ERROR_STATES)[number]; q?: string }): Prisma.ErrorLogWhereInput {
  return {
    ...(f.source ? { source: f.source } : {}),
    ...(f.level ? { level: f.level } : {}),
    ...(f.state === "resolved" ? { resolvedAt: { not: null } } : f.state === "all" ? {} : { resolvedAt: null }),
    ...(f.q ? { message: { contains: f.q, mode: "insensitive" } } : {}),
  };
}

export async function listErrors(sp: SearchParams) {
  const source = str(sp, "source", 120) || undefined;
  const level = oneOf(sp, "level", ["error", "warn"] as const);
  const state = oneOf(sp, "state", ERROR_STATES) ?? "unresolved";
  const q = str(sp, "q", 200) || undefined;
  const { page, pageSize, skip, take } = paging(sp, 30);
  const where = whereFor({ source, level, state, q });
  const [total, rows, sources, unresolved] = await Promise.all([
    db.errorLog.count({ where }),
    db.errorLog.findMany({ where, orderBy: [{ resolvedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }], skip, take }),
    db.errorLog.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { source: "asc" } }),
    db.errorLog.count({ where: { resolvedAt: null } }),
  ]);
  return { total, page, pageSize, rows, sources: sources.map((s) => ({ source: s.source, count: s._count._all })), unresolved, filter: { source, level, state, q } };
}

/** Mark errors resolved (or reopen them): by id, or everything matching a filter. */
export async function resolveErrors(
  actorId: string,
  input: { ids?: string[]; match?: { source?: string; level?: string; q?: string }; resolved: boolean },
) {
  const where: Prisma.ErrorLogWhereInput = input.ids
    ? { id: { in: input.ids } }
    : whereFor({ ...(input.match ?? {}), state: input.resolved ? "unresolved" : "resolved" });
  const r = await db.errorLog.updateMany({ where, data: { resolvedAt: input.resolved ? new Date() : null } });
  await audit(actorId, input.resolved ? "admin.errors.resolve" : "admin.errors.reopen", "error_log", input.ids?.length === 1 ? input.ids[0] : "bulk", {
    count: r.count,
    ...(input.ids ? { ids: input.ids.slice(0, 50) } : { match: input.match ?? {} }),
  });
  return r.count;
}
