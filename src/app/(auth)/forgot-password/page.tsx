import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getI18n } from "@/server/i18n";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotForm } from "@/components/auth/forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.meta.forgot };
}

export default async function ForgotPasswordPage() {
  const { dict } = await getI18n();
  const t = dict.auth.forgot;
  return (
    <>
      <AuthHeading title={t.title} subtitle={t.subtitle} />
      <div className="mt-10">
        <ForgotForm />
      </div>
      <p className="mt-10 border-t border-line pt-6 text-center text-[14px]">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-ink-soft transition-colors hover:text-ink">
          <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.75} />
          {t.backToLogin}
        </Link>
      </p>
    </>
  );
}
