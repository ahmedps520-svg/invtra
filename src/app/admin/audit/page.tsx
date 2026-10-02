import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/guards";
import { listAudit, targetHref } from "@/server/admin/audit";
import { currentParams, type SearchParams } from "@/server/admin/params";
import { FilterBar } from "@/components/admin/filter-bar";
import { ContextChip, DataTable, Mono, Muted, PageHeader, Pagination, humanize } from "@/components/admin/ui";
import { dt, rel } from "@/components/admin/format";

export const metadata: Metadata = { title: "Audit log" };

function summary(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  for (const k of ["reason", "note"]) if (typeof meta[k] === "string" && meta[k]) return `“${meta[k]}”`;
  if (typeof meta.title === "string") return meta.title;
  if (typeof meta.metaName === "string") return meta.metaName;
  if (typeof meta.email === "string") return meta.email;
  return null;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const data = await listAudit(sp);
  const params = currentParams(sp, ["action", "target", "actor"]);

  return (
    <>
      <PageHeader eyebrow="Monitoring" title="Audit log" description="Every consequential action taken by INVTRA staff, with who did it and why." />
      {params.target ? <ContextChip label="Target" value={params.target} basePath="/admin/audit" params={params} param="target" /> : null}
      {params.actor ? <ContextChip label="Staff member" value={data.rows[0]?.actor?.name ?? params.actor} basePath="/admin/audit" params={params} param="actor" /> : null}
      <FilterBar
        values={params}
        fields={[{ type: "select", name: "action", label: "Action", allLabel: "All actions", options: data.actions.map((a) => ({ value: a.action, label: `${a.action} (${a.count})` })) }]}
      />
      <DataTable
        caption="Audit log"
        rows={data.rows}
        rowKey={(r) => r.id}
        empty="No admin actions recorded yet."
        columns={[
          { key: "when", header: "Time", cell: (r) => <div className="whitespace-nowrap"><p className="text-ink">{dt(r.createdAt)}</p><p className="text-[12px] text-ink-faint">{rel(r.createdAt)}</p></div> },
          {
            key: "actor",
            header: "Staff member",
            cell: (r) =>
              r.actor ? (
                <Link href={`/admin/audit?actor=${r.actor.id}`} className="block min-w-0 hover:text-ink">
                  <p className="text-ink">{r.actor.name}</p>
                  <p className="text-[12.5px] text-ink-faint">{r.actor.email}</p>
                </Link>
              ) : (
                <Muted>System</Muted>
              ),
            hideBelow: "sm",
          },
          {
            key: "action",
            header: "Action",
            cell: (r) => {
              const s = summary(r.meta as Record<string, unknown> | null);
              return (
                <div className="min-w-[200px] max-w-[420px]">
                  <p className="text-ink">{humanize(r.action.replace(/^admin\./, ""))}</p>
                  {s ? <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-faint">{s}</p> : null}
                  {r.meta ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[12px] text-bronze-700">Details</summary>
                      <pre className="mt-1 max-h-60 overflow-auto rounded-lg border border-line bg-ivory px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-soft">{JSON.stringify(r.meta, null, 2)}</pre>
                    </details>
                  ) : null}
                </div>
              );
            },
          },
          {
            key: "target",
            header: "Target",
            cell: (r) => {
              const href = targetHref(r.targetType, r.targetId);
              return (
                <div className="min-w-0">
                  <p className="text-ink-soft">{humanize(r.targetType)}</p>
                  {href && r.targetId !== "all" && r.targetId !== "bulk" ? (
                    <Link href={href} className="hover:underline">
                      <Mono>{r.targetId}</Mono>
                    </Link>
                  ) : (
                    <Mono>{r.targetId}</Mono>
                  )}
                </div>
              );
            },
            hideBelow: "md",
          },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/audit" params={params} />
    </>
  );
}
