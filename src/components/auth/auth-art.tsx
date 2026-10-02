import { CardPreview } from "@/components/invitation/card-preview";
import { LogoMark } from "@/components/brand/logo";
import type { Dictionary } from "@/lib/i18n";

/** Desktop art panel beside the auth forms: printed invitations on dark linen. */
export function AuthArt({ dict, locale }: { dict: Dictionary; locale: "en" | "ar" }) {
  const t = dict.auth.art;
  const ar = locale === "ar";
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#1c1815] text-ivory">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-1/4 start-1/4 size-[46rem] rounded-full bg-[radial-gradient(closest-side,rgb(169_132_78/0.28),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.035)_1px,transparent_1px)] [background-size:4px_4px]" />
      </div>

      <div aria-hidden="true" className="relative flex flex-1 items-center justify-center px-12 pt-16">
        <div className="relative w-[min(19rem,52%)]">
          <div className="absolute inset-0 translate-x-[34%] translate-y-[6%] rotate-[8deg] opacity-80 rtl:-translate-x-[34%] rtl:-rotate-[8deg]">
            <div className="overflow-hidden rounded-[5px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] ring-1 ring-white/10">
              <CardPreview themeKey={ar ? "bilingual" : "romantic"} language={ar ? "BILINGUAL" : "EN"} qrPlaceholder title="" />
            </div>
          </div>
          <div className="relative -rotate-[3deg] rtl:rotate-[3deg]">
            <div className="overflow-hidden rounded-[5px] shadow-[0_50px_90px_-30px_rgb(0_0_0/0.85)] ring-1 ring-white/10">
              <CardPreview themeKey={ar ? "arabic" : "minimal"} language={ar ? "AR" : "EN"} qrPlaceholder title="" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative px-12 pb-14 pt-10 xl:px-16">
        <LogoMark className="h-9 text-bronze-300" title="" />
        <p className="mt-6 max-w-md font-display text-[2.4rem] leading-[1.1] text-ivory">{t.quote}</p>
        <p className="mt-3 max-w-sm text-[14.5px] leading-relaxed text-[#b9afa2]">{t.caption}</p>
      </div>
    </div>
  );
}
