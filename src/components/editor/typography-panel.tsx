"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/provider";
import {
  ARABIC_BODY_FONTS,
  ARABIC_DISPLAY_FONTS,
  ARABIC_NAME_FONTS,
  FONTS,
  LATIN_BODY_FONTS,
  LATIN_DISPLAY_FONTS,
  LATIN_NAME_FONTS,
  fontStack,
  type FontKey,
} from "@/lib/design/fonts";
import type { InvitationDesign } from "@/lib/design/schema";
import { getTheme } from "@/lib/themes/registry";
import { ChoiceGroup, GroupLabel } from "./controls";
import { useEditor } from "./editor-context";

type Slot = keyof InvitationDesign["fonts"];

function FontPicker({
  slot,
  label,
  fonts,
  sample,
  display,
  arabic,
}: {
  slot: Slot;
  label: string;
  fonts: FontKey[];
  sample: string;
  display: boolean;
  arabic: boolean;
}) {
  const { draft, setDesign } = useEditor();
  return (
    <div>
      <GroupLabel>{label}</GroupLabel>
      <ChoiceGroup<FontKey>
        name={`font-${slot}`}
        label={label}
        value={draft.design.fonts[slot]}
        onChange={(k) => setDesign({ fonts: { [slot]: k } })}
        columns={fonts.length % 3 === 0 ? 3 : 2}
        tileClassName={display ? "min-h-[5.5rem] justify-between" : "justify-between"}
        options={fonts.map((k) => ({
          value: k,
          label: (
            <span
              lang={arabic ? "ar" : "en"}
              dir={arabic ? "rtl" : "ltr"}
              className="block text-ink [overflow-wrap:anywhere]"
              style={{
                fontFamily: fontStack(k),
                fontSize: display ? (FONTS[k].kind === "script" ? 25 : 20) : 16,
                fontWeight: 400,
                lineHeight: 1.35,
              }}
            >
              {sample}
            </span>
          ),
          hint: <span className="block truncate text-[11px] tracking-wide">{FONTS[k].family}</span>,
        }))}
      />
    </div>
  );
}

/** A typeface just for the names; "Same as headings" (null) follows the display typeface. */
function NamesFontPicker({ arabic, label, sample }: { arabic: boolean; label: string; sample: string }) {
  const { dict } = useI18n();
  const t = dict.editor.typography;
  const { draft, setDesign } = useEditor();
  const slot = arabic ? "fontAr" : "font";
  const current = draft.design.names[slot];
  const heading = arabic ? draft.design.fonts.arabicDisplay : draft.design.fonts.display;
  const fonts = arabic ? ARABIC_NAME_FONTS : LATIN_NAME_FONTS;
  const tile = (k: FontKey) => (
    <span
      lang={arabic ? "ar" : "en"}
      dir={arabic ? "rtl" : "ltr"}
      className="block text-ink [overflow-wrap:anywhere]"
      style={{ fontFamily: fontStack(k), fontSize: FONTS[k].kind === "script" ? 25 : 20, fontWeight: 400, lineHeight: 1.35 }}
    >
      {sample}
    </span>
  );
  return (
    <div>
      <GroupLabel>{label}</GroupLabel>
      <ChoiceGroup<string>
        name={`names-${slot}`}
        label={label}
        value={current ?? "same"}
        onChange={(k) => setDesign({ names: { [slot]: k === "same" ? null : (k as FontKey) } })}
        columns={3}
        tileClassName="min-h-[5.5rem] justify-between"
        options={[
          { value: "same", label: tile(heading), hint: <span className="block truncate text-[11px] tracking-wide">{t.namesSame}</span> },
          ...fonts
            .filter((k) => k !== heading)
            .map((k) => ({ value: k, label: tile(k), hint: <span className="block truncate text-[11px] tracking-wide">{FONTS[k].family}</span> })),
        ]}
      />
    </div>
  );
}

export function TypographyPanel() {
  const { dict } = useI18n();
  const t = dict.editor.typography;
  const { event, draft, update } = useEditor();
  const hasArabic = event.language !== "EN";
  const hasLatin = event.language !== "AR";
  const themeFonts = getTheme(draft.themeKey).defaults.fonts;
  const changed =
    (Object.keys(themeFonts) as Slot[]).some((k) => themeFonts[k] !== draft.design.fonts[k]) ||
    Boolean(draft.design.names.font || draft.design.names.fontAr);
  const namesAr = event.hostNamesAr || (event.language === "AR" ? event.hostNames : t.sampleNamesAr);
  const namesEn = event.hostNames.trim() || t.sampleNames;

  const latin = (
    <div className="space-y-6">
      <FontPicker slot="display" label={t.latinDisplay} fonts={LATIN_DISPLAY_FONTS} sample={namesEn} display arabic={false} />
      <FontPicker slot="body" label={t.latinBody} fonts={LATIN_BODY_FONTS} sample={t.sampleBody} display={false} arabic={false} />
    </div>
  );
  const arabic = (
    <div className="space-y-6">
      <FontPicker slot="arabicDisplay" label={t.arabicDisplay} fonts={ARABIC_DISPLAY_FONTS} sample={namesAr} display arabic />
      <FontPicker slot="arabicBody" label={t.arabicBody} fonts={ARABIC_BODY_FONTS} sample={t.sampleBodyAr} display={false} arabic />
    </div>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-6 rounded-2xl border border-line bg-ivory/70 p-5">
        <div>
          <h4 className="font-display text-lg text-ink">{t.namesGroup}</h4>
          <p className="mt-0.5 text-[12px] text-ink-faint">{t.namesHint}</p>
        </div>
        {hasArabic ? <NamesFontPicker arabic label={hasLatin ? t.namesArabic : t.namesOnly} sample={namesAr} /> : null}
        {hasLatin ? <NamesFontPicker arabic={false} label={hasArabic ? t.namesLatin : t.namesOnly} sample={namesEn} /> : null}
      </section>
      {hasLatin && hasArabic ? (
        <>
          <section>
            <h4 className="mb-4 font-display text-lg text-ink">{t.englishGroup}</h4>
            {latin}
          </section>
          <section className="border-t border-line pt-7">
            <h4 className="mb-4 font-display text-lg text-ink">{t.arabicGroup}</h4>
            {arabic}
          </section>
        </>
      ) : hasArabic ? (
        <>
          {arabic}
          <section className="border-t border-line pt-7">
            <h4 className="font-display text-lg text-ink">{t.englishGroup}</h4>
            <p className="mb-4 mt-1 text-[12px] text-ink-faint">{t.englishOnArabic}</p>
            {latin}
          </section>
        </>
      ) : (
        latin
      )}
      {changed ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="size-3.5" />}
            onClick={() => update((d) => ({ ...d, design: { ...d.design, fonts: { ...themeFonts }, names: { ...d.design.names, font: null, fontAr: null } } }))}
          >
            {t.reset}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
