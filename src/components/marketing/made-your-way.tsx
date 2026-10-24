import Link from "next/link";
import { ArrowRight, Languages, Upload } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { buttonClasses } from "@/components/ui/button";
import { BilingualFlip } from "./bilingual-flip";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { UploadStamp } from "./upload-stamp";

/** Arabic & English as equals, and your own artwork — side by side (anchors: #bilingual, #upload). */
export function MadeYourWay({ dict, locale, uploadHref }: { dict: Dictionary; locale: Locale; uploadHref: string }) {
  const b = dict.marketing.bilingual;
  const d = dict.marketing.designsPage;
  const h = dict.marketing.home;
  return (
    <section aria-label={`${b.eyebrow} · ${d.ownTitle}`} className="relative py-20 sm:py-28">
      <div className={`${CONTAINER} grid gap-6 lg:grid-cols-2`}>
        <Reveal className="h-full">
          <article id="bilingual" data-section="" className="ivx-paper ivx-grain h-full scroll-mt-24 p-6 sm:p-9">
            <div className="relative">
              <p className={`${EYEBROW} flex items-center gap-2 text-gold-deep!`}>
                <Languages className="size-4" strokeWidth={1.4} />
                {b.eyebrow}
              </p>
              <h2 className="mt-4 font-display text-[2.1rem] leading-[1.1] text-balance text-ink sm:text-[2.6rem]">{b.title}</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-pretty text-ink-soft">{b.body}</p>
              <div className="mt-8">
                <BilingualFlip labels={h.bilingual.flips} label={h.bilingual.label} />
              </div>
            </div>
          </article>
        </Reveal>
        <Reveal delay={90} className="h-full">
          <article id="upload" data-section="" className="ivx-paper ivx-grain flex h-full scroll-mt-24 flex-col p-6 sm:p-9">
            <div className="relative flex flex-1 flex-col">
              <p className={`${EYEBROW} flex items-center gap-2 text-gold-deep!`}>
                <Upload className="size-4" strokeWidth={1.4} />
                {h.footer.uploadOwn}
              </p>
              <h2 className="mt-4 font-display text-[2.1rem] leading-[1.1] text-balance text-ink sm:text-[2.6rem]">{d.ownTitle}</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-pretty text-ink-soft">{d.ownBody}</p>
              <div className="mt-8 flex-1">
                <UploadStamp sample={d.ownSample} ar={locale === "ar"} labels={h.upload} />
              </div>
              <Link href={uploadHref} className={buttonClasses("outline", "lg", "group mt-8 self-start")}>
                {d.ownCta}
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}
