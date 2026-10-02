"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export type ScheduleRow = { key: string; time: string; title: string; titleAr: string; description: string };

let seq = 0;
export const newRowKey = () => `row-${Date.now().toString(36)}-${++seq}`;

function addHour(hhmm: string): string {
  const [h, m] = (hhmm || "19:00").split(":").map(Number);
  return `${String((h + 1) % 24).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
}

/** Programme editor: time + title (+ Arabic) + optional description, reorderable. */
export function ScheduleEditor({
  rows,
  onChange,
  language,
  startTime,
  errors,
}: {
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
  language: "EN" | "AR" | "BILINGUAL";
  startTime: string;
  errors: Record<string, string>;
}) {
  const { dict } = useI18n();
  const d = dict.dashboard.form.schedule;
  const ar = language === "AR";
  const bi = language === "BILINGUAL";

  const update = (i: number, patch: Partial<ScheduleRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    const last = rows[rows.length - 1];
    onChange([...rows, { key: newRowKey(), time: last ? addHour(last.time) : startTime || "19:00", title: "", titleAr: "", description: "" }]);
  };

  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-ivory/60 px-5 py-6 text-center text-sm text-ink-faint">{d.empty}</p>
      ) : (
        <ol className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => {
              const titleErr = errors[`schedule.${i}.title`];
              const timeErr = errors[`schedule.${i}.time`];
              return (
                <motion.li
                  key={r.key}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-2xl border border-line bg-ivory/50 p-3.5 sm:p-4"
                  aria-label={fmt(d.item, { n: i + 1 })}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="w-[7.5rem] shrink-0">
                      <label className="sr-only" htmlFor={`sch-time-${r.key}`}>
                        {d.time}
                      </label>
                      <Input
                        id={`sch-time-${r.key}`}
                        type="time"
                        dir="ltr"
                        value={r.time}
                        aria-invalid={Boolean(timeErr)}
                        onChange={(e) => update(i, { time: e.target.value })}
                        className="tabular-nums"
                      />
                    </div>
                    <div className="grid min-w-0 flex-1 basis-56 gap-3">
                      {!ar ? (
                        <div>
                          <label className="sr-only" htmlFor={`sch-title-${r.key}`}>
                            {d.title}
                          </label>
                          <Input
                            id={`sch-title-${r.key}`}
                            value={r.title}
                            dir="auto"
                            placeholder={d.titlePh}
                            aria-invalid={Boolean(titleErr)}
                            onChange={(e) => update(i, { title: e.target.value })}
                          />
                        </div>
                      ) : null}
                      {ar || bi ? (
                        <div>
                          <label className="sr-only" htmlFor={`sch-titlear-${r.key}`}>
                            {ar ? d.title : d.titleAr}
                          </label>
                          <Input
                            id={`sch-titlear-${r.key}`}
                            value={r.titleAr}
                            dir="rtl"
                            lang="ar"
                            placeholder={d.titleArPh}
                            aria-invalid={ar && Boolean(titleErr)}
                            onChange={(e) => update(i, { titleAr: e.target.value })}
                          />
                        </div>
                      ) : null}
                      <div>
                        <label className="sr-only" htmlFor={`sch-desc-${r.key}`}>
                          {d.description}
                        </label>
                        <Input
                          id={`sch-desc-${r.key}`}
                          value={r.description}
                          dir="auto"
                          placeholder={`${d.description} · ${d.descriptionPh}`}
                          onChange={(e) => update(i, { description: e.target.value })}
                          className="h-10 text-sm"
                        />
                      </div>
                      {titleErr || timeErr ? <p className="text-[13px] text-rosewood">{titleErr || timeErr}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 sm:flex-col">
                      <IconBtn label={d.moveUp} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp />
                      </IconBtn>
                      <IconBtn label={d.moveDown} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown />
                      </IconBtn>
                      <IconBtn label={d.remove} danger onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                        <Trash2 />
                      </IconBtn>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-2 rounded-full px-1 py-1.5 text-sm font-medium text-bronze-700 transition hover:text-bronze-900"
      >
        <Plus className="size-4" />
        {d.add}
      </button>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full p-2 text-ink-faint transition disabled:pointer-events-none disabled:opacity-30 [&>svg]:size-4",
        danger ? "hover:bg-rosewood-soft hover:text-rosewood" : "hover:bg-sand hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
