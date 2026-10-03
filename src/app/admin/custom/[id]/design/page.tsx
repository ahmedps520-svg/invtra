import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { getCustomPackage } from "@/server/custom/service";
import { editorProps } from "@/server/events/editor";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { DesignEditor } from "@/components/editor/design-editor";
import { CustomSteps } from "@/components/admin/custom-steps";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Design · Custom event" };

/** Step 6 of a custom event: staff design the host's invitation with the full editor. */
export default async function CustomDesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const pkg = await getCustomPackage(id);
  if (!pkg) notFound();
  const props = await editorProps(pkg.event, {
    premiumIncluded: true, // a custom package includes every design
    nav: {
      back: { href: "/admin/custom", label: "Custom events" },
      next: {
        href: `/admin/custom/${pkg.id}/send`,
        label: pkg.status === "PENDING" ? "Continue to send the link" : "Done",
      },
    },
  });
  return (
    <>
      <Link
        href="/admin/custom"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        Custom events
      </Link>
      <PageHeader
        eyebrow={`Custom event · ${pkg.user.name}`}
        title="Design the invitation"
        description="Choose any design — premium designs are included — or upload your own artwork, then set the wording, colours and fonts. Everything saves as you go, and the host can still adjust it later."
      />
      <CustomSteps current={5} links={{ 6: `/admin/custom/${pkg.id}/send` }} />
      {/* The editor's copy is English in the admin area. */}
      <I18nProvider
        locale="en"
        dict={pickNamespaces("en", ["common", "editor", "themes"])}
      >
        <DesignEditor {...props} />
      </I18nProvider>
    </>
  );
}
