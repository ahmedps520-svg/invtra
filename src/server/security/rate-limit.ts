import { db } from "@/server/db";
import { tooManyRequests } from "@/server/http";

/**
 * Fixed-window rate limiting stored in Postgres, so limits hold across every
 * app instance and the worker without extra infrastructure.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0]!;
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await rateLimit(key, limit, windowSeconds);
  if (!r.ok) throw tooManyRequests();
}

export async function clearRateLimit(key: string) {
  await db.rateLimitBucket.deleteMany({ where: { key } });
}

export async function purgeExpiredRateLimits() {
  await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
