"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PencilRuler } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Admin → Custom events → Design: the way into INVTRA Studio, and the switch between the Studio
 * design and the template layout chosen below.
 */
export function StudioEntry({ eventId, state }: { eventId: string; state: "on" | "off" | "none" }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      await api(`/api/events/${eventId}/design`, { method: "PATCH", body: { canvasEnabled: enabled } });
      router.refresh();
      toast(enabled ? "The card is drawn from the Studio design again." : "The card uses the design below again. The Studio design is kept.", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't change it.", "error");
    } finally {
      setBusy(false);
    }
  };
  const href = `/admin/custom/${eventId}/studio`;
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center",
        state === "on" ? "border-violet-200 bg-violet-50/70" : "border-line bg-[linear-gradient(120deg,#fbf7f0,#f3ecff)]",
      )}
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-600 text-white shadow-soft">
        <PencilRuler className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[19px] text-ink">
          {state === "on" ? "This card is designed in INVTRA Studio" : state === "off" ? "A Studio design is saved (turned off)" : "Design it freely in INVTRA Studio"}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
          {state === "on"
            ? "Guests get the Studio design, with their own name and QR code. The design choices below still set the website’s look; the card’s wording comes from Studio."
            : state === "off"
              ? "The card uses the design chosen below. Turn the Studio design back on, or open it to keep working."
              : "Every flower, ornament and line of the chosen design becomes its own layer: move it, restyle it or remove it, and add painted pieces, gold, photos, shapes and text."}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {state === "on" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggle(false)}
            className="h-10 rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink-soft transition hover:border-bronze-400 hover:text-ink disabled:opacity-60"
          >
            Use the design below instead
          </button>
        ) : null}
        {state === "off" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggle(true)}
            className="h-10 rounded-full border border-line-strong bg-white px-4 text-[13px] text-ink-soft transition hover:border-bronze-400 hover:text-ink disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Turn it back on"}
          </button>
        ) : null}
        <Link
          href={href}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-violet-600 px-5 text-[13px] font-medium text-white shadow-soft transition hover:bg-violet-700"
        >
          <PencilRuler className="size-4" />
          {state === "none" ? "Open in Studio" : "Open Studio"}
        </Link>
      </div>
    </div>
  );
}
