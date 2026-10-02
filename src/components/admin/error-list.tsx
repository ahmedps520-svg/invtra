"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck, ChevronRight, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type ErrorRow = {
  id: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  context: string | null;
  createdAt: string; // pre-formatted on the server
  ago: string;
  resolvedAt: string | null;
};

/** Error log with expandable stack/context, selection and bulk resolve. */
export function ErrorList({ rows, match, matchingUnresolved }: { rows: ErrorRow[]; match: { source?: string; level?: string; q?: string }; matchingUnresolved: number }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const open = rows.filter((r) => !r.resolvedAt);
  const allSelected = open.length > 0 && open.every((r) => selected.has(r.id));

  async function send(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const r = await api<{ message: string }>("/api/admin/errors", { body });
      toast(r.message);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Something went wrong.", "error");
    } finally {
      setBusy(null);
    }
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-2.5 shadow-soft">
        <Checkbox
          ariaLabel="Select all unresolved on this page"
          checked={allSelected}
          onChange={(on) => setSelected(on ? new Set(open.map((r) => r.id)) : new Set())}
          label={<span className="text-[13px] text-ink-soft">{selected.size ? `${selected.size} selected` : "Select"}</span>}
        />
        <span className="flex-1" />
        <Button
          size="sm"
          variant="primary"
          disabled={!selected.size}
          loading={busy === "selected"}
          icon={<CheckCheck className="size-3.5" />}
          onClick={() => send({ ids: [...selected], resolved: true }, "selected")}
        >
          Resolve selected
        </Button>
        {matchingUnresolved > 0 ? (
          <Button
            size="sm"
            variant="outline"
            loading={busy === "all"}
            onClick={() => {
              if (window.confirm(`Mark all ${matchingUnresolved} unresolved errors matching these filters as resolved?`)) void send({ match, resolved: true }, "all");
            }}
          >
            Resolve all {matchingUnresolved} matching
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-paper px-6 py-16 text-center text-sm text-ink-faint shadow-soft">No errors match these filters.</div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
          {rows.map((r) => (
            <li key={r.id} className={cn("flex gap-3 px-4 py-3", r.resolvedAt && "bg-ivory/60")}>
              <div className="pt-1">
                {r.resolvedAt ? (
                  <span className="block size-4" aria-hidden="true" />
                ) : (
                  <Checkbox ariaLabel={`Select error ${r.id}`} checked={selected.has(r.id)} onChange={(on) => toggle(r.id, on)} />
                )}
              </div>
              <details className="group min-w-0 flex-1">
                <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="mt-1 size-3.5 shrink-0 text-ink-faint transition group-open:rotate-90" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
                      <Badge tone={r.level === "warn" ? "ochre" : "rosewood"}>{r.level}</Badge>
                      <span className="font-medium text-ink-soft">{r.source}</span>
                      <span title={r.createdAt}>{r.ago}</span>
                      {r.resolvedAt ? <Badge tone="sage">Resolved {r.resolvedAt}</Badge> : null}
                    </div>
                    <p className={cn("mt-1 break-words text-sm", r.resolvedAt ? "text-ink-faint" : "text-ink")}>{r.message}</p>
                  </div>
                </summary>
                <div className="ms-6 mt-3 space-y-3">
                  <p className="text-[12px] text-ink-faint">
                    {r.createdAt} · <span className="tabular-nums">{r.id}</span>
                  </p>
                  {r.context ? (
                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">Context</p>
                      <pre className="max-h-72 overflow-auto rounded-xl border border-line bg-ivory px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-soft">{r.context}</pre>
                    </div>
                  ) : null}
                  {r.stack ? (
                    <div>
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">Stack trace</p>
                      <pre className="max-h-80 overflow-auto rounded-xl border border-line bg-ivory px-4 py-3 font-mono text-[11.5px] leading-relaxed text-ink-soft">{r.stack}</pre>
                    </div>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy === r.id}
                    icon={r.resolvedAt ? <RotateCcw className="size-3.5" /> : <CheckCheck className="size-3.5" />}
                    onClick={() => send({ ids: [r.id], resolved: !r.resolvedAt }, r.id)}
                  >
                    {r.resolvedAt ? "Reopen" : "Mark resolved"}
                  </Button>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
