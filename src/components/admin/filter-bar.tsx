"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type FilterField =
  | { type: "search"; name: string; placeholder: string; label?: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[]; allLabel?: string }
  | { type: "date"; name: string; label: string };

/**
 * One row of filters above a list. Filters live in the URL (shareable, back-button
 * friendly); the page re-renders on the server with the new searchParams.
 */
export function FilterBar(props: { fields: FilterField[]; values: Record<string, string>; className?: string }) {
  // Re-mount when the URL's filters change (back button, pagination, clear) so inputs stay in sync.
  return <FilterBarForm key={JSON.stringify(props.values)} {...props} />;
}

function FilterBarForm({ fields, values, className }: { fields: FilterField[]; values: Record<string, string>; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<Record<string, string>>(values);
  const [pending, startTransition] = useTransition();

  function navigate(next: Record<string, string>) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    const s = q.toString();
    startTransition(() => router.push(s ? `${pathname}?${s}` : pathname));
  }

  function set(name: string, value: string, submit: boolean) {
    const next = { ...state, [name]: value };
    setState(next);
    if (submit) navigate(next);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    navigate(state);
  }

  const active = fields.some((f) => values[f.name]);

  return (
    <form role="search" onSubmit={onSubmit} className={cn("mb-5 flex flex-wrap items-end gap-3", className)}>
      {fields.map((f) => {
        const id = `filter-${f.name}`;
        if (f.type === "search") {
          return (
            <div key={f.name} className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <label htmlFor={id} className="sr-only">
                {f.label ?? f.placeholder}
              </label>
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <Input id={id} type="search" value={state[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value, false)} className="h-10 ps-10 text-sm" />
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <div key={f.name} className="min-w-[150px]">
              <label htmlFor={id} className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                {f.label}
              </label>
              <Select id={id} value={state[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value, true)} className="h-10 text-sm">
                <option value="">{f.allLabel ?? "All"}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          );
        }
        return (
          <div key={f.name}>
            <label htmlFor={id} className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              {f.label}
            </label>
            <Input id={id} type="date" value={state[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value, true)} className="h-10 w-[160px] text-sm" />
          </div>
        );
      })}
      <div className="flex h-10 items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-medium text-ivory transition hover:bg-bronze-800"
        >
          {pending ? <Spinner className="size-3.5" /> : null}
          Apply
        </button>
        {active ? (
          <button
            type="button"
            onClick={() => {
              const cleared = Object.fromEntries(fields.map((f) => [f.name, ""]));
              setState(cleared);
              navigate({});
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-faint transition hover:bg-sand hover:text-ink"
          >
            <X className="size-3.5" aria-hidden="true" /> Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
