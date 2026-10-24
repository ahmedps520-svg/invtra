import type { Dictionary } from "@/lib/i18n";
import type { SendingMode } from "@/lib/marketing/links";
import { cn } from "@/lib/utils";
import { CONTAINER } from "./styles";

/** Only facts that are true of the product today — no invented numbers, reviews or logos. */
export function ProofStrip({ dict, mode }: { dict: Dictionary; mode: SendingMode }) {
  const p = dict.marketing.home.proof;
  const facts = [p.designs, p.occasions, p.test[mode], p.noApp, p.purge];
  return (
    <section aria-label={p.label} className="relative border-y border-hairline/70 bg-[#fffcf6]">
      <div className={CONTAINER}>
        <ul className="grid grid-cols-2 gap-px bg-hairline/70 sm:grid-cols-3 lg:grid-cols-5">
          {facts.map((f, i) => (
            <li key={f.label} className={cn("flex flex-col justify-center gap-1.5 bg-[#fffcf6] px-4 py-6 sm:px-6 sm:py-8", i === facts.length - 1 && "max-sm:col-span-2")}>
              <span className="font-display text-[1.9rem] leading-none text-ink sm:text-[2.2rem]">{f.value}</span>
              <span className="text-[13px] leading-snug text-ink-soft">{f.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
