import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/server/auth/guards";
import { getNavBadges } from "@/server/admin/overview";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · INVTRA Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const badges = await getNavBadges();
  return (
    <AdminShell user={{ name: user.name, email: user.email }} badges={badges}>
      {children}
    </AdminShell>
  );
}
