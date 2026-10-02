"use client";

import { useId, useState, type ReactNode } from "react";
import { ImagePlus } from "lucide-react";
import { buttonClasses, type ButtonVariant } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { UploadState } from "./upload";

function filesOf(list: FileList | null | undefined): File[] {
  return list ? Array.from(list) : [];
}

/** Progress line + status text for an upload in flight. */
export function UploadProgress({ state, label }: { state: UploadState; label: string | null }) {
  if (state.status !== "uploading" && state.status !== "processing") return null;
  const pct = state.status === "uploading" ? Math.max(4, Math.round(state.progress * 100)) : 100;
  return (
    <div className="w-full max-w-xs" aria-live="polite">
      <div className="h-1 w-full overflow-hidden rounded-full bg-mist">
        <div
          className={cn("h-full rounded-full bg-bronze-500 transition-[width] duration-300 ease-luxe", state.status === "processing" && "animate-pulse")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 flex items-center justify-center gap-2 text-[12px] text-ink-faint">
        <Spinner className="size-3" />
        {label}
      </p>
    </div>
  );
}

export function UploadError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 text-[13px] leading-relaxed text-rosewood">
      {message}
    </p>
  );
}

/** Dashed drop area that also opens the file picker. */
export function Dropzone({
  accept,
  multiple,
  onFiles,
  title,
  hint,
  state,
  progressLabel,
  icon,
  className,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: ReactNode;
  hint?: ReactNode;
  state: UploadState;
  progressLabel: string | null;
  icon?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [over, setOver] = useState(false);
  const busy = state.status === "uploading" || state.status === "processing";
  return (
    <div className={className}>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const files = filesOf(e.dataTransfer.files);
          if (!busy && files.length) onFiles(multiple ? files : files.slice(0, 1));
        }}
        className={cn(
          "group flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-all duration-300 ease-luxe",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bronze-400 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper",
          over ? "border-bronze-500 bg-bronze-50" : "border-line-strong bg-ivory/60 hover:border-bronze-400 hover:bg-bronze-50/40",
          busy && "cursor-progress",
        )}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            const files = filesOf(e.target.files);
            e.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
        {busy ? (
          <UploadProgress state={state} label={progressLabel} />
        ) : (
          <>
            <span className="flex size-11 items-center justify-center rounded-full border border-line bg-paper text-bronze-600 shadow-soft transition-transform duration-300 ease-luxe group-hover:-translate-y-0.5 [&>svg]:size-5">
              {icon ?? <ImagePlus />}
            </span>
            <span className="mt-1 text-sm font-medium text-ink">{title}</span>
            {hint ? <span className="max-w-xs text-[12px] leading-relaxed text-ink-faint">{hint}</span> : null}
          </>
        )}
      </label>
      <UploadError message={state.status === "error" ? state.message : null} />
    </div>
  );
}

/** A button that opens the file picker (e.g. "Replace"). */
export function FileButton({
  accept,
  onFile,
  children,
  disabled,
  variant = "outline",
  icon,
}: {
  accept: string;
  onFile: (file: File) => void;
  children: ReactNode;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        buttonClasses(variant, "sm"),
        "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bronze-400 has-[:focus-visible]:ring-offset-2",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      {icon}
      {children}
    </label>
  );
}
