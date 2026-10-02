import { DoorOpen, Fingerprint, MailOpen, ScanLine } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { qrSvg } from "@/lib/qr";
import { LogoMark } from "@/components/brand/logo";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

const POINT_ICONS = [Fingerprint, MailOpen, ScanLine, DoorOpen];
/** Example tokens in the real invitation-token alphabet: every guest has a different code. */
const TOKENS = ["8F3K92QXHT", "N7RW4TKD2M", "Q5HZ8XCB3P"];

function qr(token: string, size: number) {
  return qrSvg({ text: `HTTPS://INVTRA.STORE/Q/${token}`, size, style: "rounded", logo: true, fg: "#1e1a16", bg: "#fffdfa" });
}

export function QrSection({ dict }: { dict: Dictionary }) {
  const t = dict.marketing.qr;
  const c = t.card;
  const guests = [c.guest, ...c.others];

  return (
    <section aria-labelledby="qr-title" className="relative overflow-hidden">
      <div className={cn(CONTAINER, "grid items-center gap-16 py-24 sm:py-32 lg:grid-cols-12 lg:gap-12")}>
        <Reveal className="order-2 lg:order-1 lg:col-span-6">
          <div aria-hidden="true" className="relative mx-auto flex max-w-[30rem] justify-center pt-16 sm:pt-20">
            {/* Two more guests' passes behind — each with its own code */}
            {[1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "absolute top-0 w-[56%] max-w-[15rem] rounded-2xl border border-line bg-[#fbf8f3] p-4 shadow-soft sm:p-5",
                  i === 1 ? "start-[1%] -rotate-[9deg] rtl:rotate-[9deg]" : "end-[1%] rotate-[8deg] text-end rtl:-rotate-[8deg]",
                )}
              >
                <p className="truncate font-display text-lg text-ink-soft">{guests[i]}</p>
                <div
                  className="mt-3 opacity-[0.28] [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qr(TOKENS[i], 160) }}
                />
                <p className="mt-2 text-center font-mono text-[10px] tracking-[0.3em] text-ink-faint" dir="ltr">
                  {TOKENS[i]}
                </p>
              </div>
            ))}

            {/* The guest's personal pass */}
            <div className="relative w-[74%] max-w-[19rem] rounded-[1.75rem] border border-line bg-paper shadow-lift">
              <div className="px-6 pb-6 pt-6 sm:px-7">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10.5px] font-medium tracking-[0.22em] text-bronze-600 uppercase rtl:text-[12px]">
                    {c.label}
                  </span>
                  <LogoMark className="h-6" title="" />
                </div>
                <p className="mt-4 font-display text-[1.7rem] leading-tight text-ink">{c.guest}</p>
                <p className="mt-1 text-[13px] text-ink-faint">{c.admits}</p>
                <div className="relative mt-5 p-3">
                  {/* scan-frame corners, after the INVTRA mark */}
                  {[
                    "start-0 top-0 border-s border-t rounded-ss-lg",
                    "end-0 top-0 border-e border-t rounded-se-lg",
                    "bottom-0 start-0 border-b border-s rounded-es-lg",
                    "bottom-0 end-0 border-b border-e rounded-ee-lg",
                  ].map((pos) => (
                    <span key={pos} className={cn("absolute size-5 border-bronze-400", pos)} />
                  ))}
                  <div
                    className="[&>svg]:h-auto [&>svg]:w-full"
                    role="img"
                    aria-label={c.qrLabel}
                    dangerouslySetInnerHTML={{ __html: qr(TOKENS[0], 240) }}
                  />
                </div>
                <p className="mt-3 text-center font-mono text-[11px] tracking-[0.32em] text-ink-faint" dir="ltr">
                  {TOKENS[0]}
                </p>
              </div>
              {/* perforation */}
              <div className="relative flex items-center">
                <span className="absolute -start-3 size-6 rounded-full border border-line bg-ivory [clip-path:inset(0_0_0_50%)] rtl:[clip-path:inset(0_50%_0_0)]" />
                <span className="mx-5 h-px flex-1 border-t border-dashed border-line-strong" />
                <span className="absolute -end-3 size-6 rounded-full border border-line bg-ivory [clip-path:inset(0_50%_0_0)] rtl:[clip-path:inset(0_0_0_50%)]" />
              </div>
              <p className="flex items-center justify-center gap-2 px-6 py-4 text-[12.5px] text-ink-soft">
                <ScanLine className="size-4 text-bronze-500" strokeWidth={1.5} />
                {c.scan}
              </p>
            </div>
          </div>
        </Reveal>

        <div className="order-1 lg:order-2 lg:col-span-5 lg:col-start-8">
          <Reveal>
            <p className={EYEBROW}>{t.eyebrow}</p>
            <h2 id="qr-title" className="mt-4 font-display text-[2.5rem] leading-[1.08] text-balance text-ink sm:text-5xl">
              {t.title}
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-pretty text-ink-soft">{t.body}</p>
          </Reveal>
          <ul className="mt-10 divide-y divide-line border-y border-line">
            {t.points.map((p, i) => {
              const Icon = POINT_ICONS[i];
              return (
                <li key={p.title}>
                  <Reveal delay={i * 60} className="flex gap-5 py-5">
                    <Icon className="mt-0.5 size-5 shrink-0 text-bronze-600" strokeWidth={1.25} />
                    <div>
                      <h3 className="text-[15px] font-medium text-ink">{p.title}</h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-faint">{p.body}</p>
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
