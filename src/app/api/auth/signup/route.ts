import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { clientIp, conflict, ok, parseJson, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { authSignupSchema } from "@/lib/validation/guest";
import { getLocale } from "@/server/i18n";
import { newAccountDeadline } from "@/lib/auth/verification";
import { SOURCE_COOKIE, cleanSource } from "@/lib/attribution";

export const POST = route("auth.signup", async (req: NextRequest) => {
  await enforceRateLimit(`signup:${clientIp(req)}`, 5, 600);
  const input = await parseJson(req, authSignupSchema);
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict("email_taken", "An account with this email already exists. Try signing in.");
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      locale: await getLocale(),
      verifyBy: newAccountDeadline(), // five days to verify the email (the code is sent from /verify-email)
      source: cleanSource(req.cookies.get(SOURCE_COOKIE)?.value),
    },
  });
  await createSession(user.id, req.headers.get("user-agent"));
  return ok({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
});
