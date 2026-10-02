import type { Metadata } from "next";
import { getI18n } from "@/server/i18n";
import { AuthHeading } from "@/components/auth/auth-heading";
import { InvalidResetLink, ResetForm } from "@/components/auth/reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.meta.reset, robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  // Reset tokens are base64url secrets; anything else can't be valid.
  const token = raw && /^[A-Za-z0-9_-]{20,200}$/.test(raw) ? raw : null;
  const { dict } = await getI18n();
  const t = dict.auth.reset;

  return (
    <>
      <AuthHeading title={t.title} subtitle={token ? t.subtitle : undefined} />
      <div className="mt-10">{token ? <ResetForm token={token} /> : <InvalidResetLink missing />}</div>
    </>
  );
}
