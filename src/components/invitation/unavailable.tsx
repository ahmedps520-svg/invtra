import { LogoMark } from "@/components/brand/logo";
import type { InvitationDict } from "./types";

/** Shown for deleted / deactivated / revoked invitations. Reveals nothing about the event. */
export function InvitationUnavailable({ dict, lang }: { dict: InvitationDict; lang: "en" | "ar" }) {
  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} className="flex min-h-dvh flex-col items-center justify-center bg-ivory px-6 text-center">
      <LogoMark className="h-12 opacity-70" />
      <h1 className="mt-10 font-display text-4xl text-ink">{dict.unavailable.title}</h1>
      <p className="mt-4 max-w-sm text-ink-faint">{dict.unavailable.body}</p>
    </main>
  );
}
