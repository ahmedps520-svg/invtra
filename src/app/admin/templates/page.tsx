import type { Metadata } from "next";
import { RefreshCw, Send, Trash2 } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { env } from "@/server/env";
import { EDITABLE_STATUSES, listTemplates, type AdminTemplate } from "@/server/admin/templates";
import { AdminAction } from "@/components/admin/actions";
import { TemplateActiveSwitch } from "@/components/admin/template-active";
import { TemplateEditor, type TemplateFormValues } from "@/components/admin/template-editor";
import { TemplatePreview } from "@/components/admin/template-preview";
import { Muted, PageHeader, SectionTitle, StatusBadge, humanize } from "@/components/admin/ui";
import { dt, plural, rel } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";
import { isTemplateButtons, namedBody, type TemplateVariable } from "@/lib/whatsapp/templates";

export const metadata: Metadata = { title: "Message templates" };

const LOCALE: Record<string, string> = { en: "English", ar: "Arabic", bilingual: "Bilingual" };

function formValues(t: AdminTemplate): TemplateFormValues {
  return {
    id: t.id,
    status: t.status,
    rejectedReason: t.rejectedReason,
    metaLocked: Boolean(t.metaTemplateId && !t.metaTemplateId.startsWith("mock_")),
    name: t.name,
    nameAr: t.nameAr ?? "",
    description: t.description ?? "",
    metaName: t.metaName,
    language: t.language,
    locale: t.locale,
    purpose: t.purpose,
    category: t.category,
    headerType: t.headerType === "IMAGE" ? "IMAGE" : "NONE",
    body: t.body,
    variables: Array.isArray(t.variables) ? (t.variables as string[]) : [],
    footer: t.footer ?? "",
    buttons: isTemplateButtons(t.buttons) ? t.buttons : [],
    eventTypes: t.eventTypes,
  };
}

