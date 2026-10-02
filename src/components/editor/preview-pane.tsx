"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/toggle";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";
import { SitePreview } from "./site-preview";
import { useCardProps } from "./use-card-props";

export type PreviewTab = "card" | "site";

/** The live invitation card, presented like a printed piece on a soft backdrop. */
export function CardStage({ className, cardClassName }: { className?: string; cardClassName?: string }) {
  const { dict } = useI18n();
  const props = useCardProps();
  return (
    <div className={cn("paper-grain flex items-center justify-center rounded-2xl bg-sand/70 p-5 sm:p-7", className)}>
      <CardPreview {...props} title={dict.editor.preview.card} className={cn("w-full max-w-[340px] rounded-[3px] shadow-lift", cardClassName)} />
    </div>
  );
}

export function PreviewPane({ siteMaxHeight = 620, className }: { siteMaxHeight?: number; className?: string }) {
  const { dict } = useI18n();
  const t = dict.editor.preview;
  const { event, draft, saveNow, siteVersion } = useEditor();
  const [tab, setTab] = useState<PreviewTab>("card");
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    // The download is rendered by the server from the saved design — save first.
    await saveNow();
    const a = document.createElement("a");
    a.href = `/api/events/${event.id}/card?sample=1&download=1`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloading(false);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">{t.title}</p>
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "card", label: t.card },
            { value: "site", label: t.site },
          ]}
        />
      </div>

      {tab === "card" ? (
        <div className="mt-5 animate-fade-up">
          <CardStage />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-faint">
              {t.cardCaption} {t.sampleNote}
            </p>
            <Button variant="outline" size="sm" loading={downloading} icon={<Download className="size-3.5" />} onClick={download}>
              {downloading ? t.downloading : t.download}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 animate-fade-up">
          <SitePreview
            eventId={event.id}
            themeKey={draft.themeKey}
            design={draft.design}
            imageMode={draft.imageMode}
            version={siteVersion}
            maxHeight={siteMaxHeight}
          />
          <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-faint">{t.siteCaption}</p>
        </div>
      )}
    </div>
  );
}
