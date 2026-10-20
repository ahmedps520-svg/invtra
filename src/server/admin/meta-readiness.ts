import { resolveTxt } from "node:dns/promises";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { companyDetails } from "@/server/legal";
import { whatsappAccountStatus, type WhatsAppAccountStatus } from "@/server/whatsapp/account";

/**
 * Admin → WhatsApp & Meta: what Meta's reviewers check on invtra.store, how INVTRA's WhatsApp
 * account stands with Meta, and what's wrong with the message templates — so a rejected
 * business verification can be fixed point by point.
 */

export type Check = { label: string; ok: boolean; value?: string | null; fix?: string };

/** Meta's domain-verification TXT record on the site's domain, if there is one (DNS verification). */
async function domainTxtRecord(host: string): Promise<string | null> {
  try {
    const records = await Promise.race([resolveTxt(host), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))]);
    return records.map((r) => r.join("")).find((r) => r.startsWith("facebook-domain-verification=")) ?? null;
  } catch {
    return null;
  }
}

export async function metaReadiness(opts: { fresh?: boolean } = {}) {
  const e = env();
  const company = companyDetails();
  const host = new URL(e.APP_URL).hostname.replace(/^www\./, "");
  const metaTag = process.env.META_DOMAIN_VERIFICATION?.trim();
  const dnsRecord = metaTag ? null : await domainTxtRecord(host);
  const site: Check[] = [
    {
      label: "Legal business name on the website",
      ok: Boolean(company?.name),
      value: company?.name,
      fix: "Set LEGAL_ENTITY_NAME on Render, exactly as it appears on your Commercial Registration. It's shown in the footer, Terms, Privacy and receipts.",
    },
    {
      label: "Commercial Registration number",
      ok: Boolean(company?.cr),
      value: company?.cr,
      fix: "Set LEGAL_CR_NUMBER on Render.",
    },
    {
      label: "Business address",
      ok: Boolean(company?.address),
      value: company?.address,
      fix: "Set LEGAL_ADDRESS on Render — the same address as on your registration documents.",
    },
    {
      label: "Domain verified with Meta (DNS record or meta tag)",
      ok: Boolean(metaTag || dnsRecord),
      value: metaTag ? "facebook-domain-verification tag is on every page" : dnsRecord ? `DNS TXT record on ${host} (keep it at your domain provider)` : null,
      fix: `Meta Business Suite → Settings → Brand safety → Domains → add ${host}. Either add Meta's TXT record at your domain provider, or choose Meta-tag verification and paste the content value into META_DOMAIN_VERIFICATION on Render. Then press Verify.`,
    },
    { label: "Contact details on the website", ok: true, value: `contact@invtra.store · +${e.SUPPORT_WHATSAPP}` },
    { label: "Privacy Policy and Terms published", ok: true, value: `${e.APP_URL.replace(/\/$/, "")}/privacy · /terms` },
    {
      label: "The website describes how invitations are really sent",
      ok: true,
      value:
        e.WHATSAPP_PROVIDER === "cloud"
          ? "Says invitations come from INVTRA's WhatsApp Business account"
          : "Says hosts send from their own WhatsApp (INVTRA's number isn't connected)",
    },
  ];

  const [account, templates, optOuts] = await Promise.all([
    whatsappAccountStatus({ fresh: opts.fresh }),
    db.messageTemplate.findMany({
      select: { metaName: true, language: true, purpose: true, category: true, status: true, metaTemplateId: true, rejectedReason: true, buttons: true },
    }),
    db.whatsAppOptOut.count(),
  ]);

  const templateIssues: string[] = [];
  const firstContact = templates.filter((t) => t.purpose === "INVITATION" || t.purpose === "NUDGE");
  const utilityInvites = firstContact.filter((t) => t.category === "UTILITY");
  if (utilityInvites.length) {
    templateIssues.push(
      `${utilityInvites.length} invitation/reply-reminder template(s) are set to Utility. Meta treats invitations as Marketing (they start a conversation the guest didn't ask for) and rejects or re-categorises them — submit them as Marketing.`,
    );
  }
  const noStop = firstContact.filter((t) => !(Array.isArray(t.buttons) && t.buttons.some((b) => (b as { action?: string }).action === "STOP")));
  if (noStop.length) {
    templateIssues.push(`${noStop.length} invitation/reply-reminder template(s) have no "Stop messages" button, so guests can't opt out in one tap.`);
  }
  if (e.WHATSAPP_PROVIDER === "cloud") {
    const phantom = templates.filter((t) => t.status === "APPROVED" && (!t.metaTemplateId || t.metaTemplateId.startsWith("mock_")));
    if (phantom.length) templateIssues.push(`${phantom.length} template(s) are marked approved here but were never submitted to Meta. Re-submit them, or press "Sync status from Meta".`);
  }
  const rejected = templates.filter((t) => t.status === "REJECTED");
  for (const t of rejected) templateIssues.push(`${t.metaName} (${t.language}) was rejected: ${t.rejectedReason ?? "no reason given"}.`);

  const counts = templates.reduce<Record<string, number>>((m, t) => ((m[t.status] = (m[t.status] ?? 0) + 1), m), {});
  return { site, account, templates: { counts, issues: templateIssues, total: templates.length }, optOuts };
}

/** Plain-English explanation of each problem Meta reports. */
export const PROBLEM_TEXT: Record<WhatsAppAccountStatus["problems"][number], string> = {
  off: "INVTRA's WhatsApp number isn't connected (WHATSAPP_PROVIDER=off). Hosts send from their own WhatsApp and INVTRA sends nothing.",
  token_invalid: "Meta refused the access token. Create a permanent System User token with whatsapp_business_messaging and whatsapp_business_management, and update WHATSAPP_ACCESS_TOKEN.",
  unreachable: "Meta's Graph API couldn't be reached or returned an error. INVTRA won't send until it can confirm the account is ready.",
  number_not_connected: "The phone number isn't registered and connected to the Cloud API yet (or Meta has disconnected it).",
  name_not_approved: "The display name isn't approved. It must match the business name shown on invtra.store (e.g. INVTRA).",
  account_not_approved: "Meta hasn't approved the WhatsApp Business Account yet (account review).",
};
