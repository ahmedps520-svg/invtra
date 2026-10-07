import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignupForm } from "@/components/auth/signup-form";
import { safeNext, withNext } from "@/components/auth/next-path";
import { AppleSignInButton } from "@/components/auth/apple-button";
import { appleReady } from "@/server/apple/signin";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.meta.signup, alternates: { canonical: "/signup" } };
}

const DEFAULT_NEXT = "/dashboard/events/new";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, DEFAULT_NEXT);
  if (await getSessionUser()) redirect(next);

  const { dict } = await getI18n();
  const t = dict.auth.signup;
  const loginHref = withNext("/login", next, "/dashboard");

  return (
    <>
      <AuthHeading title={t.title} subtitle={t.subtitle} />
      <div className="mt-10">
        {(await appleReady()) ? (
          <AppleSignInButton
            href={`/api/auth/apple/start?next=${encodeURIComponent(next)}`}
            label={dict.auth.apple.continue}
            or={dict.auth.apple.or}
            error={sp.error === "apple" ? dict.auth.apple.failed : sp.error === "deactivated" ? dict.auth.apple.deactivated : null}
          />
        ) : null}
        <SignupForm next={next} loginHref={loginHref} />
      </div>
      <p className="mt-10 border-t border-line pt-6 text-center text-[14px] text-ink-faint">
        {t.haveAccount}{" "}
        <Link href={loginHref} className="font-medium text-bronze-700 underline-offset-4 hover:text-bronze-800 hover:underline">
          {t.signIn}
        </Link>
      </p>
    </>
  );
}
