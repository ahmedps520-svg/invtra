import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { listErrors } from "@/server/admin/errors";
import { currentParams, type SearchParams } from "@/server/admin/params";
import { ErrorList, type ErrorRow } from "@/components/admin/error-list";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader, Pagination } from "@/components/admin/ui";
import { dt, num, rel } from "@/components/admin/format";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "System errors" };

export default async function ErrorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const data = await listErrors(sp);
  const params = currentParams(sp, ["q", "source", "level", "state"]);
  const { source, level, q } = data.filter;
  const matchingUnresolved = await db.errorLog.count({
    where: { resolvedAt: null, ...(source ? { source } : {}), ...(level ? { level } : {}), ...(q ? { message: { contains: q, mode: "insensitive" } } : {}) },
  });
  const rows: ErrorRow[] = data.rows.map((e) => ({
    id: e.id,
    level: e.level,
    source: e.source,
    message: e.message,
    stack: e.stack,
    context: e.context ? JSON.stringify(e.context, null, 2) : null,
    createdAt: dt(e.createdAt),
    ago: rel(e.createdAt),
    resolvedAt: e.resolvedAt ? dt(e.resolvedAt) : null,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Monitoring"
        title="System errors"
        description={`Errors and warnings logged by the app, the worker and webhooks. ${num(data.unresolved)} unresolved.`}
      />
      <FilterBar
        values={params}
        fields={[
          { type: "search", name: "q", placeholder: "Search messages" },
          { type: "select", name: "source", label: "Source", allLabel: "All sources", options: data.sources.map((s) => ({ value: s.source, label: `${s.source} (${s.count})` })) },
          { type: "select", name: "level", label: "Level", options: [{ value: "error", label: "Errors" }, { value: "warn", label: "Warnings" }] },
          { type: "select", name: "state", label: "Show", allLabel: "Unresolved", options: [{ value: "resolved", label: "Resolved" }, { value: "all", label: "Everything" }] },
        ]}
      />
      <ErrorList rows={rows} match={{ source, level, q }} matchingUnresolved={matchingUnresolved} />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/errors" params={params} />
    </>
  );
}
