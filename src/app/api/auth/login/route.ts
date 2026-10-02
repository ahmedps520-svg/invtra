import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { clientIp, HttpError, ok, parseJson, route } from "@/server/http";
import { clearRateLimit, enforceRateLimit } from "@/server/security/rate-limit";
import { authLoginSchema } from "@/lib/validation/guest";

export const POST = route("auth.login", async (req: NextRequest) => {
  const ip = clientIp(req);
  await enforceRateLimit(`login:ip:${ip}`, 30, 600);
  const input = await parseJson(req, authLoginSchema);
  await enforceRateLimit(`login:email:${input.email}`, 8, 600);
  const user = await db.user.findUnique({ where: { email: input.email } });
  // Always run the hash so response time doesn't reveal whether the email exists.
  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) throw new HttpError(401, "invalid_credentials", "That email and password don't match.");
  if (user.status !== "ACTIVE") throw new HttpError(403, "account_deactivated", "This account has been deactivated. Contact support@invtra.store.");
  await clearRateLimit(`login:email:${input.email}`);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, req.headers.get("user-agent"));
  return ok({ user: { id: user.id, name: user.name, role: user.role } });
});
