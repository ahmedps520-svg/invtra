import type { Metadata } from "next";
import { getI18n } from "@/server/i18n";
import { LegalDocument } from "@/components/marketing/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  const t = dict.marketing.meta;
  return { title: t.privacyTitle, description: t.privacyDescription, alternates: { canonical: "/privacy" } };
}

export default async function PrivacyPage() {
  const { dict } = await getI18n();
  return <LegalDocument dict={dict} doc={dict.marketing.legal.privacy} />;
}
