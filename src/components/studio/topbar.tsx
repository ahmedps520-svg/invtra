"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CloudOff, Download, Eye, Keyboard, Loader2, MoreHorizontal, PencilRuler, PowerOff, Redo2, Share2, Undo2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Popover } from "./controls";
import { useStudio } from "./studio-context";
import type { ViewMode } from "./types";

const MODES: { value: ViewMode; label: string; icon: React.ReactNode; title: string }[] = [
  { value: "edit", label: "Edit", icon: <PencilRuler className="size-3.5" />, title: "Edit the card" },
  { value: "guest", label: "Guest’s card", icon: <Eye className="size-3.5" />, title: "A guest’s card: their name and QR code (a sample guest here)" },
  { value: "teaser", label: "Shared image", icon: <Share2 className="size-3.5" />, title: "The image shared in messages and link previews (no guest name or QR code)" },
];

export function TopBar() {
  const s = useStudio();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const canUndo = s.state.past.length > 0;
  const canRedo = s.state.future.length > 0;

  const leave = async () => {
    setLeaving(true);
    const ok = await s.saveNow();
    if (!ok) {
      setLeaving(false);
      s.toast("Couldn't save the latest changes. Check your connection and try again.", "error");
      return;
    }
    router.push(s.backHref);
    router.refresh();
  };

  const download = async (opts: { format: "png" | "jpg"; blank: boolean }) => {
    if (!(await s.saveNow())) {
      s.toast("Couldn't save the design, so the download would be out of date.", "error");
      return;
    }
    const q = new URLSearchParams({ sample: "1", download: "1", scale: "2", format: opts.format, ...(opts.blank ? { blank: "1" } : {}) });
    const a = document.createElement("a");
    a.href = `/api/events/${s.event.id}/card?${q}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const turnOff = async () => {
    if (!window.confirm("Turn off the Studio design? The card goes back to the design chosen in the Design step. The Studio design is kept, so you can turn it back on.")) return;
    try {
      await s.saveNow();
      await api(`/api/events/${s.event.id}/design`, { method: "PATCH", body: { canvasEnabled: false } });
      router.push(s.backHref);
      router.refresh();
    } catch (e) {
      s.toast(e instanceof ApiError ? e.message : "Couldn't turn it off.", "error");
    }
  };

  const status = s.saveStatus;
  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-white px-2 sm:gap-2 sm:px-3">
      <button
        type="button"
        onClick={() => void leave()}
        className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-ink-soft transition hover:bg-sand hover:text-ink"
        title="Back to the Design step"
      >
        {leaving ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeft className="size-4" />}
        <span className="hidden md:inline">Design</span>
      </button>
      <div className="hidden h-6 w-px bg-line sm:block" />
      <div className="min-w-0 max-w-[30vw] sm:max-w-xs">
        <p className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-700 sm:block">INVTRA Studio</p>
        <p className="truncate text-[13px] leading-tight text-ink" title={s.event.title}>
          {s.event.title}
        </p>
      </div>

      <div className="ms-1 flex items-center">
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => s.dispatch({ type: "undo" })}
          className="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink disabled:opacity-35"
          aria-label="Undo"
          title="Undo (⌘Z)"
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={() => s.dispatch({ type: "redo" })}
          className="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink disabled:opacity-35"
          aria-label="Redo"
          title="Redo (⇧⌘Z)"
        >
          <Redo2 className="size-4" />
        </button>
      </div>

      <div className="flex-1" />

      <div role="radiogroup" aria-label="View" className="hidden rounded-full border border-line bg-sand/60 p-0.5 lg:flex">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={s.mode === m.value}
            title={m.title}
            onClick={() => s.setMode(m.value)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] transition",
              s.mode === m.value ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      <span
        className={cn("hidden items-center gap-1.5 px-2 text-[12px] sm:flex", status === "error" ? "text-rosewood" : "text-ink-faint")}
        aria-live="polite"
      >
        {status === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : status === "error" ? <CloudOff className="size-3.5" /> : status === "saved" ? <Check className="size-3.5" /> : null}
        {status === "saving" ? "Saving…" : status === "pending" ? "Unsaved changes" : status === "error" ? "Not saved — retrying" : "Saved"}
      </span>

      <Popover
        label="Download"
        width={260}
        trigger={({ toggle }) => (
          <button type="button" onClick={toggle} className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] text-ink transition hover:border-violet-300" title="Download">
            <Download className="size-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
        )}
      >
        {(close) => (
          <div className="space-y-1">
            {[
              { label: "PNG, high resolution", note: "The design alone: no guest name or QR", format: "png" as const, blank: true },
              { label: "JPEG, high resolution", note: "The design alone, smaller file", format: "jpg" as const, blank: true },
              { label: "PNG with a sample guest", note: "As a guest receives it, with a sample QR", format: "png" as const, blank: false },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  close();
                  void download(o);
                }}
                className="block w-full rounded-lg px-2.5 py-2 text-start transition hover:bg-sand"
              >
                <span className="block text-[13px] text-ink">{o.label}</span>
                <span className="block text-[11.5px] text-ink-faint">{o.note} · 2160 × 2700</span>
              </button>
            ))}
          </div>
        )}
      </Popover>

      <Popover
        label="More"
        width={250}
        trigger={({ toggle }) => (
          <button type="button" onClick={toggle} className="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink" aria-label="More">
            <MoreHorizontal className="size-4" />
          </button>
        )}
      >
        {(close) => (
          <div className="space-y-1">
            <div className="lg:hidden">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    s.setMode(m.value);
                    close();
                  }}
                  className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[13px] transition hover:bg-sand", s.mode === m.value && "text-violet-700")}
                >
                  {m.icon} {m.label}
                </button>
              ))}
              <div className="my-1 h-px bg-line" />
            </div>
            <button
              type="button"
              onClick={() => {
                close();
                s.setHelpOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[13px] transition hover:bg-sand"
            >
              <Keyboard className="size-4 text-ink-faint" /> Keyboard shortcuts
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                void turnOff();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[13px] text-rosewood transition hover:bg-rosewood-soft"
            >
              <PowerOff className="size-4" /> Turn off the Studio design
            </button>
          </div>
        )}
      </Popover>

      <button
        type="button"
        onClick={() => void leave()}
        className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-medium text-ivory shadow-soft transition hover:bg-bronze-800"
      >
        Done
      </button>
    </header>
  );
}
