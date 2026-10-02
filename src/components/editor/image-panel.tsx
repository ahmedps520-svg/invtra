"use client";

import { useId, useState } from "react";
import { ImageUp, Move, Sparkles, Trash2, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/provider";
import { fmt } from "@/lib/i18n/config";
import { ChoiceGroup, Hint, Note, RangeInput } from "./controls";
import { useEditor } from "./editor-context";
import { QrPositioner, QR_MAX, QR_MIN, clampQr } from "./qr-positioner";
import { IMAGE_ACCEPT, useUploader } from "./upload";
import { Dropzone, FileButton, UploadError, UploadProgress } from "./upload-field";
import { cardImageOf } from "./use-card-props";
import type { EditorUpload } from "./types";

type Choice = "generated" | "custom";

export function ImagePanel() {
  const { dict } = useI18n();
  const t = dict.editor.image;
  const { event, draft, uploads, update, setDesign, saveNow, addUpload, discardUpload } = useEditor();
  const [choice, setChoice] = useState<Choice>(draft.imageMode === "CUSTOM" ? "custom" : "generated");
  const uploader = useUploader(event.id, "CUSTOM_INVITATION");
  const sizeId = useId();
  const hintId = useId();
  const customUpload = draft.customImageKey ? uploads[draft.customImageKey] : undefined;
  const image = cardImageOf(customUpload);

  const choose = (c: Choice) => {
    setChoice(c);
    if (c === "generated" && draft.imageMode !== "GENERATED") update((d) => ({ ...d, imageMode: "GENERATED" }), { immediate: true });
    // Only switch the card to CUSTOM once there is an image to show.
    if (c === "custom" && image && draft.imageMode !== "CUSTOM") update((d) => ({ ...d, imageMode: "CUSTOM" }), { immediate: true });
  };

  const onFile = async (file: File) => {
    const u: EditorUpload | null = await uploader.start(file);
    if (!u) return;
    addUpload(u);
    const previous = draft.customImageKey;
    update((d) => ({ ...d, imageMode: "CUSTOM", customImageKey: u.key }));
    const ok = await saveNow();
    if (ok && previous && previous !== u.key) void discardUpload(previous);
  };

  const remove = async () => {
    const previous = draft.customImageKey;
    setChoice("generated");
    update((d) => ({ ...d, imageMode: "GENERATED", customImageKey: null }));
    const ok = await saveNow();
    if (ok) void discardUpload(previous);
  };

  const aspect = image ? image.height / image.width : 1.25;
  const qr = clampQr(draft.design.customQr, aspect);

  return (
    <div className="space-y-6">
      <ChoiceGroup
        name="image-mode"
        label={dict.editor.sections.image.title}
        value={choice}
        onChange={choose}
        columns={2}
        options={[
          {
            value: "generated",
            label: t.generated,
            hint: t.generatedHint,
            visual: (
              <span className="flex size-9 items-center justify-center rounded-full bg-bronze-50 text-bronze-600">
                <Sparkles className="size-4" />
              </span>
            ),
          },
          {
            value: "custom",
            label: t.custom,
            hint: t.customHint,
            visual: (
              <span className="flex size-9 items-center justify-center rounded-full bg-bronze-50 text-bronze-600">
                <ImageUp className="size-4" />
              </span>
            ),
          },
        ]}
      />

      {choice === "custom" ? (
        image ? (
          <div className="animate-[fade-up_0.6s_var(--ease-luxe)_backwards] space-y-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <Move className="size-4 text-bronze-600" />
                {t.placeTitle}
              </p>
              <Hint id={hintId} className="mt-1">
                {t.placeHint}
              </Hint>
            </div>
            <div className="mx-auto max-w-sm">
              <QrPositioner
                image={image}
                design={draft.design}
                themeKey={draft.themeKey}
                language={event.language}
                label={t.qrBoxLabel}
                describedBy={hintId}
                onChange={(v) => setDesign({ customQr: v })}
              />
            </div>
            <p className="text-center text-[12px] text-ink-faint">{t.keyboardHint}</p>
            <Note>{t.scanNote}</Note>

            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <label htmlFor={sizeId} className="text-[13px] font-medium text-ink-soft">
                    {t.size}
                  </label>
                  <span className="text-[12px] tabular-nums text-ink-faint">{fmt(t.sizeValue, { n: Math.round(qr.size * 100) })}</span>
                </div>
                <RangeInput
                  id={sizeId}
                  min={QR_MIN}
                  max={QR_MAX}
                  step={0.01}
                  value={qr.size}
                  valueText={fmt(t.sizeValue, { n: Math.round(qr.size * 100) })}
                  onChange={(size) => setDesign({ customQr: clampQr({ ...qr, size }, aspect) })}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDesign({ customQr: clampQr({ ...qr, x: 0.5 }, aspect) })}>
                {t.centre}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
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
            className="animate-[fade-up_0.6s_var(--ease-luxe)_backwards]"
            accept={IMAGE_ACCEPT}
            onFiles={(files) => void onFile(files[0])}
            title={t.uploadTitle}
            hint={t.uploadHint}
            state={uploader.state}
            progressLabel={uploader.label}
            icon={<ImageUp />}
          />
        )
      ) : null}

      {choice === "custom" ? <Note>{t.customStyleNote}</Note> : null}
    </div>
  );
}