function TemplateCard({ t, appUrl, mock }: { t: AdminTemplate; appUrl: string; mock: boolean }) {
  const editable = (EDITABLE_STATUSES as readonly string[]).includes(t.status);
  const buttons = isTemplateButtons(t.buttons) ? t.buttons : [];
  const deletable = t.status === "DRAFT" && !(t.metaTemplateId && !t.metaTemplateId.startsWith("mock_"));
  return (
    <article className={`grid gap-5 rounded-2xl border border-line bg-paper p-5 shadow-soft md:grid-cols-[minmax(0,1fr)_300px] ${t.isActive ? "" : "opacity-80"}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-2xl leading-tight text-ink">{t.name}</h3>
          {t.nameAr ? (
            <span lang="ar" dir="rtl" className="text-sm text-ink-faint">
              {t.nameAr}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={t.status} />
          <Badge>{humanize(t.category)}</Badge>
          <Badge>{LOCALE[t.locale] ?? t.locale}</Badge>
          {!t.isActive ? <Badge tone="ochre">Disabled</Badge> : null}
        </div>
        {t.status === "REJECTED" && t.rejectedReason ? (
          <p className="mt-3 rounded-xl border border-rosewood/20 bg-rosewood-soft px-3 py-2 text-[13px] text-rosewood">Rejected: {humanize(t.rejectedReason)}</p>
        ) : null}
        {t.description ? <p dir="auto" className="mt-3 text-start text-sm text-ink-soft">{t.description}</p> : null}
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          <dt className="text-ink-faint">Meta name</dt>
          <dd className="break-all text-ink">
            {t.metaName} <span className="text-ink-faint">· {t.language}</span>
          </dd>
          <dt className="text-ink-faint">Variables</dt>
          <dd className="text-ink-soft">{(Array.isArray(t.variables) ? (t.variables as string[]) : []).map((v, i) => `{{${i + 1}}} ${v}`).join(" · ") || <Muted>None</Muted>}</dd>
          <dt className="text-ink-faint">Event types</dt>
          <dd className="text-ink-soft">{t.eventTypes.length === 6 ? "All" : t.eventTypes.map((e) => humanize(e)).join(", ")}</dd>
          <dt className="text-ink-faint">Meta id</dt>
          <dd className="break-all text-ink-soft">{t.metaTemplateId ?? <Muted>Not submitted</Muted>}</dd>
          <dt className="text-ink-faint">Last synced</dt>
          <dd className="text-ink-soft">{t.lastSyncedAt ? <span title={dt(t.lastSyncedAt)}>{rel(t.lastSyncedAt)}</span> : <Muted>Never</Muted>}</dd>
          <dt className="text-ink-faint">Chosen by</dt>
          <dd className="text-ink-soft">{t.events ? plural(t.events, "event") : <Muted>No events</Muted>}</dd>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <TemplateActiveSwitch id={t.id} isActive={t.isActive} />
          <span className="flex-1" />
          {editable ? <TemplateEditor trigger="edit" appUrl={appUrl} initial={formValues(t)} /> : null}
          {editable ? (
            <AdminAction
              url={`/api/admin/templates/${t.id}/submit`}
              label="Submit to Meta"
              variant="accent"
              icon={<Send className="size-3.5" />}
              confirm={{
                title: "Submit this template to Meta?",
                description: mock
                  ? "WhatsApp is in mock mode: the template is approved locally (simulated approval) and nothing is sent to Meta."
                  : "Meta reviews the template (usually minutes, up to 24 hours). It can't be edited while pending. Use “Sync status” to pull the result.",
                confirmLabel: mock ? "Approve (simulated)" : "Submit for review",
                tone: "accent",
              }}
            />
          ) : null}
          {deletable ? (
            <AdminAction
              url={`/api/admin/templates/${t.id}`}
              method="DELETE"
              label="Delete"
              variant="ghost"
              icon={<Trash2 className="size-3.5" />}
              confirm={{ title: "Delete this draft?", description: "The draft is removed permanently.", confirmLabel: "Delete draft", tone: "danger" }}
            />
          ) : null}
        </div>
      </div>
      <TemplatePreview
        headerType={t.headerType}
        namedBody={namedBody({ body: t.body, variables: (Array.isArray(t.variables) ? t.variables : []) as TemplateVariable[] })}
        footer={t.footer}
        buttons={buttons.map((b) => ({ type: b.type, text: b.text }))}
        className="self-start"
      />
    </article>
  );
}

export default async function TemplatesPage() {
  await requireAdmin();
  const templates = await listTemplates();
  const e = env();
  const mock = e.WHATSAPP_PROVIDER === "mock";
  const groups = [
    { purpose: "INVITATION", title: "Invitation requests", description: "First contact — the invitation with Accept / Decline buttons." },
    { purpose: "UPDATE", title: "Invitation updates", description: "Re-sends the invitation link when details change (works outside the 24-hour window)." },
  ] as const;
  const approved = templates.filter((t) => t.status === "APPROVED" && t.isActive);

  return (
    <>
      <PageHeader
        eyebrow="WhatsApp"
        title="Message templates"
        description={
          mock
            ? "WhatsApp is in mock mode — submitting approves templates locally (simulated) and nothing is sent to Meta."
            : `Templates are reviewed by Meta for WhatsApp Business Account ${e.WHATSAPP_BUSINESS_ACCOUNT_ID}. Only approved, enabled templates are used for sending.`
        }
        actions={
          <>
            <AdminAction url="/api/admin/templates/sync" label="Sync status from Meta" icon={<RefreshCw className="size-3.5" />} title={mock ? "No-op in mock mode" : undefined} />
            <TemplateEditor trigger="new" appUrl={e.APP_URL} />
          </>
        }
      />
      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-soft">
        <span>{plural(templates.length, "template")}</span>
        <span>{plural(approved.length, "approved & enabled template")}</span>
        {(["en", "ar", "bilingual"] as const).map((l) => {
          const has = approved.some((t) => t.purpose === "INVITATION" && (t.locale === l || (l === "bilingual" && t.locale === "ar")));
          return (
            <span key={l} className={has ? "" : "text-rosewood"}>
              {LOCALE[l]} invitations: {has ? "ready" : "no approved template"}
            </span>
          );
        })}
      </div>
      <div className="space-y-12">
        {groups.map((g) => {
          const list = templates.filter((t) => t.purpose === g.purpose);
          return (
            <section key={g.purpose}>
              <SectionTitle title={g.title} description={g.description} />
              <div className="space-y-4">
                {list.length ? (
                  list.map((t) => <TemplateCard key={t.id} t={t} appUrl={e.APP_URL} mock={mock} />)
                ) : (
                  <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-faint">No templates yet.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
