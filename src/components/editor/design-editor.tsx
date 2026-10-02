"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, Send } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n/provider";
import { api, ApiError } from "@/lib/api-client";
import { FONTS } from "@/lib/design/fonts";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { BackgroundPanel } from "./background-panel";
import { ColoursPanel, PaletteSwatch } from "./colours-panel";
import { EditorSection } from "./controls";
import { EditorProvider, useEditor } from "./editor-context";
import { ImagePanel } from "./image-panel";
import { MediaPanel } from "./media-panel";
import { findPreset } from "./palettes";
import { PreviewPane } from "./preview-pane";
import { QrPanel } from "./qr-panel";
import { ThemePicker } from "./theme-picker";
import type { EditorProps } from "./types";
import { TypographyPanel } from "./typography-panel";
import { useCardProps, useMediaQuery } from "./use-card-props";
import { WebsitePanel } from "./website-panel";
import { WordingPanel } from "./wording-panel";

type SectionId = "theme" | "image" | "wording" | "colours" | "typography" | "background" | "qr" | "website" | "media";

export function DesignEditor(props: EditorProps) {
  return (
    <EditorProvider props={props}>
      <EditorLayout />
    </EditorProvider>
  );
}

function EditorLayout() {
  const { dict } = useI18n();
  const t = dict.editor;
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);
  const [open, setOpen] = useState<Set<SectionId>>(() => new Set<SectionId>(["theme"]));
  const [mobilePreview, setMobilePreview] = useState(false);
  const summaries = useSummaries();

  const toggle = (id: SectionId) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sections: { id: SectionId; body: ReactNode }[] = [
    { id: "theme", body: <ThemePicker /> },
    { id: "image", body: <ImagePanel /> },
    { id: "wording", body: <WordingPanel /> },
    { id: "colours", body: <ColoursPanel /> },
    { id: "typography", body: <TypographyPanel /> },
    { id: "background", body: <BackgroundPanel /> },
    { id: "qr", body: <QrPanel /> },
    { id: "website", body: <WebsitePanel /> },
    { id: "media", body: <MediaPanel /> },
  ];

  return (
    <div className="pb-28 lg:pb-14">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-[2rem] leading-tight text-ink sm:text-[2.5rem]">{t.heading}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-faint">{t.intro}</p>
        </div>
        <SaveIndicator />
      </header>

      <StaleBanner />

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] xl:gap-12">
        <div className="min-w-0">
          <div className="rounded-3xl border border-line bg-paper shadow-soft">
            {sections.map((s, i) => (
              <EditorSection
                key={s.id}
                id={`design-${s.id}`}
                index={i + 1}
                title={t.sections[s.id].title}
                description={t.sections[s.id].description}
                summary={summaries[s.id].text}
                aside={summaries[s.id].aside}
                open={open.has(s.id)}
                onToggle={() => toggle(s.id)}
              >
                {s.body}
              </EditorSection>
            ))}
          </div>
          <EditorFooter />
        </div>

        {isDesktop ? (
          <aside aria-label={t.preview.title} className="hidden lg:block lg:self-stretch">
            <div className="sticky top-24">
              <div className="rounded-3xl border border-line bg-paper p-5 shadow-soft xl:p-6">
                <PreviewPane />
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {!isDesktop ? <MobilePreviewButton onOpen={() => setMobilePreview(true)} /> : null}
      <Dialog open={mobilePreview && !isDesktop} onClose={() => setMobilePreview(false)} size="full" title={t.preview.title}>
        <PreviewPane siteMaxHeight={600} hideTitle />
      </Dialog>
    </div>
  );
}

function useSummaries(): Record<SectionId, { text: ReactNode; aside?: ReactNode }> {
  const { dict } = useI18n();
  const t = dict.editor;
  const { event, draft, gallery } = useEditor();
  const d = draft.design;
  const preset = findPreset(draft.themeKey, d.palette);
  const anyText = Object.values(d.texts).some((v) => v.trim()) || Boolean(d.monogram);
  const fonts =
    event.language === "EN"
      ? [d.fonts.display, d.fonts.body]
      : event.language === "AR"
        ? [d.fonts.arabicDisplay, d.fonts.arabicBody]
        : [d.fonts.display, d.fonts.arabicDisplay];
  const rtlCard = event.language === "AR";
  const side = d.card.qr.position === "bottom-center" ? "center" : (d.card.qr.position === "bottom-start") !== rtlCard ? "left" : "right";
  const sectionsOn = Object.values(d.sections).filter(Boolean).length;
  const media = [
    draft.coverImageKey ? t.summary.cover : null,
    draft.logoKey ? t.summary.logo : null,
    draft.musicKey ? t.summary.music : null,
    gallery.length ? (gallery.length === 1 ? t.summary.photosOne : fmt(t.summary.photos, { n: gallery.length })) : null,
  ].filter(Boolean);

  return {
    theme: { text: dict.themes[draft.themeKey].name },
    image: { text: draft.imageMode === "CUSTOM" ? t.summary.custom : t.summary.generated },
    wording: { text: anyText ? t.summary.personalWording : t.summary.defaultWording },
    colours: {
      text: preset ? t.palettes[preset.name] : t.summary.customColours,
      aside: <PaletteSwatch palette={d.palette} className="size-7" />,
    },
    typography: {
      text: (
        <>
          <span style={{ fontFamily: `"${FONTS[fonts[0]].family}"` }}>{FONTS[fonts[0]].family}</span>
          {" · "}
          <span style={{ fontFamily: `"${FONTS[fonts[1]].family}"` }}>{FONTS[fonts[1]].family}</span>
        </>
      ),
    },
    background: { text: t.background[d.background.mode] },
    qr: {
      text:
        draft.imageMode === "CUSTOM"
          ? t.qr.styles[d.card.qr.style]
          : [t.qr.positions[side], t.qr.sizes[d.card.qr.size], t.qr.styles[d.card.qr.style]].join(" · "),
    },
    website: {
      text: `${fmt(t.summary.sectionsOn, { n: sectionsOn, total: Object.keys(d.sections).length })} · ${t.website.animations[d.animation].label}`,
    },
    media: { text: media.length ? media.join(" · ") : t.summary.nothingYet },
  };
}

