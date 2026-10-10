import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { customStepLinks, customStepPage } from "@/server/custom/pages";
import { editorProps } from "@/server/events/editor";
import { str, type SearchParams } from "@/server/admin/params";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { DesignEditor } from "@/components/editor/design-editor";
import { CustomSteps } from "@/components/admin/custom-steps";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Design · Custom event" };

/** Step 2 of a custom event: staff design the invitation with the full editor and custom options. */
export default async function CustomDesignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const { id } = await params;
  const forHost = str(await searchParams, "for", 160);
  const query = forHost.includes("@") ? `?for=${encodeURIComponent(forHost)}` : "";
  const { event, order, draft } = await customStepPage(id, "design", query);
  const props = await editorProps(event, {
    premiumIncluded: true, // a custom package includes every design
    advanced: true,
    detailsHref: `/admin/custom/${event.id}/details`,
    nav: {
      back: { href: `/admin/custom/${event.id}/details`, label: "Event details" },
      next:
        order?.status === "PAID"
          ? { href: `/admin/custom/${event.id}/send`, label: "Done" }
          : { href: `/admin/custom/${event.id}/host${query}`, label: "Continue to host & payment" },
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
        eyebrow={draft ? "Custom event · draft" : `Custom event · ${event.user.name}`}
        title="Design the invitation"
        description="Choose any design — premium designs are included — or upload your own artwork. Set the wording, leave off any line, add your own, and choose whether there's a QR code and what it opens. Everything saves as you go."
      />
      <CustomSteps current={1} links={customStepLinks(event.id, Boolean(order))} />
      {/* The editor's copy is English in the admin area. */}
      <I18nProvider locale="en" dict={pickNamespaces("en", ["common", "editor", "themes"])}>
        <DesignEditor {...props} />
      </I18nProvider>
    </>
  );
}
