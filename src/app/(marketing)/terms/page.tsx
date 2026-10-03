import type { Metadata } from "next";
import { getI18n } from "@/server/i18n";
import { LegalDocument } from "@/components/marketing/legal-document";
import { pageMetadata } from "@/components/marketing/seo";
import { companyDetails } from "@/server/legal";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  const t = dict.marketing.meta;
  return pageMetadata({ locale, path: "/terms", title: t.termsTitle, description: t.termsDescription });
}

export default async function TermsPage() {
  const { dict } = await getI18n();
  return <LegalDocument dict={dict} doc={dict.marketing.legal.terms} company={companyDetails()} />;
}
