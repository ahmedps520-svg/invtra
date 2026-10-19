"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, ImagePlus, LayoutTemplate, Loader2, PenTool, Trash2, Upload } from "lucide-react";
import type { DesignSource } from "@prisma/client";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { IMAGE_ACCEPT, uploadFile, UploadError } from "@/components/editor/upload";
import { errorMessage } from "../i18n";

const ICONS: Record<DesignSource, React.ReactNode> = {
  TEMPLATE: <LayoutTemplate className="size-5" />,
  REQUEST: <PenTool className="size-5" />,
  UPLOAD: <Upload className="size-5" />,
};

/** Step 3: one of INVTRA's designs, a custom design by INVTRA's designers, or the customer's own. */
export function DesignSourcePicker({
  eventId,
  sources,
  current,
  locked,
}: {
  eventId: string;
  sources: DesignSource[];
  current: DesignSource;
  locked: boolean;
}) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders.designSource;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<DesignSource | null>(null);

  async function choose(source: DesignSource) {
    if (source === current || locked) return;
    setBusy(source);
    try {
      await api(`/api/events/${eventId}/setup`, { method: "PATCH", body: { designSource: source } });
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(null);
    }
  }

  if (sources.length < 2) return null;
  return (
    <section aria-labelledby="design-source-h" className="mb-10">
      <h2 id="design-source-h" className="font-display text-2xl text-ink sm:text-3xl">
        {d.title}
      </h2>
      <p className="mt-1.5 text-[15px] text-ink-soft">{d.intro}</p>
      <div role="radiogroup" aria-labelledby="design-source-h" className={cn("mt-5 grid gap-3", sources.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {sources.map((s) => {
          const active = s === current;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={locked && !active}
              onClick={() => choose(s)}
              data-source={s}
              className={cn(
                "flex items-start gap-4 rounded-2xl border bg-paper p-5 text-start transition-all duration-300 ease-luxe",
                active ? "border-bronze-500 ring-2 ring-bronze-400/40" : "border-line hover:border-bronze-300 hover:shadow-soft",
                locked && !active && "opacity-50",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", active ? "bg-ink text-ivory" : "bg-sand text-bronze-700")}>
                {busy === s ? <Loader2 className="size-4 animate-spin" /> : ICONS[s]}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-medium text-ink">
                  {d[s].title}
                  {active ? <Check className="size-4 text-bronze-600" strokeWidth={2.5} /> : null}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-ink-soft">{d[s].description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type Reference = { id: string; url: string | null };

/** A custom design request: what the customer wants, and optional reference images. */
export function DesignBrief({
  eventId,
  initialBrief,
  references: initialRefs,
  maxReferences,
  next,
  locked,
}: {
  eventId: string;
  initialBrief: string;
  references: Reference[];
  maxReferences: number;
  next: { href: string; label: string };
  locked: boolean;
}) {
  const { dict } = useI18n();
  const d = dict.dashboard.orders.brief;
  const router = useRouter();
  const toast = useToast();
  const [brief, setBrief] = useState(initialBrief);
  const [saved, setSaved] = useState(initialBrief);
  const [saving, setSaving] = useState(false);
  const [refs, setRefs] = useState<Reference[]>(initialRefs);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const long = brief.trim().length >= 10;

  async function save() {
    if (!long) {
      setError(d.tooShort);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/api/events/${eventId}/setup`, { method: "PATCH", body: { designBrief: brief.trim() } });
      setSaved(brief.trim());
      toast(d.saved);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setSaving(false);
    }
  }

  async function add(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const u = await uploadFile(eventId, file, "REFERENCE");
      setRefs((r) => [...r, { id: u.id, url: u.url }]);
    } catch (e) {
      const code = e instanceof UploadError ? e.code : "generic";
      toast((dict.dashboard.errors as Record<string, string>)[code] ?? dict.dashboard.errors.generic, "error");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/events/${eventId}/uploads/${id}`, { method: "DELETE" });
      setRefs((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    }
  }

  const dirty = brief.trim() !== saved;
  return (
    <Card className="p-6 sm:p-8">
      <h3 className="font-display text-2xl text-ink">{d.title}</h3>
      <p className="mt-1.5 max-w-2xl text-[15px] text-ink-soft">{d.intro}</p>
      <div className="mt-6 space-y-6">
        <Field id="brief" label={d.label} hint={d.hint} error={error}>
          <Textarea
            id="brief"
            rows={6}
            maxLength={3000}
            value={brief}
            disabled={locked}
            placeholder={d.placeholder}
            onChange={(e) => setBrief(e.target.value)}
            aria-invalid={Boolean(error)}
          />
        </Field>
        <div>
          <p className="text-sm font-medium text-ink">{d.references}</p>
          <p className="mt-1 text-[13px] text-ink-faint">{fmt(d.referencesHint, { max: maxReferences })}</p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {refs.map((r) => (
              <li key={r.id} className="group relative size-24 overflow-hidden rounded-xl border border-line bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element -- the customer's own private upload */}
                {r.url ? <img src={r.url} alt="" className="size-full object-cover" /> : null}
                {locked ? null : (
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    aria-label={d.remove}
                    className="absolute end-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-paper/95 text-rosewood shadow-soft"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
            {refs.length < maxReferences && !locked ? (
              <li>
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  disabled={uploading}
                  className="flex size-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-paper text-[12px] text-ink-soft transition hover:border-bronze-400"
                >
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5 text-bronze-600" />}
                  {d.addReference}
                </button>
                <input ref={input} type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={(e) => add(e.target.files)} />
              </li>
            ) : null}
          </ul>
        </div>
        <p className="rounded-2xl bg-sand/70 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">{d.afterPayment}</p>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
        {locked ? null : (
          <Button variant={dirty || !saved ? "primary" : "outline"} loading={saving} disabled={!dirty} onClick={save}>
            {d.save}
          </Button>
        )}
        {saved.length >= 10 && !dirty ? (
          <Link href={next.href} className={buttonClasses("primary", "lg")}>
            {next.label}
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
