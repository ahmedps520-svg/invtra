import { Check, Minus, X } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { CONTAINER } from "./styles";

type Mark = "yes" | "partly" | "no";
type Col = "paper" | "pdf" | "invtra";
const COLS: Col[] = ["paper", "pdf", "invtra"];

function MarkIcon({ mark, label }: { mark: Mark; label: string }) {
  const Icon = mark === "yes" ? Check : mark === "partly" ? Minus : X;
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full",
        mark === "yes" ? "bg-sage-soft text-sage" : mark === "partly" ? "bg-ochre-soft text-ochre" : "bg-rosewood-soft text-rosewood",
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
    </span>
  );
}

/** Printed cards vs a PDF in a WhatsApp group vs INVTRA — a fair comparison (anchor: #compare). */
export function Comparison({ dict }: { dict: Dictionary }) {
  const t = dict.marketing.home.compare;
  const rows = t.rows as { label: string; paper: { mark: Mark; text: string }; pdf: { mark: Mark; text: string }; invtra: { mark: Mark; text: string } }[];

  return (
    <section id="compare" aria-labelledby="compare-title" className="scroll-mt-20 py-16 sm:py-28">
      <div className={CONTAINER}>
        <SectionHeading eyebrow={t.eyebrow} title={<span id="compare-title">{t.title}</span>} body={t.body} />

        {/* One table: columns on larger screens; on phones each row stacks into a card. */}
        <table className="mt-12 w-full table-fixed border-separate border-spacing-0 text-start max-md:block md:mt-14">
          <caption className="sr-only">{t.title}</caption>
          <thead className="max-md:hidden">
            <tr>
              <td className="w-[24%]" />
              {COLS.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    "px-5 pb-4 pt-5 text-start align-bottom font-display text-[1.35rem] leading-tight font-normal",
                    c === "invtra" ? "rounded-t-[1.25rem] border-x border-t border-gold/50 bg-[#fffcf6] text-gold-deep" : "text-ink",
                  )}
                >
                  {t.columns[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:block max-md:space-y-3">
            {rows.map((r, i) => (
              <tr key={r.label} className="max-md:block max-md:rounded-[1.25rem] max-md:border max-md:border-hairline max-md:bg-[#fffcf6] max-md:p-4">
                <th
                  scope="row"
                  className="text-start align-top text-ink max-md:block max-md:pb-2 max-md:font-display max-md:text-[1.3rem] max-md:font-normal max-md:leading-tight md:border-t md:border-hairline md:py-4 md:pe-4 md:text-[14.5px] md:font-medium"
                >
                  {r.label}
                </th>
                {COLS.map((c) => (
                  <td
                    key={c}
                    className={cn(
                      "align-top max-md:mt-1.5 max-md:block max-md:rounded-xl max-md:px-3 max-md:py-2 md:border-t md:px-5 md:py-4",
                      c === "invtra" ? "max-md:bg-gold-soft/50 max-md:ring-1 max-md:ring-gold/40 md:border-x md:border-gold/50 md:border-t-hairline md:bg-[#fffcf6]" : "md:border-hairline",
                      c === "invtra" && i === rows.length - 1 && "md:rounded-b-[1.25rem] md:border-b",
                    )}
                  >
                    <span className="flex items-start gap-2.5">
                      <MarkIcon mark={r[c].mark} label={t.marks[r[c].mark]} />
                      <span className="min-w-0">
                        <span className={cn("block text-[12px] font-medium md:hidden", c === "invtra" ? "text-gold-deep" : "text-ink-faint")}>{t.columns[c]}</span>
                        <span className={cn("block text-[14px] leading-snug", c === "invtra" ? "text-ink" : "text-ink-soft max-md:text-ink")}>{r[c].text}</span>
                      </span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
