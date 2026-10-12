import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { clientIp, ok, requireApiSession, route } from "@/server/http";
import { sendVerificationCode } from "@/server/auth/verification";

/** Email a new code (at most one a minute, with hourly and daily limits). */
export const POST = route("auth.verify-email.send", async (req: NextRequest) => {
  const session = await requireApiSession();
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  return ok({ code: await sendVerificationCode(user, clientIp(req)) });
});
