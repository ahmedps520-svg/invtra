import Link from "next/link";
import { getI18n } from "@/server/i18n";
import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export default async function NotFound() {
  const { dict } = await getI18n();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="h-14 opacity-80" />
      <p className="eyebrow mt-10">404</p>
      <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{dict.common.notFound.title}</h1>
      <p className="mt-4 max-w-md text-ink-faint">{dict.common.notFound.body}</p>
      <Link href="/" className={buttonClasses("primary", "md", "mt-8")}>
        {dict.common.notFound.home}
      </Link>
    </main>
  );
}
