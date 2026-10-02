import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { listCustomers } from "@/server/admin/customers";
import { currentParams, type SearchParams } from "@/server/admin/params";
import { FilterBar } from "@/components/admin/filter-bar";
import { DataTable, LinkCell, Muted, PageHeader, Pagination, StatusBadge } from "@/components/admin/ui";
import { day, dt, num, rel } from "@/components/admin/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const data = await listCustomers(sp);
  const params = currentParams(sp, ["q", "status", "role"]);

  return (
    <>
      <PageHeader eyebrow="Customers" title="Customers" description="Every INVTRA account. Open a customer to see their events and orders or to deactivate the account." />
      <FilterBar
        values={params}
        fields={[
          { type: "search", name: "q", placeholder: "Search name, email or phone" },
          { type: "select", name: "status", label: "Status", options: [{ value: "ACTIVE", label: "Active" }, { value: "DEACTIVATED", label: "Deactivated" }] },
          { type: "select", name: "role", label: "Role", allLabel: "All roles", options: [{ value: "CUSTOMER", label: "Customers" }, { value: "ADMIN", label: "Admins" }] },
        ]}
      />
      <DataTable
        caption="Customers"
        rows={data.rows}
        rowKey={(u) => u.id}
        empty={data.q ? `No accounts match “${data.q}”.` : "No accounts yet."}
        columns={[
          {
            key: "name",
            header: "Customer",
            cell: (u) => (
              <LinkCell href={`/admin/customers/${u.id}`} sub={u.email}>
                {u.name}
                {u.role === "ADMIN" ? <StatusBadge status="CUSTOM" label="Admin" className="ms-2 align-middle" /> : null}
              </LinkCell>
            ),
          },
          { key: "events", header: "Events", align: "end", cell: (u) => num(u._count.events) },
          { key: "orders", header: "Paid orders", align: "end", cell: (u) => num(u._count.orders), hideBelow: "md" },
          { key: "created", header: "Joined", cell: (u) => <span title={dt(u.createdAt)}>{day(u.createdAt)}</span>, hideBelow: "sm" },
          { key: "login", header: "Last sign-in", cell: (u) => (u.lastLoginAt ? <span title={dt(u.lastLoginAt)}>{rel(u.lastLoginAt)}</span> : <Muted>Never</Muted>), hideBelow: "md" },
          { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/customers" params={params} />
    </>
  );
}
