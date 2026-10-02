import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { clientIp, ok, parseJson, route } from "@/server/http";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { generateSecretToken, sha256 } from "@/server/security/tokens";
import { emailLayout, sendEmail } from "@/server/email";

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
    const ar = user.locale === "ar";
    await sendEmail({
      to: user.email,
      subject: ar ? "إعادة تعيين كلمة المرور — إنفترا" : "Reset your INVTRA password",
      text: ar
        ? `مرحبًا ${user.name}،\n\nلإعادة تعيين كلمة المرور افتح الرابط التالي (صالح لمدة ساعة):\n${link}\n\nإذا لم تطلب ذلك، تجاهل هذه الرسالة.`
        : `Hi ${user.name},\n\nReset your password using the link below (valid for one hour):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
      html: emailLayout(
        ar ? "إعادة تعيين كلمة المرور" : "Reset your password",
        ar
          ? `<p dir="rtl">مرحبًا ${user.name}،</p><p dir="rtl"><a href="${link}" style="color:#84664a">اضغط هنا لإعادة تعيين كلمة المرور</a> (صالح لمدة ساعة).</p>`
          : `<p>Hi ${user.name},</p><p><a href="${link}" style="color:#84664a">Choose a new password</a>. The link is valid for one hour.</p><p>If you didn't ask for this, you can ignore this email.</p>`,
      ),
    });
  }
  return ok();
});
