import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { qrSvg } from "@/lib/qr";
import { buttonClasses } from "@/components/ui/button";

/**
 * "Bring your own artwork": a sample uploaded design with the guest's QR plate added the
 * way INVTRA composites it (white plate, centred near the bottom, short caption).
 */
export function OwnDesignTile({ dict, locale, href }: { dict: Dictionary; locale: "en" | "ar"; href: string }) {
  const t = dict.marketing.designsPage;
  const s = t.ownSample;
  const ar = locale === "ar";
  const qr = qrSvg({ text: "HTTPS://INVTRA.STORE/Q/7KM4WZ9R2T", size: 120, style: "rounded", logo: true, quietZone: 2 });

  return (
    <div className="grid h-full items-center gap-10 rounded-[1.5rem] border border-line bg-paper p-6 shadow-soft sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:gap-12 lg:p-10">
      {/* The guest's upload, framed like a drop zone */}
      <div className="rounded-[1.25rem] border border-dashed border-line-strong bg-ivory p-[9%]">
        <figure
          role="img"
          aria-label={s.label}
          className="@container relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-[4px] shadow-lift"
        >
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#4c5a47,#26302a_70%)]" />
          <div className="absolute inset-[5%] border border-[#c9a66b]/60" />
          <div className="absolute inset-[7%] border border-[#c9a66b]/30" />
          <div className="absolute inset-x-0 top-[14%] text-center text-[#efe6d2]">
            <svg viewBox="0 0 120 20" className="mx-auto h-[3cqw] w-auto text-[#c9a66b]" fill="none" aria-hidden="true">
              <path d="M0 10h48M72 10h48" stroke="currentColor" strokeWidth="0.8" />
              <path d="M60 3l7 7-7 7-7-7z" stroke="currentColor" strokeWidth="0.8" />
            </svg>
            <p
              className={
                ar
                  ? "mt-[6%] font-['Aref_Ruqaa'] text-[12cqw] leading-tight"
                  : "mt-[6%] font-['Pinyon_Script'] text-[12.5cqw] leading-tight"
              }
            >
              {s.names}
            </p>
            <p className="mt-[3cqw] font-display text-[3.4cqw] tracking-[0.3em] text-[#d9cdb4] uppercase">{s.line}</p>
            <p className="mt-[2.5cqw] font-display text-[3.4cqw] tracking-[0.25em] text-[#c9a66b]" dir="ltr">
              {s.date}
            </p>
          </div>
          {/* QR plate, as composited onto uploaded designs */}
          <div className="absolute bottom-[8%] start-1/2 w-[32%] -translate-x-1/2 rounded-[7%] bg-white/95 p-[2.2%] text-center rtl:translate-x-1/2">
            <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-[3%] truncate text-[1.75cqw] font-medium tracking-[0.06em] text-[#3a332c] uppercase">{s.caption}</p>
          </div>
        </figure>
      </div>

      <div>
        <span className="flex size-12 items-center justify-center rounded-full border border-line-strong bg-ivory text-bronze-600">
          <Upload className="size-5" strokeWidth={1.25} />
        </span>
        <h2 className="mt-6 font-display text-[2.1rem] leading-tight text-ink">{t.ownTitle}</h2>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-ink-soft">{t.ownBody}</p>
        <Link href={href} className={buttonClasses("outline", "lg", "group mt-8")}>
          {t.ownCta}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
