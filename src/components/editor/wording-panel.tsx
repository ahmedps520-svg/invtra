"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { PencilLine } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/i18n/provider";
import { fmt } from "@/lib/i18n/config";
import { copyFor } from "@/lib/invitation-copy";
import type { InvitationDesign } from "@/lib/design/schema";
import { monogramOf } from "@/lib/utils";
import { GroupLabel, Hint } from "./controls";
import { useEditor } from "./editor-context";

type TextKey = keyof InvitationDesign["texts"];
type Lang = "en" | "ar";
const FIELDS: { base: "eyebrow" | "intro" | "closing"; multiline: boolean }[] = [
  { base: "eyebrow", multiline: false },
  { base: "intro", multiline: true },
  { base: "closing", multiline: true },
];

function textKey(base: "eyebrow" | "intro" | "closing", lang: Lang): TextKey {
  return (lang === "ar" ? `${base}Ar` : base) as TextKey;
}

export function eventLangs(language: "EN" | "AR" | "BILINGUAL"): Lang[] {
  return language === "EN" ? ["en"] : language === "AR" ? ["ar"] : ["en", "ar"];
}

export function DetailsSummary() {
  const { dict } = useI18n();
  const t = dict.editor.wording;
  const { event, content } = useEditor();
  const langs = eventLangs(event.language);
  const both = (en: ReactNode, ar: ReactNode | null | undefined) => (
    <>
      {langs.includes("en") ? (
        <span className="block" dir="ltr" lang="en">
          {en}
        </span>
      ) : null}
      {langs.includes("ar") && ar ? (
        <span className="block font-arabic" dir="rtl" lang="ar">
          {ar}
        </span>
      ) : null}
    </>
  );
  const rows: { label: string; value: ReactNode }[] = [
    { label: t.names, value: both(content.hostNames, content.hostNamesAr || (event.language === "AR" ? content.hostNames : null)) },
    { label: t.date, value: both(content.date.en, content.date.ar) },
    { label: t.time, value: both(content.time.en, content.time.ar) },
    { label: t.venue, value: both(content.venueName, content.venueNameAr || (event.language === "AR" ? content.venueName : null)) },
  ];
  return (
    <div className="rounded-2xl border border-line bg-ivory/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{t.detailsTitle}</p>
          <p className="mt-0.5 text-[12px] text-ink-faint">{t.detailsHint}</p>
        </div>
        <Link href={`/dashboard/events/${event.id}/details`} className={buttonClasses("outline", "sm")}>
          <PencilLine className="size-3.5" />
          {t.editDetails}
        </Link>
      </div>
      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">{r.label}</dt>
            <dd className="mt-1 text-[14px] leading-relaxed text-ink [overflow-wrap:anywhere]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function WordingPanel() {
  const { dict } = useI18n();
  const t = dict.editor.wording;
  const { event, draft, setDesign } = useEditor();
  const langs = eventLangs(event.language);
  const monoId = useId();
  const uid = useId();
  const suggestion = monogramOf(event.language === "AR" ? event.hostNamesAr || event.hostNames : event.hostNames).slice(0, 8);
  const monogram = draft.design.monogram;
  const defaults = { en: copyFor(event.type, "en"), ar: copyFor(event.type, "ar") };
  const labels = { eyebrow: [t.eyebrow, t.eyebrowHint], intro: [t.intro, t.introHint], closing: [t.closing, t.closingHint] } as const;

  return (
    <div className="space-y-8">
      <DetailsSummary />

      {FIELDS.map(({ base, multiline }) => (
        <div key={base}>
          <GroupLabel htmlFor={`${uid}-${base}-${langs[0]}`} className="mb-1 text-[13px] font-medium normal-case tracking-normal text-ink-soft">
            {labels[base][0]}
          </GroupLabel>
          <p className="mb-2.5 text-[12px] text-ink-faint">{labels[base][1]}</p>
          <div className="space-y-2.5">
            {langs.map((lang) => {
              const key = textKey(base, lang);
              const value = draft.design.texts[key];
              const placeholder = defaults[lang][base];
              const id = `${uid}-${base}-${lang}`;
              const props = {
                id,
                value,
                placeholder,
                maxLength: 160,
                dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const),
                lang,
                "aria-label": langs.length > 1 ? `${labels[base][0]} — ${lang === "ar" ? t.arabic : t.english}` : undefined,
                onChange: (e: { target: { value: string } }) => setDesign({ texts: { [key]: e.target.value } }),
                className: langs.length > 1 ? "pe-12" : undefined,
              };
              return (
                <div key={lang} dir={props.dir}>
                  <div className="relative">
                    {multiline ? <Textarea rows={2} {...props} className={`${props.className ?? ""} min-h-[4.5rem]`} /> : <Input {...props} />}
                    {langs.length > 1 ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute end-3 top-3 rounded-full bg-sand px-1.5 py-0.5 text-[10px] font-medium text-ink-faint"
                      >
                        {lang === "ar" ? "ع" : "EN"}
                      </span>
                    ) : null}
                  </div>
                  {!value ? (
                    <button
                      type="button"
                      onClick={() => setDesign({ texts: { [key]: placeholder } })}
                      className="mt-1.5 text-[12px] font-medium text-bronze-700 underline-offset-4 hover:underline"
                    >
                      {t.restore}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <GroupLabel htmlFor={monoId} className="mb-1 text-[13px] font-medium normal-case tracking-normal text-ink-soft">
          {t.monogram}
        </GroupLabel>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Input
            id={monoId}
            value={monogram}
            maxLength={8}
            onChange={(e) => setDesign({ monogram: e.target.value })}
            aria-describedby={`${monoId}-hint`}
            className="w-36 text-center font-display text-xl"
            dir="auto"
          />
          {suggestion && suggestion !== monogram ? (
            <Button variant="outline" size="sm" onClick={() => setDesign({ monogram: suggestion })}>
              {fmt(t.useSuggestion, { value: suggestion })}
            </Button>
          ) : null}
          {monogram ? (
            <Button variant="ghost" size="sm" onClick={() => setDesign({ monogram: "" })}>
              {t.clear}
            </Button>
          ) : null}
        </div>
        <Hint id={`${monoId}-hint`}>{t.monogramHint}</Hint>
      </div>
    </div>
  );
}
