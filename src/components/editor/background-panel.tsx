"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ImageIcon, Trash2, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/provider";
import type { InvitationDesign } from "@/lib/design/schema";
import { ChoiceGroup, Hint, RangeInput } from "./controls";
import { useEditor } from "./editor-context";
import { IMAGE_ACCEPT, useUploader } from "./upload";
import { Dropzone, FileButton, UploadError, UploadProgress } from "./upload-field";

type Mode = InvitationDesign["background"]["mode"];

export function BackgroundPanel() {
  const { dict } = useI18n();
  const t = dict.editor.background;
  const { event, draft, uploads, update, setDesign, saveNow, addUpload, discardUpload } = useEditor();
  const bg = draft.design.background;
  const p = draft.design.palette;
  const [wantImage, setWantImage] = useState(false);
  const uploader = useUploader(event.id, "BACKGROUND");
  const overlayId = useId();
  const image = bg.imageKey ? uploads[bg.imageKey] : undefined;
  const selected: Mode = wantImage ? "image" : bg.mode;

  const choose = (m: Mode) => {
    if (m === "image" && !image?.url) {
      setWantImage(true);
      return;
    }
    setWantImage(false);
    setDesign({ background: { mode: m } });
  };

  const onFile = async (file: File) => {
    const u = await uploader.start(file);
    if (!u) return;
    addUpload(u);
    const previous = bg.imageKey;
    setWantImage(false);
    update((d) => ({ ...d, design: { ...d.design, background: { ...d.design.background, mode: "image", imageKey: u.key } } }));
    const ok = await saveNow();
    if (ok && previous && previous !== u.key) void discardUpload(previous);
  };

  const remove = async () => {
    const previous = bg.imageKey;
    update((d) => ({ ...d, design: { ...d.design, background: { ...d.design.background, mode: "theme", imageKey: null } } }));
    const ok = await saveNow();
    if (ok) void discardUpload(previous);
  };

  const tile = (children: ReactNode, style?: CSSProperties) => (
    <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-black/5" style={style}>
      {children}
    </span>
  );

  return (
    <div className="space-y-6">
      <ChoiceGroup<Mode>
        name="background"
        label={dict.editor.sections.background.title}
        value={selected}
        onChange={choose}
        options={[
          {
            value: "theme",
            label: t.theme,
            hint: t.themeHint,
            visual: tile(
              <>
                <span
                  className="absolute inset-0 opacity-60"
                  style={{ backgroundImage: `radial-gradient(${p.accent}55 1px, transparent 1px)`, backgroundSize: "6px 6px" }}
                />
                <span className="absolute inset-2.5 rounded-t-full border" style={{ borderColor: `${p.accent}aa` }} />
              </>,
              { background: p.background },
            ),
          },
          { value: "solid", label: t.solid, hint: t.solidHint, visual: tile(null, { background: p.background }) },
          {
            value: "image",
            label: t.image,
            hint: t.imageHint,
            visual: tile(
              image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                <img src={image.url} alt="" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center bg-sand text-ink-faint">
                  <ImageIcon className="size-5" />
                </span>
              ),
            ),
          },
        ]}
      />

      {selected === "image" ? (
        image?.url && !wantImage ? (
          <div className="animate-fade-up space-y-5">
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <label htmlFor={overlayId} className="text-[13px] font-medium text-ink-soft">
                  {t.overlay}
                </label>
                <span className="text-[12px] tabular-nums text-ink-faint">{Math.round(bg.overlay * 100)}%</span>
              </div>
              <RangeInput
                id={overlayId}
                min={0}
                max={0.9}
                step={0.05}
                value={bg.overlay}
                valueText={`${Math.round(bg.overlay * 100)}%`}
                describedBy={`${overlayId}-hint`}
                onChange={(overlay) => setDesign({ background: { overlay } })}
              />
              <Hint id={`${overlayId}-hint`}>{t.overlayHint}</Hint>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FileButton accept={IMAGE_ACCEPT} onFile={onFile} disabled={uploader.busy} icon={<UploadIcon className="size-3.5" />}>
                {t.replace}
              </FileButton>
              <Button variant="ghost" size="sm" onClick={remove} disabled={uploader.busy} icon={<Trash2 className="size-3.5" />}>
                {t.remove}
              </Button>
              <UploadProgress state={uploader.state} label={uploader.label} />
            </div>
            <UploadError message={uploader.state.status === "error" ? uploader.state.message : null} />
          </div>
        ) : (
          <Dropzone
            className="animate-fade-up"
            accept={IMAGE_ACCEPT}
            onFiles={(files) => void onFile(files[0])}
            title={t.uploadTitle}
            hint={t.uploadHint}
            state={uploader.state}
            progressLabel={uploader.label}
          />
        )
      ) : null}
    </div>
  );
}
