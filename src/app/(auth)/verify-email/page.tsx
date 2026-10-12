import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { codeStatus, verificationOf } from "@/server/auth/verification";
import { safeNext } from "@/components/auth/next-path";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.meta.verify, robots: { index: false, follow: false } };
}

/** Enter the 4-digit code sent to the account's email (or put it off, while there's time). */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/dashboard");
  const session = await getSessionUser();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/verify-email?next=${encodeURIComponent(next)}`)}`);
  const user = await db.user.findUniqueOrThrow({ where: { id: session.id } });
  const verification = verificationOf(user);
  if (verification.verified) redirect(next);
  return <VerifyEmailForm next={next} verification={verification} code={await codeStatus(user)} />;
}
