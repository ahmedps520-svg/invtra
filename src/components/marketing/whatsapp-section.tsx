import type { ReactNode } from "react";
import { BadgeCheck, CornerUpLeft, Hand, MessageCircleReply, SquareArrowOutUpRight, Smartphone } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { CardPreview } from "@/components/invitation/card-preview";
import { Reveal } from "./reveal";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";

const POINT_ICONS = [BadgeCheck, Hand, Smartphone, MessageCircleReply];

/** Official WhatsApp delivery with Accept / Decline, and what happens on each branch. */
export function WhatsAppSection({ dict, locale }: { dict: Dictionary; locale: "en" | "ar" }) {
  const t = dict.marketing.whatsapp;
  const il = t.illustration;
  const ar = locale === "ar";

  return (
    <section aria-labelledby="whatsapp-title" className="relative overflow-hidden bg-paper">
      <div className={cn(CONTAINER, "grid items-center gap-16 py-24 sm:py-32 lg:grid-cols-12 lg:gap-12")}>
        <div className="lg:col-span-5">
          <Reveal>
            <p className={EYEBROW}>{t.eyebrow}</p>
            <h2 id="whatsapp-title" className="mt-4 font-display text-[2.5rem] leading-[1.08] text-balance text-ink sm:text-5xl">
              {t.title}
            </h2>
            <p className="mt-6 text-[17px] leading-relaxed text-pretty text-ink-soft">{t.body}</p>
          </Reveal>
          <ul className="mt-12 grid gap-x-8 gap-y-9 sm:grid-cols-2">
            {t.points.map((p, i) => {
              const Icon = POINT_ICONS[i];
              return (
                <li key={p.title}>
                  <Reveal delay={i * 60}>
                    <Icon className="size-5 text-bronze-600" strokeWidth={1.25} />
                    <h3 className="mt-4 text-[15px] font-medium text-ink">{p.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink-faint">{p.body}</p>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Illustration: one message, two graceful outcomes */}
        <Reveal className="lg:col-span-7 lg:col-start-6">
          <figure
            aria-hidden="true"
            className="relative mx-auto max-w-xl rounded-[2rem] border border-line bg-[#efe9df] p-5 shadow-soft sm:p-8"
            style={{
              backgroundImage: "radial-gradient(rgb(132 102 74 / 0.08) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          >
            {/* Invitation message */}
            <div className="mx-auto max-w-[19rem]">
              <div className="flex gap-3 rounded-xl rounded-ss-sm bg-white p-2.5 shadow-[0_1px_1px_rgb(0_0_0/0.08)]">
                <div className="w-16 shrink-0 overflow-hidden rounded-md">
                  <CardPreview lazy
                    themeKey={ar ? "arabic" : "romantic"}
                    language={ar ? "AR" : "EN"}
                    guest={null}
                    qrPlaceholder={false}
                    title=""
                  />
                </div>
                <p className="self-center text-[12.5px] leading-snug text-[#111b21]">{il.message}</p>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <WaButton tone="accept">{il.accept}</WaButton>
                <WaButton>{il.decline}</WaButton>
              </div>
            </div>

            {/* Branch lines */}
            <svg
              viewBox="0 0 400 64"
              preserveAspectRatio="none"
              className="mx-auto block h-12 w-[62%] text-bronze-300 sm:h-16"
              fill="none"
            >
              <path
                d="M200 0V22C200 30 192 32 184 32H108C100 32 100 40 100 48V64"
                stroke="currentColor"
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M200 22C200 30 208 32 216 32H292C300 32 300 40 300 48V64"
                stroke="currentColor"
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <div className="grid grid-cols-2 gap-3 sm:gap-6">
              {/* Accept branch (start side) */}
              <div>
                <p className="mb-2.5 text-center text-[11px] font-medium tracking-[0.16em] text-sage uppercase">{il.ifAccept}</p>
                <div className="rounded-xl rounded-ss-sm bg-white p-1.5 shadow-[0_1px_1px_rgb(0_0_0/0.08)]">
                  <div className="overflow-hidden rounded-md">
                    <CardPreview lazy themeKey={ar ? "arabic" : "romantic"} language={ar ? "AR" : "EN"} qrPlaceholder title="" />
                  </div>
                  <p className="px-1 pb-1 pt-2 text-[11.5px] leading-snug text-[#111b21]">{il.acceptReply}</p>
                  <div className="mt-1 flex items-center justify-center gap-1.5 border-t border-black/[0.06] py-2 text-[11.5px] font-medium text-[#00866e]">
                    <SquareArrowOutUpRight className="size-3 rtl:-scale-x-100" strokeWidth={2} />
                    {il.view}
                  </div>
                </div>
              </div>

              {/* Decline branch (end side) */}
              <div>
                <p className="mb-2.5 text-center text-[11px] font-medium tracking-[0.16em] text-rosewood uppercase">
                  {il.ifDecline}
                </p>
                <div className="rounded-xl rounded-ss-sm bg-white px-3 py-2.5 shadow-[0_1px_1px_rgb(0_0_0/0.08)]">
                  <p className="text-[12px] leading-snug text-[#111b21]">{il.declineReply}</p>
                </div>
                <p className="mt-4 flex items-center justify-center gap-2 text-[11.5px] text-ink-faint">
                  <span className="h-px w-5 bg-line-strong" />
                  {il.noQr}
                  <span className="h-px w-5 bg-line-strong" />
                </p>
              </div>
            </div>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

function WaButton({ children, tone }: { children: ReactNode; tone?: "accept" }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-[12px] font-medium text-[#00866e] shadow-[0_1px_1px_rgb(0_0_0/0.08)]",
        tone === "accept" && "ring-1 ring-sage/30",
      )}
    >
      <CornerUpLeft className="size-3 rtl:-scale-x-100" strokeWidth={2} />
      {children}
    </span>
  );
}
