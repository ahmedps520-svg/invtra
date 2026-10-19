import type { Metadata } from "next";
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { env } from "@/server/env";
import { metaReadiness, PROBLEM_TEXT, type Check } from "@/server/admin/meta-readiness";
import { AdminAction } from "@/components/admin/actions";
import { KeyValues, Muted, PageHeader, SectionTitle, StatusBadge } from "@/components/admin/ui";
import { rel } from "@/components/admin/format";

export const metadata: Metadata = { title: "WhatsApp & Meta" };

/**
 * Admin → WhatsApp & Meta: why Meta might reject INVTRA's business verification and what to fix,
 * whether INVTRA's WhatsApp account can send (as Meta reports it), and the steps that can only be
 * done in Meta Business Suite.
 */
export default async function WhatsAppSetupPage() {
  await requireAdmin();
  const e = env();
  const r = await metaReadiness();
  const a = r.account;
  const siteOk = r.site.every((c) => c.ok);

  return (
    <>
      <PageHeader
        eyebrow="WhatsApp"
        title="WhatsApp & Meta"
        description="What Meta checks before it verifies INVTRA's business and lets its WhatsApp number send — and what's still missing."
        actions={<AdminAction url="/api/admin/whatsapp/status" label="Check with Meta again" icon={<RefreshCw className="size-3.5" />} />}
      />

      <section className="mb-10">
        <SectionTitle
          title="The website Meta reviews"
          description="Meta compares invtra.store with your Commercial Registration. The business name, registration number and address must appear on the site exactly as on the document, and the domain must be verified in Meta Business Suite."
        />
        <Checklist items={r.site} />
        {!siteOk ? (
          <p className="mt-3 text-[13px] text-rosewood">
            The site doesn&apos;t show everything Meta needs yet. A verification submitted now is likely to be rejected for not matching the documents.
          </p>
        ) : null}
      </section>

      <section className="mb-10">
        <SectionTitle
          title="INVTRA's WhatsApp account"
          description={
            a.mode === "cloud"
              ? `As Meta reports it — checked ${rel(new Date(a.checkedAt))}. INVTRA sends nothing while any problem below remains.`
              : a.mode === "off"
                ? "Not connected: hosts send invitations from their own WhatsApp, and INVTRA sends no WhatsApp messages."
                : "Mock mode: messages are simulated in development and nothing reaches Meta."
          }
        />
        <div className="rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft sm:px-6">
          <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
            {a.ok ? <CheckCircle2 className="size-4 text-sage" /> : <XCircle className="size-4 text-rosewood" />}
            {a.ok ? "Allowed to send" : "Not sending"}
          </p>
          {a.problems.length ? (
            <ul className="mt-3 space-y-1.5 text-[13.5px] text-ink-soft">
              {a.problems.map((p) => (
                <li key={p}>• {PROBLEM_TEXT[p]}</li>
              ))}
            </ul>
          ) : null}
          {a.error ? <p className="mt-2 text-[12.5px] text-ink-faint">Meta said: {a.error}</p> : null}
          {a.mode === "cloud" ? (
            <KeyValues
              className="mt-5"
              items={[
                { label: "Number", value: a.phone?.display ?? <Muted>—</Muted> },
                { label: "Display name", value: a.phone?.verifiedName ? `${a.phone.verifiedName}` : <Muted>—</Muted> },
                { label: "Display name review", value: a.phone?.nameStatus ? <StatusBadge status={a.phone.nameStatus} /> : <Muted>—</Muted> },
                { label: "Number status", value: a.phone?.status ? <StatusBadge status={a.phone.status} /> : <Muted>—</Muted> },
                { label: "Quality rating", value: a.phone?.quality ?? <Muted>—</Muted> },
                { label: "Messaging limit", value: a.phone?.limitTier ?? <Muted>—</Muted> },
                { label: "WhatsApp account review", value: a.account?.reviewStatus ? <StatusBadge status={a.account.reviewStatus} /> : <Muted>—</Muted> },
                {
                  label: "Business verification",
                  value: a.account?.businessVerification ? (
                    <span>
                      <StatusBadge status={a.account.businessVerification} />{" "}
                      <Muted>(unverified businesses can still message a limited number of people a day)</Muted>
                    </span>
                  ) : (
                    <Muted>Not reported by Meta — see Business Suite → Security Centre</Muted>
                  ),
                },
                { label: "Business account ID", value: e.WHATSAPP_BUSINESS_ACCOUNT_ID ?? <Muted>—</Muted> },
              ]}
            />
          ) : null}
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle
          title="Message templates"
          description={`${r.templates.total} templates · ${Object.entries(r.templates.counts)
            .map(([k, n]) => `${n} ${k.toLowerCase()}`)
            .join(" · ")} · ${r.optOuts} number(s) have opted out of messages`}
        />
        {r.templates.issues.length ? (
          <ul className="space-y-2 rounded-2xl border border-ochre/30 bg-ochre-soft px-5 py-4 text-[13.5px] text-ink-soft">
            {r.templates.issues.map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-ink-soft">No problems found.</p>
        )}
      </section>

      <section>
        <SectionTitle title="Steps only you can do in Meta Business Suite" description="In this order. INVTRA can't do these for you — they need your Meta login and your documents." />
        <ol className="space-y-3 rounded-2xl border border-line bg-paper px-5 py-5 text-[13.5px] leading-relaxed text-ink-soft shadow-soft sm:px-6">
          <Step n={1} title="Read Meta's reason for the rejection">
            Business Suite → Settings → Security Centre (or Business info) → Business verification. Meta names the exact problem — usually documents or website not
            matching. Fix that first.
          </Step>
          <Step n={2} title="Make the website match your Commercial Registration">
            On Render → Environment, set LEGAL_ENTITY_NAME, LEGAL_CR_NUMBER and LEGAL_ADDRESS exactly as on the registration (and LEGAL_VAT_NUMBER if registered),
            then redeploy. The first card on this page turns green when they show on the site.
          </Step>
          <Step n={3} title="Verify the domain">
            Business Suite → Settings → Brand safety → Domains → Add <strong>invtra.store</strong> → Meta-tag verification. Put the tag&apos;s content value in
            META_DOMAIN_VERIFICATION on Render, redeploy, then press Verify.
          </Step>
          <Step n={4} title="Make Business info match too">
            Business Suite → Settings → Business info: legal name, address and phone exactly as on the documents, and website https://invtra.store.
          </Step>
          <Step n={5} title="Resubmit verification">
            Upload the Commercial Registration certificate. If Meta asks for proof of address or phone, use a utility bill or bank statement in the business&apos;s name.
          </Step>
          <Step n={6} title="Connect INVTRA's number (you can do this while verification is pending)">
            Add the number in WhatsApp Manager, request the display name <strong>INVTRA</strong> (it must match the site), register it, add a payment method, then
            set WHATSAPP_PROVIDER=cloud with the access token, phone number ID, business account ID and App Secret on Render. Subscribe the webhook (
            {e.APP_URL.replace(/\/$/, "")}/api/webhooks/whatsapp) to messages, message_template_status_update, account_update, phone_number_name_update and
            phone_number_quality_update.
          </Step>
          <Step n={7} title="Submit the templates">
            Admin → Templates → Submit. Invitations go in as Marketing with a &ldquo;Stop messages&rdquo; button; reminders, updates and payment messages as Utility.
          </Step>
        </ol>
        <p className="mt-3 text-[12.5px] text-ink-faint">
          <a href="https://business.facebook.com/settings/security" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
            Open Security Centre <ExternalLink className="size-3" />
          </a>
        </p>
      </section>
    </>
  );
}

function Checklist({ items }: { items: Check[] }) {
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-paper shadow-soft">
      {items.map((c) => (
        <li key={c.label} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
          {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rosewood" />}
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-ink">{c.label}</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">{c.ok ? (c.value ?? "Done") : c.fix}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sand text-[12px] font-medium text-ink tabular-nums">{n}</span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </li>
  );
}
