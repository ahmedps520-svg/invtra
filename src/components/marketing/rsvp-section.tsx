import { Bell, Download, Eye, Radio } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { SendingMode } from "@/lib/marketing/links";
import { Reveal } from "./reveal";
import { RsvpLive } from "./rsvp-live";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

const POINT_ICONS = [Radio, Eye, Bell, Download];

/** Replies and the event dashboard, played live (anchor: #rsvp). */
export function RsvpSection({ dict, locale, mode }: { dict: Dictionary; locale: Locale; mode: SendingMode }) {
  const t = dict.marketing.rsvp;
  return (
    <section id="rsvp" aria-labelledby="rsvp-title" className="relative scroll-mt-20 overflow-clip py-16 sm:py-28">
      <div className={cn(CONTAINER, "grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-12 lg:gap-12")}>
        <div className="lg:col-span-5">
          <Reveal>
            <p className={EYEBROW}>{t.eyebrow}</p>
            <h2 id="rsvp-title" className="mt-4 font-display text-[2.4rem] leading-[1.08] text-balance text-ink sm:text-5xl">
              {t.title}
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-pretty text-ink-soft">{t.body}</p>
          </Reveal>
          <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-7 sm:gap-x-8">
            {t.points.map((p, i) => {
              const Icon = POINT_ICONS[i];
              return (
                <li key={p.title}>
                  <Reveal delay={i * 60}>
                    <Icon className="size-5 text-gold-deep" strokeWidth={1.35} />
                    <h3 className="mt-3 text-[15px] font-medium text-ink">{p.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft sm:text-[14px]">{p.body}</p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <RsvpLive vignette={t.vignette} copy={dict.marketing.home.rsvp} locale={locale} mode={mode} />
        </div>
      </div>
    </section>
  );
}
