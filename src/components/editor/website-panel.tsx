"use client";

import { Info } from "lucide-react";
import { Switch } from "@/components/ui/toggle";
import { useI18n } from "@/components/i18n/provider";
import { ANIMATIONS, type InvitationDesign } from "@/lib/design/schema";
import { cn } from "@/lib/utils";
import { ChoiceGroup, GroupLabel, Hint } from "./controls";
import { useEditor } from "./editor-context";

type SectionKey = keyof InvitationDesign["sections"];
type Animation = InvitationDesign["animation"];
const SECTION_ORDER: SectionKey[] = ["countdown", "schedule", "details", "map", "gallery", "music", "rsvp", "contact"];

function MotionDemo({ kind, active }: { kind: Animation; active: boolean }) {
  const bars = [
    { w: "w-1/2", d: "0ms" },
    { w: "w-3/4", d: "120ms" },
    { w: "w-2/5", d: "240ms" },
  ];
  return (
    <span aria-hidden="true" className="flex h-12 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg bg-ivory">
      {bars.map((b, i) => (
        <span
          key={i}
          className={cn(
            "block h-1.5 rounded-full",
            i === 0 ? "bg-bronze-400" : "bg-line-strong",
            b.w,
            active && kind === "subtle" && "animate-fade-up",
            active && kind === "elegant" && "animate-[fade-up_1.2s_var(--ease-luxe)_both]",
          )}
          style={active && kind !== "none" ? { animationDelay: kind === "elegant" ? `${i * 220}ms` : b.d } : undefined}
        />
      ))}
    </span>
  );
}

export function WebsitePanel() {
  const { dict } = useI18n();
  const t = dict.editor.website;
  const { event, draft, gallery, setDesign } = useEditor();
  const sections = draft.design.sections;
  const missing: Partial<Record<SectionKey, boolean>> = {
    schedule: !event.hasSchedule,
    details: !event.hasDetails,
    contact: !event.hasContact,
    gallery: gallery.length === 0,
    music: !draft.musicKey,
  };

  return (
    <div className="space-y-8">
      <div>
        <GroupLabel>{t.sectionsTitle}</GroupLabel>
        <p className="-mt-1 mb-5 text-[13px] text-ink-faint">{t.sectionsHint}</p>
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {SECTION_ORDER.map((key) => (
            <div key={key}>
              <Switch
                id={`section-${key}`}
                checked={sections[key]}
                onChange={(v) => setDesign({ sections: { [key]: v } })}
                label={t.sections[key].label}
                description={t.sections[key].hint}
              />
              {sections[key] && missing[key] ? (
                <p className="ms-[3.25rem] mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-ochre">
                  <Info className="mt-px size-3.5 shrink-0" />
                  {t.missing[key as keyof typeof t.missing]}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line pt-7">
        <GroupLabel>{t.animation}</GroupLabel>
        <ChoiceGroup<Animation>
          name="animation"
          label={t.animation}
          value={draft.design.animation}
          onChange={(animation) => setDesign({ animation })}
          columns={3}
          options={ANIMATIONS.map((a) => ({
            value: a,
            label: t.animations[a].label,
            hint: t.animations[a].hint,
            visual: <MotionDemo key={`${a}-${draft.design.animation}`} kind={a} active={draft.design.animation === a} />,
          }))}
        />
        <Hint>{t.animationHint}</Hint>
      </div>

      {event.language !== "EN" ? (
        <div className="border-t border-line pt-7">
          <GroupLabel>{t.digits}</GroupLabel>
          <ChoiceGroup<InvitationDesign["digits"]>
            name="digits"
            label={t.digits}
            value={draft.design.digits}
            onChange={(digits) => setDesign({ digits })}
            columns={2}
            options={[
              { value: "arab", label: t.digitsArab },
              { value: "latn", label: t.digitsLatn },
            ]}
          />
          <Hint>{t.digitsHint}</Hint>
        </div>
      ) : null}
    </div>
  );
}
