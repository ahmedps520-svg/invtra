import type { Metadata } from "next";
import { getI18n } from "@/server/i18n";
import { LegalDocument } from "@/components/marketing/legal-document";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  const t = dict.marketing.meta;
  return { title: t.termsTitle, description: t.termsDescription, alternates: { canonical: "/terms" } };
}

export default async function TermsPage() {
  const { dict } = await getI18n();
  return <LegalDocument dict={dict} doc={dict.marketing.legal.terms} />;
}
