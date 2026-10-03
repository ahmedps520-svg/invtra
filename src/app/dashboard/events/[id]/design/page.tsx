import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { findOwnedEvent } from "@/server/events/access";
import { editorProps } from "@/server/events/editor";
import { getI18n } from "@/server/i18n";
import { pickNamespaces } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n/provider";
import { DesignEditor } from "@/components/editor/design-editor";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.editor.meta.title };
}

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/events/${id}/design`);
  const event = await findOwnedEvent(user.id, id);
  if (!event) notFound();
  const [{ locale }, props] = await Promise.all([getI18n(), editorProps(event)]);
  return (
    <I18nProvider locale={locale} dict={pickNamespaces(locale, ["editor", "themes"])}>
      <DesignEditor {...props} />
    </I18nProvider>
  );
}
