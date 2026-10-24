import { DoorOpen, Fingerprint, MailOpen, ScanLine } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { CheckinScan } from "./checkin-scan";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

const POINT_ICONS = [Fingerprint, MailOpen, ScanLine, DoorOpen];

/** One guest, one code — and the door check-in, played live (anchor: #qr). */
export function QrSection({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.marketing.qr;
  return (
    <section id="qr" aria-labelledby="qr-title" className="relative scroll-mt-20 overflow-clip border-t border-hairline/70 bg-[#fffcf6] py-16 sm:py-28">
      <div className={cn(CONTAINER, "grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-12 lg:gap-12")}>
        <div className="order-2 lg:order-1 lg:col-span-6">
          <CheckinScan locale={locale} copy={dict.marketing.home.checkin} />
        </div>
        <div className="order-1 lg:order-2 lg:col-span-5 lg:col-start-8">
          <Reveal>
            <p className={EYEBROW}>{t.eyebrow}</p>
            <h2 id="qr-title" className="mt-4 font-display text-[2.4rem] leading-[1.08] text-balance text-ink sm:text-5xl">
              {t.title}
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-pretty text-ink-soft">{t.body}</p>
          </Reveal>
          <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-7 sm:block sm:divide-y sm:divide-hairline sm:border-y sm:border-hairline">
            {t.points.map((p, i) => {
              const Icon = POINT_ICONS[i];
              return (
                <li key={p.title}>
                  <Reveal delay={i * 60} className="flex flex-col gap-3 sm:flex-row sm:gap-5 sm:py-5">
                    <Icon className="mt-0.5 size-5 shrink-0 text-gold-deep" strokeWidth={1.35} />
                    <div>
                      <h3 className="text-[15px] font-medium text-ink">{p.title}</h3>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft sm:text-[14px]">{p.body}</p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
