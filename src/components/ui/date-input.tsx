"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import {
  addDays,
  addMonths,
  clampIso,
  isoToDMY,
  monthWeeks,
  parseDMY,
  splitIso,
  todayIso,
  typeDMY,
  weekday,
} from "@/lib/date-input";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Date field that always reads dd/mm/yyyy, whatever the browser's language (the native
 * <input type="date"> shows mm/dd/yyyy on US-English devices). Type the date — slashes are
 * added — or pick it from the calendar. `value`/`onChange` use ISO dates ("2026-12-02"),
 * exactly like the native input, and "" while the field is empty or incomplete.
 */
export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  disabled,
  describedBy,
  className,
  inputClassName,
}: {
  id: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
  className?: string;
  inputClassName?: string;
}) {
  const { dict, locale, dir } = useI18n();
  const t = dict.common.date;
  const [text, setText] = useState(() => isoToDMY(value));
  // The value the text stands for: a new value from outside (reset, prefill) replaces the text.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(isoToDMY(value));
  }
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState(() => value || todayIso());
  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const moveFocus = useRef(false);

  const incomplete = touched && text.trim() !== "" && !parseDMY(text);

  function commit(nextText: string) {
    setText(nextText);
    const iso = nextText.trim() === "" ? "" : (parseDMY(nextText) ?? "");
    setShown(iso);
    if (iso !== value) onChange(iso);
  }

  function pick(iso: string) {
    commit(isoToDMY(iso));
    setTouched(true);
    setOpen(false);
    toggleRef.current?.focus();
  }

  function openCalendar() {
    const start = clampIso(value || parseDMY(text) || todayIso(), min, max);
    setFocusDay(start);
    moveFocus.current = true;
    setOpen(true);
  }

  // Keyboard focus follows the highlighted day.
  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
      ?.focus();
  }, [open, focusDay]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onDayKey(e: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const rtl = dir === "rtl";
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(iso, rtl ? 1 : -1),
      ArrowRight: () => addDays(iso, rtl ? -1 : 1),
      ArrowUp: () => addDays(iso, -7),
      ArrowDown: () => addDays(iso, 7),
      PageUp: () => addMonths(iso, -1),
      PageDown: () => addMonths(iso, 1),
      Home: () => addDays(iso, -weekday(iso)),
      End: () => addDays(iso, 6 - weekday(iso)),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveFocus.current = true;
    setFocusDay(clampIso(move(), min, max));
  }

  const view = splitIso(focusDay) ?? splitIso(todayIso())!;
  const intl = locale === "ar" ? "ar-u-nu-latn" : "en-GB";
  const monthLabel = new Intl.DateTimeFormat(intl, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(view.y, view.m - 1, 1)));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intl, {
      weekday: locale === "ar" ? "narrow" : "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 0, 4 + i))),
  );
  const today = todayIso();
  const outOfRange = (iso: string) =>
    Boolean((min && iso < min) || (max && iso > max));
  const shiftMonth = (n: number) =>
    setFocusDay(clampIso(addMonths(focusDay, n), min, max));

  return (
    <div
      ref={wrapRef}
      className={cn("relative", className)}
      onKeyDown={(e) =>
        e.key === "Escape" &&
        open &&
        (e.stopPropagation(), setOpen(false), toggleRef.current?.focus())
      }
    >
      <div dir="ltr" className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t.placeholder}
          value={text}
          disabled={disabled}
          onChange={(e) => commit(typeDMY(e.target.value, text))}
          onBlur={() => {
            setTouched(true);
            const iso = parseDMY(text);
            if (iso) setText(isoToDMY(iso));
          }}
          aria-invalid={Boolean(invalid || incomplete)}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-xl border border-line bg-paper pe-11 ps-3.5 text-[15px] tabular-nums text-ink placeholder:text-ink-faint/80 transition-colors duration-200",
            "hover:border-line-strong focus:border-bronze-400 focus:outline-none focus:ring-4 focus:ring-bronze-100",
            "disabled:cursor-not-allowed disabled:bg-sand disabled:text-ink-faint aria-[invalid=true]:border-rosewood/60 aria-[invalid=true]:focus:ring-rosewood-soft",
            inputClassName,
          )}
        />
        <button
          ref={toggleRef}
          type="button"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openCalendar())}
          aria-label={t.open}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-e-xl text-ink-faint transition hover:text-ink focus-visible:text-ink disabled:pointer-events-none"
        >
          <CalendarDays className="size-[18px]" />
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label={t.open}
          dir={dir}
          className="absolute start-0 top-full z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-paper p-3 shadow-lift"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label={t.previous}
              className="flex size-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </button>
            <p className="text-sm font-medium text-ink" aria-live="polite">
              {monthLabel}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label={t.next}
              className="flex size-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink"
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </button>
          </div>
          <table
            ref={gridRef}
            role="grid"
            aria-label={monthLabel}
            className="w-full table-fixed border-collapse text-center"
          >
            <thead>
              <tr>
                {weekdays.map((w, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="pb-1 text-[11.5px] font-medium text-ink-faint"
                  >
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthWeeks(view.y, view.m).map((week, wi) => (
                <tr key={wi}>
                  {week.map((iso, di) =>
                    iso ? (
                      <td
                        key={iso}
                        role="gridcell"
                        aria-selected={iso === value}
                        className="p-0.5"
                      >
                        <button
                          type="button"
                          tabIndex={iso === focusDay ? 0 : -1}
                          disabled={outOfRange(iso)}
                          onClick={() => pick(iso)}
                          onKeyDown={(e) => onDayKey(e, iso)}
                          aria-label={formatDate(new Date(`${iso}T00:00:00Z`), {
                            locale,
                            timeZone: "UTC",
                            style: "full",
                          })}
                          aria-current={iso === today ? "date" : undefined}
                          className={cn(
                            "flex h-9 w-full items-center justify-center rounded-full text-[13.5px] tabular-nums transition",
                            iso === value
                              ? "bg-ink font-medium text-ivory"
                              : "text-ink hover:bg-sand",
                            iso === today &&
                              iso !== value &&
                              "font-semibold text-bronze-700 ring-1 ring-inset ring-bronze-300",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze-500",
                            "disabled:cursor-not-allowed disabled:text-ink-faint/40 disabled:hover:bg-transparent",
                          )}
                        >
                          {Number(iso.slice(8))}
                        </button>
                      </td>
                    ) : (
                      <td key={`${wi}-${di}`} />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              disabled={outOfRange(today)}
              onClick={() => pick(today)}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-bronze-700 transition hover:bg-sand disabled:opacity-40"
            >
              {t.today}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  commit("");
                  setOpen(false);
                  toggleRef.current?.focus();
                }}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-faint transition hover:bg-sand hover:text-ink"
              >
                {t.clear}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
