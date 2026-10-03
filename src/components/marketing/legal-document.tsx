import type { Dictionary } from "@/lib/i18n";
import type { LegalSection } from "@/lib/i18n/dictionaries/en/marketing";
import { CONTAINER, EYEBROW } from "./styles";
import { cn } from "@/lib/utils";
import type { CompanyDetails } from "@/server/legal";

const CONTACT_EMAIL = "contact@invtra.store";

/** Turns plain-text mentions of the contact address into mail links. */
function withEmailLinks(text: string) {
  const parts = text.split(CONTACT_EMAIL);
  if (parts.length === 1) return text;
  return parts.flatMap((p, i) =>
    i === 0
      ? [p]
      : [
          <a
            key={i}
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-bronze-700 underline decoration-bronze-300 underline-offset-4 hover:decoration-bronze-600"
          >
            {CONTACT_EMAIL}
          </a>,
          p,
        ],
  );
}

/** Long-form legal page: title block, sticky table of contents, readable measure. */
export function LegalDocument({
  dict,
  doc,
  company,
}: {
  dict: Dictionary;
  doc: { title: string; intro: string[]; sections: LegalSection[] };
  /** The registered business (LEGAL_* settings), shown under the introduction when set. */
  company?: CompanyDetails | null;
}) {
  const l = dict.marketing.legal;
  const [before, after] = l.questions.split("{email}");

  return (
    <article className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,var(--color-sand),transparent)]"
      />
      <div className={cn(CONTAINER, "relative pb-24 pt-16 sm:pb-32 sm:pt-24")}>
        <header className="max-w-3xl">
          <p className={EYEBROW}>{l.eyebrow}</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] text-ink sm:text-6xl">{doc.title}</h1>
          <p className="mt-5 text-[13px] text-ink-faint">
            {l.updatedLabel}: <time>{l.updated}</time>
          </p>
        </header>

        <div className="hairline mt-12" />

        <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-10">
          <nav aria-labelledby="toc-title" className="lg:col-span-3">
            <div className="lg:sticky lg:top-28">
              <p id="toc-title" className={EYEBROW}>
                {l.contents}
              </p>
              <ol className="mt-5 space-y-2.5 border-s border-line ps-5">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-[14px] leading-snug text-ink-soft transition-colors hover:text-bronze-700"
                    >
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <div className="max-w-[68ch] lg:col-span-8 lg:col-start-5">
            {doc.intro.map((p) => (
              <p key={p} className="mb-6 font-display text-[1.45rem] leading-[1.55] text-ink">
                {p}
              </p>
            ))}

            {company ? (
              <dl className="mb-4 grid gap-x-6 gap-y-2 rounded-2xl border border-line bg-paper px-6 py-5 text-[14.5px] sm:grid-cols-[auto_1fr]">
                {company.name ? (
                  <>
                    <dt className="text-ink-faint">{dict.common.footer.operatedBy}</dt>
                    <dd className="text-ink">{company.name}</dd>
                  </>
                ) : null}
                {company.cr ? (
                  <>
                    <dt className="text-ink-faint">{dict.common.footer.cr}</dt>
                    <dd className="text-ink tabular-nums">{company.cr}</dd>
                  </>
                ) : null}
                {company.vat ? (
                  <>
                    <dt className="text-ink-faint">{dict.common.footer.vat}</dt>
                    <dd className="text-ink tabular-nums">{company.vat}</dd>
                  </>
                ) : null}
                {company.address ? (
                  <>
                    <dt className="sr-only">Address</dt>
                    <dd className="text-ink-soft sm:col-span-2">{company.address}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}

            {doc.sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-h`}
                className="scroll-mt-28 border-t border-line pt-10 mt-10"
              >
                <h2 id={`${s.id}-h`} className="flex items-baseline gap-4 font-display text-[1.9rem] leading-tight text-ink">
                  <span className="font-sans text-[12px] font-medium tabular-nums text-bronze-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.heading}
                </h2>
                {s.body.map((p) => (
                  <p key={p} className="mt-4 text-[16.5px] leading-[1.8] text-ink-soft">
                    {withEmailLinks(p)}
                  </p>
                ))}
                {s.list?.length ? (
                  <ul className="mt-5 space-y-3">
                    {s.list.map((item) => (
                      <li key={item} className="relative ps-6 text-[16.5px] leading-[1.75] text-ink-soft">
                        <span aria-hidden="true" className="absolute start-0 top-[0.8em] h-px w-3 bg-bronze-400" />
                        {withEmailLinks(item)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {s.after?.map((p) => (
                  <p key={p} className="mt-5 text-[16.5px] leading-[1.8] text-ink-soft">
                    {withEmailLinks(p)}
                  </p>
                ))}
              </section>
            ))}

            <p className="mt-14 rounded-2xl border border-line bg-paper px-6 py-5 text-[15px] leading-relaxed text-ink-soft">
              {before}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-bronze-700 underline decoration-bronze-300 underline-offset-4 hover:decoration-bronze-600"
              >
                {CONTACT_EMAIL}
              </a>
              {after}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
