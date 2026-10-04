"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/components/i18n/provider";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/toggle";
import { fmt } from "@/lib/i18n/config";
import { formatWallTime } from "@/lib/format";
import { SECTION_KEYS, SECTION_LABELS, type SectionDetails, type SectionKey } from "@/lib/sections";
import { cn } from "@/lib/utils";

export type SectionField = keyof SectionDetails;
/** Form values: every field as text ("" = use the event's own value). */
export type SectionRows = Record<SectionKey, Record<SectionField, string>>;

export const SECTION_FIELDS: SectionField[] = ["time", "venueName", "venueNameAr", "address", "addressAr", "mapsUrl", "note", "noteAr"];

export function emptySectionRows(): SectionRows {
  const one = () => Object.fromEntries(SECTION_FIELDS.map((k) => [k, ""])) as Record<SectionField, string>;
  return { MEN: one(), WOMEN: one() };
}

export function sectionRowsFrom(sections: Partial<Record<SectionKey, Partial<SectionDetails>>> | null | undefined): SectionRows {
  const rows = emptySectionRows();
  for (const key of SECTION_KEYS) for (const f of SECTION_FIELDS) rows[key][f] = (sections?.[key]?.[f] ?? "") as string;
  return rows;
}

/** Men's and women's sections on the event form: a switch, then each section's own time and place. */
export function SectionsEditor({
  enabled,
  onToggle,
  rows,
  onChange,
  language,
  eventTime,
  errors,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  rows: SectionRows;
  onChange: (rows: SectionRows) => void;
  language: "EN" | "AR" | "BILINGUAL";
  eventTime: string;
  errors: Record<string, string>;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.form;
  const t = d.split;
  const showEn = language !== "AR";
  const showAr = language !== "EN";
  const both = showEn && showAr;

  const set = (key: SectionKey, field: SectionField, value: string) => onChange({ ...rows, [key]: { ...rows[key], [field]: value } });
  const err = (key: SectionKey, field: SectionField) => errors[`sections.${key}.${field}`];

  const text = (key: SectionKey, field: SectionField, label: string, placeholder: string | undefined, ar = false) => {
    const id = `ev-sec-${key}-${field}`;
    return (
      <Field id={id} label={label} optional={d.optional} error={err(key, field)}>
        <Input
          id={id}
          value={rows[key][field]}
          onChange={(e) => set(key, field, e.target.value)}
          aria-invalid={Boolean(err(key, field))}
          dir={ar ? "rtl" : "auto"}
          lang={ar ? "ar" : undefined}
          placeholder={placeholder}
        />
      </Field>
    );
  };

  /** One field per invitation language (Arabic-only events edit the Arabic field). */
  const pair = (key: SectionKey, en: SectionField, ar: SectionField, labels: { single: string; en: string; ar: string }, ph?: { en?: string; ar?: string }) =>
    both ? (
      <div className="grid gap-4 sm:grid-cols-2">
        {text(key, en, labels.en, ph?.en ?? t.sameAsEvent)}
        {text(key, ar, labels.ar, ph?.ar ?? t.sameAsEvent, true)}
      </div>
    ) : showAr ? (
      text(key, ar, labels.single, ph?.ar ?? t.sameAsEvent, true)
    ) : (
      text(key, en, labels.single, ph?.en ?? t.sameAsEvent)
    );

  return (
    <>
      <div className="rounded-2xl border border-line bg-ivory/50 px-4 py-4">
        <Switch id="ev-sectionsEnabled" checked={enabled} onChange={onToggle} label={t.enable} description={t.enableHint} />
      </div>
      <AnimatePresence initial={false}>
        {enabled ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-5 pt-1">
              {SECTION_KEYS.map((key) => (
                <fieldset key={key} className={cn("space-y-4 rounded-2xl border px-4 pb-5 pt-3 sm:px-5", key === "MEN" ? "border-[#2f5d8a]/20" : "border-[#a2456b]/20")}>
                  <legend className="flex items-center gap-2 px-1.5 font-display text-xl text-ink">
                    <span className={cn("size-2 rounded-full", key === "MEN" ? "bg-[#2f5d8a]" : "bg-[#a2456b]")} aria-hidden="true" />
                    {SECTION_LABELS[key][locale]}
                  </legend>
                  <Field
                    id={`ev-sec-${key}-time`}
                    label={t.time}
                    optional={d.optional}
                    error={err(key, "time")}
                    hint={fmt(t.timeHint, { time: eventTime ? formatWallTime(eventTime, locale) : "—" })}
                  >
                    <Input
                      id={`ev-sec-${key}-time`}
                      type="time"
                      dir="ltr"
                      value={rows[key].time}
                      onChange={(e) => set(key, "time", e.target.value)}
                      aria-invalid={Boolean(err(key, "time"))}
                      className="sm:max-w-[12rem]"
                    />
                  </Field>
                  {pair(key, "venueName", "venueNameAr", { single: t.venue, en: t.venueEn, ar: t.venueAr })}
                  {pair(key, "address", "addressAr", { single: t.address, en: t.addressEn, ar: t.addressAr })}
                  <Field id={`ev-sec-${key}-mapsUrl`} label={t.mapsUrl} optional={d.optional} error={err(key, "mapsUrl")}>
                    <Input
                      id={`ev-sec-${key}-mapsUrl`}
                      type="url"
                      inputMode="url"
                      dir="ltr"
                      value={rows[key].mapsUrl}
                      onChange={(e) => set(key, "mapsUrl", e.target.value)}
                      aria-invalid={Boolean(err(key, "mapsUrl"))}
                      placeholder={t.sameAsEvent}
                    />
                  </Field>
                  {pair(key, "note", "noteAr", { single: t.note, en: t.noteEn, ar: t.noteAr }, { en: t.notePh, ar: t.noteArPh })}
                </fieldset>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
