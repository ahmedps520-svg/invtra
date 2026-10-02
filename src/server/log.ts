import { db } from "@/server/db";

/**
 * Structured error logging. Errors are written to stdout (for the hosting
 * platform's log drain) and to the ErrorLog table (visible in /admin/errors).
 */
export async function logError(source: string, err: unknown, context?: Record<string, unknown>, level: "error" | "warn" = "error") {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
  const line = JSON.stringify({ level, source, message: e.message, context, at: new Date().toISOString() });
  if (level === "error") console.error(line, e.stack ? `\n${e.stack}` : "");
  else console.warn(line);
  try {
    await db.errorLog.create({
      data: {
        level,
        source: source.slice(0, 120),
        message: e.message.slice(0, 2000),
        stack: e.stack?.slice(0, 8000),
        context: context ? JSON.parse(JSON.stringify(context)) : undefined,
      },
    });
  } catch {
    // Never let logging failures cascade.
  }
}

export async function audit(actorId: string | null, action: string, targetType: string, targetId: string, meta?: Record<string, unknown>) {
  await db.auditLog.create({
    data: { actorId, action, targetType, targetId, meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined },
  });
}
