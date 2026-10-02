import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { num } from "./format";

/**
 * Server-safe building blocks for admin pages: page header, data table, pagination,
 * stat tile, key/value list, status badges. (No hooks — usable from Server Components.)
 */

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[34px] leading-[1.1] text-ink sm:text-[40px]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-ink-faint">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "start" | "end";
  /** Hide below this breakpoint to keep phones readable. */
  hideBelow?: "sm" | "md" | "lg";
};

const hideCls = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

/** Hairline table inside a paper card; scrolls horizontally on small screens. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing here yet.",
  caption,
  className,
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  caption?: string;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-paper shadow-soft", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line bg-ivory/70">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-faint",
                    c.align === "end" ? "text-end" : "text-start",
                    c.hideBelow && hideCls[c.hideBelow],
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center text-sm text-ink-faint">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={rowKey(r)} className="align-top transition-colors hover:bg-ivory/60">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        dense ? "px-4 py-2" : "px-4 py-3",
                        "text-ink-soft",
                        c.align === "end" ? "text-end tabular-nums" : "text-start",
                        c.hideBelow && hideCls[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function hrefWith(basePath: string, params: Record<string, string>, page: number) {
  const q = new URLSearchParams(params);
  if (page > 1) q.set("page", String(page));
  else q.delete("page");
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const link = "inline-flex h-8 items-center gap-1 rounded-full border border-line bg-paper px-3 text-[13px] text-ink-soft transition hover:border-bronze-300 hover:text-ink";
  const disabled = "inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-[13px] text-ink-faint/50";
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-faint">
      <p className="tabular-nums">
        {total ? (
          <>
            Showing {num(from)}–{num(to)} of {num(total)}
          </>
        ) : (
          "No results"
        )}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={hrefWith(basePath, params, page - 1)} className={link} rel="prev">
              <ChevronLeft className="size-3.5" aria-hidden="true" /> Previous
            </Link>
          ) : (
            <span className={disabled} aria-disabled="true">
              <ChevronLeft className="size-3.5" aria-hidden="true" /> Previous
            </span>
          )}
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={hrefWith(basePath, params, page + 1)} className={link} rel="next">
              Next <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <span className={disabled} aria-disabled="true">
              Next <ChevronRight className="size-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}

const DOT: Record<string, string> = {
  default: "bg-ink-faint",
  sage: "bg-sage",
  rosewood: "bg-rosewood",
  ochre: "bg-ochre",
  slate: "bg-slate",
  bronze: "bg-bronze-500",
};

/** Compact KPI tile: label, value, optional hint / footnote rows. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  href,
  className,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "sage" | "rosewood" | "ochre" | "slate" | "bronze";
  href?: string;
  className?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">
        <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2.5 font-display text-[34px] leading-none text-ink lining-nums">{value}</div>
      {hint ? <div className="mt-2 text-[12.5px] text-ink-faint">{hint}</div> : null}
      {children ? <div className="mt-3 border-t border-line pt-3 text-[12.5px] text-ink-soft">{children}</div> : null}
    </>
  );
  const cls = cn("block rounded-2xl border border-line bg-paper px-5 py-4 shadow-soft", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-bronze-300")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function KeyValues({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line text-sm", className)}>
      {items.map((it, i) => (
        <div key={i} className="flex items-start justify-between gap-6 py-2.5">
          <dt className="shrink-0 text-ink-faint">{it.label}</dt>
          <dd className="min-w-0 text-end text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Status badges ────────────────────────────────────────────────────────────

const TONES: Record<string, Tone> = {
  // accounts / generic
  ACTIVE: "sage",
  DEACTIVATED: "rosewood",
  DELETED: "neutral",
  // orders & payments
  PAID: "sage",
  SUCCEEDED: "sage",
  PENDING: "ochre",
  CANCELLED: "neutral",
  REFUNDED: "slate",
  FAILED: "rosewood",
  // messages
  QUEUED: "neutral",
  SENT: "slate",
  DELIVERED: "slate",
  READ: "sage",
  RECEIVED: "bronze",
  NOT_SENT: "neutral",
  // jobs
  RUNNING: "slate",
  COMPLETED: "sage",
  // templates
  DRAFT: "neutral",
  APPROVED: "sage",
  REJECTED: "rosewood",
  PAUSED: "ochre",
  DISABLED: "neutral",
  // rsvp / guest status
  ACCEPTED: "sage",
  DECLINED: "rosewood",
  MESSAGE_SENT: "slate",
  INVITATION_SENT: "sage",
  VIEWED: "bronze",
  QR_SCANNED: "bronze",
  // plans
  BASIC: "neutral",
  PREMIUM: "bronze",
  CUSTOM: "bronze",
};

export function humanize(s: string): string {
  const t = s.replace(/[_.]/g, " ").toLowerCase();
  return (t.charAt(0).toUpperCase() + t.slice(1)).replace(/\bqr\b/gi, "QR").replace(/\burl\b/gi, "URL").replace(/\bwhatsapp\b/gi, "WhatsApp");
}

export function StatusBadge({ status, label, className }: { status: string; label?: ReactNode; className?: string }) {
  return (
    <Badge tone={TONES[status] ?? "neutral"} className={className}>
      {label ?? humanize(status)}
    </Badge>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-faint">{children}</span>;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[12px] tracking-tight text-ink-soft", className)}>{children}</span>;
}

/** Pretty-printed JSON block (stack traces, context, raw payloads). */
export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  if (value === null || value === undefined) return <Muted>—</Muted>;
  return (
    <pre className={cn("max-h-80 overflow-auto rounded-xl border border-line bg-ivory px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-soft", className)}>
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function LinkCell({ href, children, sub }: { href: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <Link href={href} className="font-medium text-ink underline-offset-4 transition hover:text-bronze-700 hover:underline">
        {children}
      </Link>
      {sub ? <div className="mt-0.5 truncate text-[12.5px] text-ink-faint">{sub}</div> : null}
    </div>
  );
}

/** "Event: The Wedding of …  ×" — shows a context filter that isn't part of the filter bar. */
export function ContextChip({
  label,
  value,
  href,
  basePath,
  params,
  param,
}: {
  label: string;
  value: ReactNode;
  href?: string;
  basePath: string;
  params: Record<string, string>;
  param: string;
}) {
  const rest = new URLSearchParams(params);
  rest.delete(param);
  rest.delete("page");
  const clear = rest.size ? `${basePath}?${rest}` : basePath;
  return (
    <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-bronze-200 bg-bronze-50 py-1 pe-1 ps-3 text-[13px] text-bronze-800">
      <span className="shrink-0">{label}:</span>
      {href ? (
        <Link href={href} className="truncate font-medium underline-offset-4 hover:underline">
          {value}
        </Link>
      ) : (
        <span className="truncate font-medium">{value}</span>
      )}
      <Link href={clear} aria-label={`Remove ${label.toLowerCase()} filter`} className="shrink-0 rounded-full p-1 transition hover:bg-bronze-100">
        <X className="size-3.5" />
      </Link>
    </div>
  );
}
