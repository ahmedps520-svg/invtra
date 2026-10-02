import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { createSession, destroyAllSessions } from "@/server/auth/session";
import { badRequest, clientIp, ok, parseJson, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { sha256 } from "@/server/security/tokens";

export const POST = route("auth.reset", async (req: NextRequest) => {
  await enforceRateLimit(`reset:ip:${clientIp(req)}`, 10, 3600);
  const { token, password } = await parseJson(
    req,
    z.object({ token: z.string().min(20).max(200), password: z.string().min(10, "Use at least 10 characters").max(200) }),
  );
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest("invalid_token", "This reset link has expired. Please request a new one.");
  }
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  await destroyAllSessions(record.userId);
  await createSession(record.userId, req.headers.get("user-agent"));
  return ok();
});
