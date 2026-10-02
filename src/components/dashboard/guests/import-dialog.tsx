"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { PHONE_COUNTRIES } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { errorMessage, plural } from "../i18n";

type PreviewRow = {
  row: number;
  name: string;
  phone: string;
  rawPhone: string;
  groupName: string | null;
  allowedCount: number;
  error: "missing_name" | "missing_phone" | "invalid_phone" | null;
  duplicate: "file" | "existing" | null;
};
type Preview = { rows: PreviewRow[]; summary: { total: number; valid: number; invalid: number; duplicates: number }; country: string };
type Result = { created: number; duplicates: number; invalid: number };

const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** CSV / Excel import: choose → preview (problems marked) → confirm → result. */
export function ImportDialog({
  open,
  onClose,
  eventId,
  defaultCountry,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  defaultCountry: string;
  onImported: () => void;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.import;
  const toast = useToast();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [country, setCountry] = useState(defaultCountry);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [dragging, setDragging] = useState(false);

  function pick(f: File | null | undefined) {
    if (!f) return;
    setFileError(null);
    if (!/\.(csv|xlsx)$/i.test(f.name)) return setFileError(d.fileErrors.unsupported_file);
    if (f.size > 3 * 1024 * 1024) return setFileError(d.fileErrors.file_too_large);
    setFile(f);
  }

  function downloadSample() {
    const header = "Name,Phone,Group,Guests";
    const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [header, ...d.sampleRows.map((r) => r.map(quote).join(","))].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invtra-guest-list-sample.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function check() {
    if (!file) return setFileError(d.fileErrors.missing_file);
    setBusy(true);
    setFileError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("country", country);
      const res = await api<Preview>(`/api/events/${eventId}/guests/import/preview`, { method: "POST", body: form });
      setPreview(res);
      setProblemsOnly(res.summary.invalid + res.summary.duplicates > 0 && res.rows.length > 12);
    } catch (e) {
      const known = e instanceof ApiError ? (d.fileErrors as Record<string, string>)[e.code] : undefined;
      setFileError(known ?? errorMessage(e, dict));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    const rows = preview.rows
      .filter((r) => !r.error && !r.duplicate)
      .map((r) => ({ name: r.name, phone: r.phone, groupName: r.groupName, allowedCount: r.allowedCount }));
    setBusy(true);
    try {
      const res = await api<Result>(`/api/events/${eventId}/guests/import`, { method: "POST", body: { rows, country: preview.country } });
      setResult({ ...res, duplicates: res.duplicates + preview.summary.duplicates, invalid: res.invalid + preview.summary.invalid });
      onImported();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPreview(null);
    setResult(null);
    setFile(null);
    setFileError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const close = () => {
    if (busy) return;
    onClose();
  };

  const n = (v: number) => formatNumber(v, locale);
  const rows = preview ? (problemsOnly ? preview.rows.filter((r) => r.error || r.duplicate) : preview.rows) : [];

  let footer: React.ReactNode;
  if (result)
    footer = (
      <Button variant="primary" onClick={onClose}>
        {d.done.close}
      </Button>
    );
  else if (preview)
    footer = (
      <>
        <Button variant="ghost" onClick={reset} disabled={busy}>
          {d.change}
        </Button>
        <Button variant="primary" loading={busy} disabled={!preview.summary.valid} onClick={confirm}>
          {busy ? d.importing : plural(locale, d.confirm, preview.summary.valid)}
        </Button>
      </>
    );
  else
    footer = (
      <>
        <Button variant="ghost" onClick={close} disabled={busy}>
          {dict.common.actions.cancel}
        </Button>
        <Button variant="primary" loading={busy} disabled={!file} onClick={check}>
          {busy ? d.checking : d.check}
        </Button>
      </>
    );

  return (
    <Dialog open={open} onClose={close} title={d.title} description={result ? undefined : d.description} size={preview && !result ? "xl" : "md"} footer={footer}>
      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-soft text-sage">
              <CheckCircle2 className="size-6" />
            </div>
            <h3 className="mt-5 font-display text-3xl text-ink">{d.done.title}</h3>
            <p className="mt-2 text-[15px] text-ink-soft">{plural(locale, d.done.created, result.created)}</p>
            {result.duplicates + result.invalid > 0 ? (
              <p className="mt-1 text-sm text-ink-faint">{fmt(d.done.skipped, { duplicates: n(result.duplicates), invalid: n(result.invalid) })}</p>
            ) : null}
          </motion.div>
        ) : preview ? (
          <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryChip label={plural(locale, d.summary.total, preview.summary.total)} tone="neutral" />
              <SummaryChip label={plural(locale, d.summary.valid, preview.summary.valid)} tone="sage" />
              <SummaryChip label={plural(locale, d.summary.invalid, preview.summary.invalid)} tone={preview.summary.invalid ? "rosewood" : "neutral"} />
              <SummaryChip label={plural(locale, d.summary.duplicates, preview.summary.duplicates)} tone={preview.summary.duplicates ? "ochre" : "neutral"} />
            </div>
            {!preview.summary.valid ? (
              <p className="mt-4 rounded-xl bg-rosewood-soft px-4 py-3 text-sm text-rosewood" role="alert">
                {d.nothingValid}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[13px] text-ink-faint">
                <FileSpreadsheet className="size-4" />
                <span dir="ltr">{file?.name}</span> · {dict.dashboard.countries[preview.country as keyof typeof dict.dashboard.countries] ?? preview.country}
              </p>
              {preview.summary.invalid + preview.summary.duplicates > 0 ? (
                <button type="button" onClick={() => setProblemsOnly((v) => !v)} className="text-[13px] font-medium text-bronze-700 hover:text-bronze-900">
                  {problemsOnly ? d.showAll : d.showProblems}
                </button>
              ) : null}
            </div>
            <div className="mt-3 max-h-[46vh] overflow-auto rounded-2xl border border-line">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 z-10 bg-ivory text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                  <tr>
                    <th className="px-3 py-2.5 text-start font-medium">{d.columns.row}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{d.columns.name}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{d.columns.phone}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{d.columns.group}</th>
                    <th className="px-3 py-2.5 text-center font-medium">{d.columns.guests}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{d.columns.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const bad = Boolean(r.error);
                    const dup = !bad && Boolean(r.duplicate);
                    return (
                      <tr key={r.row} className={cn("border-t border-line", bad && "bg-rosewood-soft/50", dup && "bg-ochre-soft/50")}>
                        <td className="px-3 py-2 text-ink-faint tabular-nums">{r.row}</td>
                        <td className="px-3 py-2 text-ink" dir="auto">
                          {r.name || <span className="text-ink-faint">—</span>}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-ink-soft" dir="ltr">
                          <span className={cn(r.error === "invalid_phone" && "text-rosewood line-through decoration-rosewood/40")}>{r.error ? r.rawPhone || "—" : r.phone}</span>
                        </td>
                        <td className="px-3 py-2 text-ink-soft" dir="auto">
                          {r.groupName || <span className="text-ink-faint">—</span>}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-ink-soft">{r.allowedCount}</td>
                        <td className="px-3 py-2">
                          {bad ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-rosewood">
                              <CircleAlert className="size-3.5" />
                              {d.errors[r.error!]}
                            </span>
                          ) : dup ? (
                            <span className="text-[13px] font-medium text-ochre">{d.duplicate[r.duplicate!]}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[13px] text-sage">
                              <CheckCircle2 className="size-3.5" />
                              {d.ok}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-ink-faint">{dict.dashboard.guests.rules.duplicates}</p>
          </motion.div>
        ) : (
          <motion.div key="choose" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <label
                htmlFor={inputId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-9 text-center transition-colors duration-300",
                  dragging ? "border-bronze-500 bg-bronze-50" : file ? "border-sage/40 bg-sage-soft/40" : "border-line-strong bg-ivory/60 hover:border-bronze-400",
                )}
              >
                <span className={cn("flex size-11 items-center justify-center rounded-full", file ? "bg-sage-soft text-sage" : "bg-sand text-bronze-600")}>
                  {file ? <FileSpreadsheet className="size-5" /> : <Upload className="size-5" />}
                </span>
                {file ? (
                  <>
                    <span className="mt-3 text-sm font-medium text-ink" dir="ltr">
                      {file.name}
                    </span>
                    <span className="mt-1 text-[13px] text-bronze-700">{d.change}</span>
                  </>
                ) : (
                  <>
                    <span className="mt-3 text-sm font-medium text-ink">{d.choose}</span>
                    <span className="mt-0.5 text-[13px] text-ink-faint">{d.drop}</span>
                    <span className="mt-2 text-xs text-ink-faint">{d.fileHint}</span>
                  </>
                )}
                <input id={inputId} ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
              {fileError ? (
                <p className="mt-2 text-[13px] text-rosewood" role="alert">
                  {fileError}
                </p>
              ) : null}
            </div>
            <Field id="imp-country" label={d.country} hint={d.countryHint}>
              <Select id="imp-country" value={country} onChange={(e) => setCountry(e.target.value)}>
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {dict.dashboard.countries[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sand/70 px-4 py-3.5">
              <p className="text-[13px] text-ink-soft">{d.sampleHint}</p>
              <Button variant="outline" size="sm" icon={<Download className="size-3.5" />} onClick={downloadSample}>
                {d.sample}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

function SummaryChip({ label, tone }: { label: string; tone: "neutral" | "sage" | "rosewood" | "ochre" }) {
  const tones = {
    neutral: "border-line bg-ivory text-ink-soft",
    sage: "border-sage/25 bg-sage-soft text-sage",
    rosewood: "border-rosewood/25 bg-rosewood-soft text-rosewood",
    ochre: "border-ochre/25 bg-ochre-soft text-ochre",
  };
  return <div className={cn("rounded-xl border px-3 py-2.5 text-[13px] font-medium", tones[tone])}>{label}</div>;
}
