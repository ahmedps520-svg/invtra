import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { destroyAllSessions } from "@/server/auth/session";
import { HttpError, ok, parseJson, requireApiUser, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";

export const POST = route("account.password", async (req: NextRequest) => {
  const user = await requireApiUser();
  await enforceRateLimit(`password:${user.id}`, 5, 900);
  const input = await parseJson(req, z.object({ current: z.string().min(1).max(200), next: z.string().min(10, "Use at least 10 characters").max(200) }));
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(input.current, record.passwordHash))) {
    throw new HttpError(400, "wrong_password", "Your current password is incorrect.", { current: "Incorrect password" });
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.next) } });
  await destroyAllSessions(user.id, true); // sign out other devices
  return ok();
});