function SaveIndicator() {
  const { dict } = useI18n();
  const t = dict.editor.save;
  const { status, errorMessage, saveNow } = useEditor();
  return (
    <div
      aria-live="polite"
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors duration-300",
        status === "error" ? "border-rosewood/25 bg-rosewood-soft/70 text-rosewood" : "border-line bg-paper/80 text-ink-faint",
      )}
    >
      {status === "pending" ? (
        <>
          <Spinner className="size-3.5 text-bronze-500" />
          {t.saving}
        </>
      ) : status === "error" ? (
        <>
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage ?? t.error}</span>
          <button type="button" onClick={() => void saveNow()} className="ms-1 font-medium underline underline-offset-4">
            {t.retry}
          </button>
        </>
      ) : (
        <>
          <CheckCircle2 className="size-4 text-sage" />
          {t.saved}
        </>
      )}
    </div>
  );
}

function StaleBanner() {
  const { dict } = useI18n();
  const t = dict.editor.stale;
  const toast = useToast();
  const { event, staleAccepted, setStaleAccepted, saveNow } = useEditor();
  const [sending, setSending] = useState(false);
  if (staleAccepted <= 0) return null;

  const send = async () => {
    setSending(true);
    try {
      // Guests must receive what's on screen: finish saving first.
      if (!(await saveNow())) return;
      const res = await api<{ count: number }>(`/api/events/${event.id}/send-update`, { method: "POST" });
      setStaleAccepted(0);
      toast(res.count === 1 ? t.sentOne : fmt(t.sent, { n: res.count }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "nothing_to_update") {
        setStaleAccepted(0);
        toast(t.nothing, "info");
      } else {
        toast(e instanceof ApiError && e.status === 429 ? dict.common.errors.rateLimited : dict.common.errors.generic, "error");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-bronze-200 bg-bronze-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-bronze-200 bg-paper text-bronze-600">
          <Send className="size-4 rtl:-scale-x-100" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">{staleAccepted === 1 ? t.one : fmt(t.other, { n: staleAccepted })}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ink-faint">{t.body}</p>
        </div>
      </div>
      <Button variant="primary" size="sm" loading={sending} onClick={send} className="self-start sm:self-auto">
        {t.action}
      </Button>
    </motion.div>
  );
}

function EditorFooter() {
  const { dict } = useI18n();
  const t = dict.editor.footer;
  const { event } = useEditor();
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/dashboard/events/${event.id}/details`} className={buttonClasses("ghost", "md", "self-start")}>
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t.back}
      </Link>
      <Link href={`/dashboard/events/${event.id}/guests`} className={buttonClasses("primary", "lg")}>
        {t.continue}
        <ArrowRight className="size-4 rtl:rotate-180" />
      </Link>
    </div>
  );
}

function MobilePreviewButton({ onOpen }: { onOpen: () => void }) {
  const { dict } = useI18n();
  const { status } = useEditor();
  const card = useCardProps();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label={dict.editor.preview.title}
        className="pointer-events-auto flex h-14 items-center gap-3 rounded-full bg-ink py-2 pe-6 ps-2 text-ivory shadow-lift ring-1 ring-black/10 transition active:scale-[0.98]"
      >
        <span aria-hidden="true" className="block h-10 w-8 overflow-hidden rounded-[3px] bg-sand ring-1 ring-white/20">
          <CardPreview {...card} title={dict.editor.preview.card} className="h-full w-full [&>svg]:h-full [&>svg]:object-cover" />
        </span>
        <span className="flex items-center gap-2 text-sm font-medium tracking-wide">
          <Eye className="size-4 text-bronze-300" />
          {dict.editor.preview.open}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            status === "pending" ? "animate-pulse bg-bronze-300" : status === "error" ? "bg-rosewood" : "bg-sage",
          )}
        />
      </button>
    </div>
  );
}
