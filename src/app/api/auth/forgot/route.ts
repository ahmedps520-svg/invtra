import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { clientIp, ok, parseJson, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { generateSecretToken, sha256 } from "@/server/security/tokens";
import { sendEmail } from "@/server/email";
import { renderEmail, renderEmailText } from "@/server/email-template";
import { passwordResetEmail } from "@/server/emails";

/** Always answers the same way so it can't be used to discover registered emails. */
export const POST = route("auth.forgot", async (req: NextRequest) => {
  await enforceRateLimit(`forgot:ip:${clientIp(req)}`, 5, 3600);
  const { email } = await parseJson(req, z.object({ email: z.string().trim().toLowerCase().email().max(160) }));
  await enforceRateLimit(`forgot:email:${email}`, 3, 3600);
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE") {
    const token = generateSecretToken();
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = appUrl(`/reset-password?token=${token}`);
    const mail = passwordResetEmail({ name: user.name, locale: user.locale, link });
    await sendEmail({ to: user.email, subject: mail.subject, text: renderEmailText(mail), html: renderEmail(mail) });
  }
  return ok();
});
