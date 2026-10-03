"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { composePhone, countryForCallingCode, isCountry, splitPhone as split } from "@/lib/phone-value";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";

/** Gulf countries first — most INVTRA guests are there. */
const PINNED: CountryCode[] = ["SA", "AE", "KW", "QA", "BH", "OM"];

type Country = { code: CountryCode; name: string; en: string; dial: string };

function displayNames(locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    return null;
  }
}

/** Every country libphonenumber knows, named in the UI language (and English, for search). */
function useCountries(locale: string): { pinned: Country[]; all: Country[] } {
  return useMemo(() => {
    const local = displayNames(locale);
    const en = displayNames("en");
    const list = getCountries().map((code) => {
      let name = code as string;
      let english = code as string;
      try {
        name = local?.of(code) ?? code;
        english = en?.of(code) ?? code;
      } catch {
        /* unknown region code */
      }
      return { code, name, en: english, dial: getCountryCallingCode(code) };
    });
    const collator = new Intl.Collator(locale);
    list.sort((a, b) => collator.compare(a.name, b.name));
    return { pinned: PINNED.map((c) => list.find((x) => x.code === c)!).filter(Boolean), all: list };
  }, [locale]);
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");

function matches(c: Country, q: string): boolean {
  const query = fold(q.trim()).replace(/^\+/, "");
  if (!query) return true;
  if (/^\d+$/.test(query)) return c.dial.startsWith(query);
  return fold(c.name).includes(query) || fold(c.en).includes(query) || c.code.toLowerCase() === query;
}

function Flag({ code, className }: { code: string; className?: string }) {
  return (
    // Static SVG from /public/flags (emoji flags don't render on Windows).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/flags/${code}.svg`} alt="" width={20} height={14} loading="lazy" className={cn("h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10", className)} />
  );
}

/** Searchable country list. Rendered inline (not floating) so it is never clipped inside dialogs. */
function CountryPanel({
  value,
  onPick,
  onClose,
  listId,
}: {
  value: CountryCode;
  onPick: (c: CountryCode) => void;
  onClose: () => void;
  listId: string;
}) {
  const { dict, locale } = useI18n();
  const t = dict.common.phone;
  const { pinned, all } = useCountries(locale);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    if (query.trim()) {
      const found = all.filter((c) => matches(c, query));
      const digits = query.trim().replace(/^\+/, "");
      if (!/^\d+$/.test(digits)) return found;
      // "+44": the United Kingdom before Guernsey and Jersey.
      const rank = (c: Country) => (c.dial === digits ? 0 : 2) + (countryForCallingCode(c.dial) === c.code ? 0 : 1);
      return [...found].sort((a, b) => rank(a) - rank(b));
    }
    return [...pinned, ...all.filter((c) => !PINNED.includes(c.code))];
  }, [query, pinned, all]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) onPick(results[active].code);
    } else if (e.key === "Escape") {
      // Close just the list, not the dialog around it.
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-line bg-paper shadow-lift">
      <div className="relative border-b border-line">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active].code}` : undefined}
          value={query}
          placeholder={t.search}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          className="h-11 w-full bg-transparent pe-3 ps-9 text-[14.5px] text-ink placeholder:text-ink-faint/80 focus:outline-none"
        />
      </div>
      <ul ref={listRef} id={listId} role="listbox" aria-label={t.country} className="max-h-64 overflow-y-auto py-1">
        {results.length ? (
          results.map((c, i) => (
            <li
              key={`${c.code}-${i}`}
              id={`${listId}-${c.code}`}
              data-index={i}
              role="option"
              aria-selected={c.code === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(c.code)}
              onMouseMove={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-2 text-[14px]",
                i === active ? "bg-sand" : "",
                c.code === value ? "font-medium text-ink" : "text-ink-soft",
                !query.trim() && i === PINNED.length - 1 ? "border-b border-line pb-2.5" : "",
              )}
            >
              <Flag code={c.code} />
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {c.name}
              </span>
              <span className="shrink-0 text-[13px] text-ink-faint tabular-nums" dir="ltr">
                +{c.dial}
              </span>
            </li>
          ))
        ) : (
          <li className="px-3 py-6 text-center text-[13px] text-ink-faint">{t.noResults}</li>
        )}
      </ul>
    </div>
  );
}

/** Close a panel when the user clicks or taps outside `ref`. */
function useOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, onOutside: () => void) {
  const cb = useRef(onOutside);
  useEffect(() => {
    cb.current = onOutside;
  }, [onOutside]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, ref]);
}

/**
 * Phone number with a country picker (flag, dial code, searchable list in the UI language).
 * `value` / `onChange` carry an international number like "+966501234567" (or "" when empty).
 */
export function PhoneInput({
  id,
  value,
  onChange,
  defaultCountry = "SA",
  placeholder,
  invalid,
  disabled,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  const { dict, locale } = useI18n();
  const t = dict.common.phone;
  const fallback: CountryCode = isCountry(defaultCountry) ? (defaultCountry.toUpperCase() as CountryCode) : "SA";
  const [state, setState] = useState(() => split(value, fallback));
  const [synced, setSynced] = useState(value);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // A value set from outside (form reset, editing another guest) replaces what is shown.
  if (value !== synced) {
    setSynced(value);
    setState(split(value, fallback));
  }

  const emit = (country: CountryCode, national: string) => {
    setState({ country, national });
    const next = composePhone(country, national);
    setSynced(next);
    onChange(next);
  };

  useOutside(wrap, open, () => setOpen(false));

  const countryName = useMemo(() => {
    try {
      return displayNames(locale)?.of(state.country) ?? state.country;
    } catch {
      return state.country;
    }
  }, [locale, state.country]);

  return (
    <div ref={wrap}>
      <div
        dir="ltr"
        className={cn(
          "flex h-11 w-full overflow-hidden rounded-xl border bg-paper transition-colors duration-200 focus-within:border-bronze-400 focus-within:ring-4 focus-within:ring-bronze-100 hover:border-line-strong",
          invalid ? "border-rosewood/60 focus-within:ring-rosewood-soft" : "border-line",
          disabled && "cursor-not-allowed bg-sand",
        )}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={`${t.country}: ${countryName} (+${getCountryCallingCode(state.country)})`}
          className="flex shrink-0 items-center gap-2 border-e border-line ps-3 pe-2.5 text-[15px] text-ink transition hover:bg-sand/70 focus:outline-none focus-visible:bg-sand"
        >
          <Flag code={state.country} />
          <span className="tabular-nums">+{getCountryCallingCode(state.country)}</span>
          <ChevronDown className={cn("size-3.5 text-ink-faint transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={state.national}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            const text = e.target.value;
            // A full international number (typed or pasted) picks its own country.
            if (/^(\+|00)\d/.test(text.trim())) {
              const p = parsePhoneNumberFromString(text.trim().replace(/^00/, "+"));
              if (p?.country && p.isValid()) return emit(p.country, p.nationalNumber);
            }
            emit(state.country, text);
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-[15px] text-ink placeholder:text-ink-faint/80 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {open ? (
        <CountryPanel
          value={state.country}
          listId={listId}
          onClose={() => {
            setOpen(false);
            inputRef.current?.focus();
          }}
          onPick={(c) => {
            setOpen(false);
            emit(c, state.national);
            inputRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

/** Just the country (flag + name + code) — e.g. "numbers without a country code are from…". */
export function CountrySelect({ id, value, onChange }: { id: string; value: string; onChange: (code: string) => void }) {
  const { dict, locale } = useI18n();
  const t = dict.common.phone;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const code: CountryCode = isCountry(value) ? (value.toUpperCase() as CountryCode) : "SA";
  useOutside(wrap, open, () => setOpen(false));
  const name = useMemo(() => {
    try {
      return displayNames(locale)?.of(code) ?? code;
    } catch {
      return code;
    }
  }, [locale, code]);

  return (
    <div ref={wrap}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t.country}: ${name}`}
        className="flex h-11 w-full items-center gap-3 rounded-xl border border-line bg-paper px-3.5 text-start text-[15px] text-ink transition hover:border-line-strong focus:border-bronze-400 focus:outline-none focus:ring-4 focus:ring-bronze-100"
      >
        <Flag code={code} />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span className="text-[13px] text-ink-faint tabular-nums" dir="ltr">
          +{getCountryCallingCode(code)}
        </span>
        <ChevronDown className={cn("size-4 text-ink-faint transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <CountryPanel
          value={code}
          listId={listId}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
          onPick={(c) => {
            setOpen(false);
            onChange(c);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
