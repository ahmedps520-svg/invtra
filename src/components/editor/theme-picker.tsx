"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Check, Eye, Sparkles } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n/provider";
import { fmt } from "@/lib/i18n/config";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import { cn } from "@/lib/utils";
import { useEditor, withTheme } from "./editor-context";
import { SitePreview } from "./site-preview";
import { useCardProps, useMounted } from "./use-card-props";

export function ThemePicker() {
  const { dict } = useI18n();
  const t = dict.editor.theme;
  const { themes, draft, event, content, premiumIncluded } = useEditor();
  const [previewKey, setPreviewKey] = useState<ThemeKey | null>(null);
  const mounted = useMounted();

  // Thumbnails show this event in each theme's own style, with the customer's wording.
  const texts = useDeferredValue(draft.design.texts);
  const monogram = useDeferredValue(draft.design.monogram);
  const digits = draft.design.digits;
  const designs = useMemo(
    () => Object.fromEntries(themes.map((th) => [th.key, { ...getTheme(th.key).defaults, texts, monogram, digits }])),
    [themes, texts, monogram, digits],
  );

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3">
        {themes.map((th) => {
          const name = dict.themes[th.key].name;
          const current = th.key === draft.themeKey;
          return (
            <li key={th.key} className="min-w-0">
              <button
                type="button"
                onClick={() => setPreviewKey(th.key)}
                aria-label={`${fmt(t.previewOf, { name })}${current ? ` — ${t.current}` : ""}${th.premium ? ` — ${t.premium}` : ""}`}
                className="group block w-full rounded-xl text-start focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "relative block overflow-hidden rounded-xl bg-sand transition-all duration-500 ease-luxe",
                    "group-hover:-translate-y-0.5 group-hover:shadow-lift group-focus-visible:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-bronze-400 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-paper",
                    current ? "shadow-soft ring-2 ring-bronze-500 ring-offset-2 ring-offset-paper" : "ring-1 ring-line",
                  )}
                >
                  <span className="block aspect-[4/5]">
                    {mounted ? (
                      <CardPreview
                        themeKey={th.key}
                        design={designs[th.key]}
                        language={event.language}
                        content={content}
                        title={name}
                        className="h-full w-full"
                      />
                    ) : (
                      <span className="skeleton block h-full w-full" />
                    )}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 flex translate-y-2 justify-center bg-gradient-to-t from-ink/55 to-transparent pb-3 pt-10 opacity-0 transition-all duration-500 ease-luxe group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/95 px-3 py-1 text-[12px] font-medium text-ink shadow-soft">
                      <Eye className="size-3.5" />
                      {t.preview}
                    </span>
                  </span>
                  {current ? (
                    <span className="absolute start-2 top-2 flex size-6 items-center justify-center rounded-full bg-bronze-600 text-white shadow-soft ring-2 ring-paper">
                      <Check className="size-3.5" strokeWidth={2.5} />
                    </span>
                  ) : null}
                  {th.premium ? (
                    <Badge tone="bronze" className="absolute end-2 top-2 border-bronze-200/80 bg-paper/90 backdrop-blur">
                      <Sparkles className="size-3" />
                      {t.premium}
                    </Badge>
                  ) : null}
                </span>
                <span className="mt-3 block px-0.5">
                  <span className="block font-display text-lg leading-tight text-ink">{name}</span>
                  {th.suggested && event.type !== "OTHER" ? <span className="mt-1 block text-[11.5px] font-medium text-bronze-700">{t.suggested}</span> : null}
                  <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-ink-faint">{dict.themes[th.key].description}</span>
                  {th.premium && !premiumIncluded ? <span className="mt-1.5 block text-[11px] font-medium text-bronze-700">{t.includedWithPremium}</span> : null}
                  {current ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-bronze-700">
                      <Check className="size-3.5" />
                      {t.current}
                    </span>
                  ) : (
                    <span className="mt-2 inline-block text-[12px] font-medium text-bronze-700 underline-offset-4 group-hover:underline">{t.preview}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ThemePreviewDialog themeKey={previewKey} onClose={() => setPreviewKey(null)} />
    </>
  );
}

function ThemePreviewDialog({ themeKey, onClose }: { themeKey: ThemeKey | null; onClose: () => void }) {
  const { dict } = useI18n();
  const t = dict.editor.theme;
  const toast = useToast();
  const { draft, event, themes, premiumIncluded, applyTheme, siteVersion } = useEditor();
  const [tab, setTab] = useState<"card" | "site">("card");
  const [applying, setApplying] = useState(false);
  // Remember the last theme so the closing animation keeps its content.
  const [shownKey, setShownKey] = useState<ThemeKey | null>(themeKey);
  if (themeKey && themeKey !== shownKey) setShownKey(themeKey);
  const key = themeKey ?? shownKey;
  const previewDraft = useMemo(() => (key ? withTheme(draft, key) : draft), [draft, key]);
  // Always show the theme's own artwork here, even if the customer uses their own image.
  const card = useCardProps({ themeKey: previewDraft.themeKey, design: previewDraft.design, imageMode: "GENERATED" });

  if (!key) return null;
  const name = dict.themes[key].name;
  const option = themes.find((th) => th.key === key);
  const current = key === draft.themeKey;

  const note = (
    <>
      {option?.premium && !premiumIncluded ? <span className="me-1 font-medium text-bronze-700">{t.premiumNote}</span> : null}
      {current ? null : t.keepsNote}
    </>
  );

  const use = async () => {
    setApplying(true);
    const ok = await applyTheme(key);
    setApplying(false);
    if (ok) {
      toast(fmt(t.applied, { name }));
      onClose();
    }
  };

  return (
    <Dialog
      open={Boolean(themeKey)}
      onClose={onClose}
      size="full"
      title={fmt(t.dialogTitle, { name })}
      description={t.dialogDescription}
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden max-w-xl text-[12px] leading-relaxed text-ink-faint sm:block">{note}</p>
          <div className="flex shrink-0 justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              {dict.common.actions.cancel}
            </Button>
            {current ? (
              <Button variant="outline" disabled icon={<Check className="size-4" />}>
                {t.alreadyUsing}
              </Button>
            ) : (
              <Button variant="primary" loading={applying} onClick={use}>
                {applying ? t.applying : t.use}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <p className="mb-4 text-[12px] leading-relaxed text-ink-faint sm:hidden">{note}</p>
      <div className="mb-5 flex justify-center lg:hidden">
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "card", label: t.cardTab },
            { value: "site", label: t.siteTab },
          ]}
        />
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12">
        <div className={cn(tab === "card" ? "block" : "hidden", "lg:block")}>
          <p className="eyebrow mb-4 hidden lg:block">{t.cardTab}</p>
          <div className="paper-grain flex justify-center rounded-2xl bg-sand/70 p-5 sm:p-8">
            <CardPreview {...card} title={fmt(t.previewOf, { name })} className="w-full max-w-[420px] rounded-[3px] shadow-lift" />
          </div>
        </div>
        <div className={cn(tab === "site" ? "block" : "hidden", "lg:block")}>
          <p className="eyebrow mb-4 hidden lg:block">{t.siteTab}</p>
          <SitePreview
            eventId={event.id}
            themeKey={key}
            themeParam={key}
            design={previewDraft.design}
            imageMode={draft.imageMode}
            version={siteVersion}
            maxHeight={600}
          />
        </div>
      </div>
    </Dialog>
  );
}
