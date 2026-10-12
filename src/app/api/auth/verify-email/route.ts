import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { clientIp, ok, parseJson, requireApiSession, route } from "@/server/http";
import { codeStatus, confirmVerificationCode, verificationOf } from "@/server/auth/verification";

/** Where verification stands: whether a code is out, and when another can be sent. */
export const GET = route("auth.verify-email.status", async () => {
  const session = await requireApiSession();
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  return ok({ verification: verificationOf(user), code: await codeStatus(user) });
});

/** Check the 4-digit code from the email. */
export const POST = route("auth.verify-email", async (req: NextRequest) => {
  const session = await requireApiSession();
  const { code } = await parseJson(req, z.object({ code: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code") }));
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id }, select: { id: true, emailVerifiedAt: true } });
  return ok(await confirmVerificationCode(user, code, clientIp(req)));
});
