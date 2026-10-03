"use client";
import { EVENT_TYPES } from "@/lib/events/types";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { namedBody, TEMPLATE_VARIABLES, type TemplateButton, type TemplateVariable } from "@/lib/whatsapp/templates";
import { TemplatePreview } from "./template-preview";

export type TemplateFormValues = {
  id?: string;
  status?: string;
  rejectedReason?: string | null;
  /** Submitted to Meta: name + language can no longer change. */
  metaLocked?: boolean;
  name: string;
  nameAr: string;
  description: string;
  metaName: string;
  language: string;
  locale: string;
  purpose: "INVITATION" | "UPDATE" | "PAYMENT_REQUEST" | "PAYMENT_RECEIPT";
  category: string;
  headerType: string;
  body: string;
  variables: string[];
  footer: string;
  buttons: TemplateButton[];
  eventTypes: string[];
};

const LANGUAGES = [
  { value: "en", label: "English (en)" },
  { value: "en_US", label: "English US (en_US)" },
  { value: "en_GB", label: "English UK (en_GB)" },
  { value: "ar", label: "Arabic (ar)" },
];
const VARIABLE_LABEL: Record<TemplateVariable, string> = {
  guest_name: "Guest name",
  host_names: "Host names",
  host_names_ar: "Host names (Arabic)",
  event_name: "Event name",
  event_name_ar: "Event name (Arabic)",
  event_date: "Event date",
  event_date_ar: "Event date (Arabic)",
  event_time: "Event time",
  event_time_ar: "Event time (Arabic)",
  venue: "Venue",
  venue_ar: "Venue (Arabic)",
  invitation_token: "Invitation code",
  customer_name: "Customer (host) name",
  package_amount: "Package amount",
  receipt_number: "Receipt number",
};
const PREFERRED: TemplateVariable[] = ["guest_name", "host_names", "event_name", "event_date", "event_time", "venue"];

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function placeholderCount(body: string) {
  const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

export function emptyTemplate(): TemplateFormValues {
  return {
    name: "",
    nameAr: "",
    description: "",
    metaName: "invtra_",
    language: "en",
    locale: "en",
    purpose: "INVITATION",
    category: "UTILITY",
    headerType: "IMAGE",
    body: "Dear {{1}}, you are warmly invited to {{2}} on {{3}}.\n\nWould you like to accept this invitation?",
    variables: ["guest_name", "event_name", "event_date"],
    footer: "Sent with INVTRA",
    buttons: [
      { type: "QUICK_REPLY", text: "Accept Invitation", action: "ACCEPT" },
      { type: "QUICK_REPLY", text: "Decline", action: "DECLINE" },
    ],
    eventTypes: [...EVENT_TYPES],
  };
}

/** Create / edit a WhatsApp template (DRAFT or REJECTED only). */
export function TemplateEditor({ initial, appUrl, trigger }: { initial?: TemplateFormValues; appUrl: string; trigger?: "new" | "edit" }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const start = initial ?? emptyTemplate();
  const [f, setF] = useState<TemplateFormValues>(start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = Boolean(initial?.id);

  const qr = (action: "ACCEPT" | "DECLINE") => f.buttons.find((b) => b.type === "QUICK_REPLY" && b.action === action)?.text ?? "";
  const urlBtn = f.buttons.find((b) => b.type === "URL") as Extract<TemplateButton, { type: "URL" }> | undefined;
  const [acceptText, setAcceptText] = useState(qr("ACCEPT") || "Accept Invitation");
  const [declineText, setDeclineText] = useState(qr("DECLINE") || "Decline");
  const [urlText, setUrlText] = useState(urlBtn?.text ?? "View Invitation");
  const [url, setUrl] = useState(urlBtn?.url ?? `${appUrl.replace(/\/$/, "")}/i/{{1}}`);

  const set = <K extends keyof TemplateFormValues>(k: K, v: TemplateFormValues[K]) => setF((s) => ({ ...s, [k]: v }));

  const count = placeholderCount(f.body);
  const variables = useMemo(() => {
    const next = f.variables.slice(0, count);
    while (next.length < count) next.push(PREFERRED.find((p) => !next.includes(p)) ?? "guest_name");
    return next;
  }, [f.variables, count]);

  const buttons: TemplateButton[] =
    f.purpose === "INVITATION"
      ? [
          { type: "QUICK_REPLY", text: acceptText, action: "ACCEPT" },
          { type: "QUICK_REPLY", text: declineText, action: "DECLINE" },
        ]
      : [{ type: "URL", text: urlText, url }];

  function insertVariable(v: TemplateVariable) {
    const el = bodyRef.current;
    const n = count + 1;
    const token = `{{${n}}}`;
    const pos = el?.selectionStart ?? f.body.length;
    const before = f.body.slice(0, pos);
    const after = f.body.slice(el?.selectionEnd ?? pos);
    const pad = before && !/\s$/.test(before) ? " " : "";
    setF((s) => ({ ...s, body: `${before}${pad}${token}${after}`, variables: [...variables, v] }));
    requestAnimationFrame(() => {
      el?.focus();
      const at = pos + pad.length + token.length;
      el?.setSelectionRange(at, at);
    });
  }

  async function save() {
    setBusy(true);
    setErrors({});
    const payload = {
      name: f.name,
      nameAr: f.nameAr,
      description: f.description,
      metaName: f.metaName,
      language: f.language,
      locale: f.locale,
      purpose: f.purpose,
      category: f.category,
      headerType: f.headerType,
      body: f.body,
      variables,
      footer: f.footer,
      buttons,
      eventTypes: f.eventTypes,
    };
    try {
      const r = await api<{ message: string }>(isEdit ? `/api/admin/templates/${initial!.id}` : "/api/admin/templates", {
        method: isEdit ? "PATCH" : "POST",
        body: payload,
      });
      toast(r.message);
      setOpen(false);
      if (!isEdit) {
        setF(emptyTemplate());
      }
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(err.fields ?? {})) {
        if (k === "buttons.0.text") fields[f.purpose === "INVITATION" ? "acceptText" : "urlText"] = v;
        else if (k === "buttons.1.text") fields.declineText = v;
        else if (k === "buttons.0.url") fields.url = v;
        else if (k.startsWith("variables")) fields.variables = v.startsWith("Invalid enum") ? "Choose a variable for every placeholder" : v;
        else fields[k] = v;
      }
      if (!err.fields) fields._ = err.message;
      setErrors(fields);
    } finally {
      setBusy(false);
    }
  }

  const section = (title: string, children: ReactNode) => (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">{title}</legend>
      {children}
    </fieldset>
  );

  return (
    <>
      {trigger === "edit" ? (
        <Button variant="outline" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setOpen(true)}>
          Edit
        </Button>
      ) : (
        <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
          New template
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={isEdit ? `Edit “${initial!.name}”` : "New WhatsApp template"}
        description="Saved as a draft. Meta reviews the template after you submit it."
        size="full"
        footer={
          <>
            {Object.keys(errors).length ? (
              <p className="me-auto flex items-center gap-1.5 text-[13px] text-rosewood">
                <AlertCircle className="size-4" aria-hidden="true" /> {errors._ ?? "Please fix the highlighted fields."}
              </p>
            ) : null}
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={busy}>
              {isEdit ? "Save changes" : "Save draft"}
            </Button>
          </>
        }
      >
        {initial?.status === "REJECTED" && initial.rejectedReason ? (
          <p className="mb-5 rounded-xl border border-rosewood/20 bg-rosewood-soft px-4 py-3 text-sm text-rosewood">
            Meta rejected this template: <strong className="font-medium">{initial.rejectedReason}</strong>. Edit and submit it again.
          </p>
        ) : null}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            {section(
              "Identity",
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="t-name" label="Display name" error={errors.name}>
                    <Input id="t-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Formal Wedding" aria-invalid={Boolean(errors.name)} />
                  </Field>
                  <Field id="t-name-ar" label="Arabic name" optional="(optional)" error={errors.nameAr}>
                    <Input id="t-name-ar" dir="rtl" lang="ar" value={f.nameAr} onChange={(e) => set("nameAr", e.target.value)} placeholder="زفاف رسمي" />
                  </Field>
                </div>
                <Field id="t-desc" label="Description" optional="(shown to customers)" error={errors.description}>
                  <Input id="t-desc" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="A classic wedding invitation with Accept / Decline buttons." />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="t-meta" label="Meta template name" error={errors.metaName} hint={f.metaLocked ? "Locked — Meta doesn't allow renaming a submitted template." : "lowercase_with_underscores"}>
                    <Input
                      id="t-meta"
                      value={f.metaName}
                      disabled={f.metaLocked}
                      onChange={(e) => set("metaName", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                      className="tabular-nums"
                      aria-invalid={Boolean(errors.metaName)}
                    />
                  </Field>
                  <Field id="t-lang" label="WhatsApp language" error={errors.language}>
                    <Select id="t-lang" value={f.language} disabled={f.metaLocked} onChange={(e) => set("language", e.target.value)}>
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field id="t-purpose" label="Purpose">
                    <Select id="t-purpose" value={f.purpose} onChange={(e) => set("purpose", e.target.value as TemplateFormValues["purpose"])}>
                      <option value="INVITATION">Invitation</option>
                      <option value="UPDATE">Update</option>
                      <option value="PAYMENT_REQUEST">Payment request</option>
                      <option value="PAYMENT_RECEIPT">Payment receipt</option>
                    </Select>
                  </Field>
                  <Field id="t-locale" label="Serves">
                    <Select id="t-locale" value={f.locale} onChange={(e) => set("locale", e.target.value)}>
                      <option value="en">English events</option>
                      <option value="ar">Arabic events</option>
                      <option value="bilingual">Bilingual events</option>
                    </Select>
                  </Field>
                  <Field id="t-cat" label="Category">
                    <Select id="t-cat" value={f.category} onChange={(e) => set("category", e.target.value)}>
                      <option value="UTILITY">Utility</option>
                      <option value="MARKETING">Marketing</option>
                    </Select>
                  </Field>
                  <Field id="t-header" label="Header">
                    <Select id="t-header" value={f.headerType} onChange={(e) => set("headerType", e.target.value)}>
                      <option value="IMAGE">Invitation image</option>
                      <option value="NONE">None</option>
                    </Select>
                  </Field>
                </div>
              </>,
            )}

            {section(
              "Message",
              <>
                <Field
                  id="t-body"
                  label="Body"
                  error={errors.body}
                  hint="Use {{1}}, {{2}} … for variables. Variables can't start or end the message or sit next to each other."
                >
                  <Textarea
                    id="t-body"
                    ref={bodyRef}
                    rows={6}
                    dir="auto"
                    maxLength={1024}
                    value={f.body}
                    onChange={(e) => set("body", e.target.value)}
                    aria-invalid={Boolean(errors.body)}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] text-ink-faint">Insert variable:</span>
                  {PREFERRED.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[12px] text-ink-soft transition hover:border-bronze-300 hover:text-ink"
                    >
                      + {VARIABLE_LABEL[v]}
                    </button>
                  ))}
                </div>
                {count ? (
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-ink-soft">Variable mapping</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {variables.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-12 shrink-0 text-[13px] tabular-nums text-ink-faint">{`{{${i + 1}}}`}</span>
                          <Select
                            aria-label={`Variable ${i + 1}`}
                            value={v}
                            onChange={(e) => {
                              const next = [...variables];
                              next[i] = e.target.value;
                              set("variables", next);
                            }}
                            className="h-10 text-sm"
                          >
                            {TEMPLATE_VARIABLES.map((tv) => (
                              <option key={tv} value={tv}>
                                {VARIABLE_LABEL[tv]}
                              </option>
                            ))}
                          </Select>
                        </div>
                      ))}
                    </div>
                    {errors.variables ? <p className="mt-1.5 text-[13px] text-rosewood">{errors.variables}</p> : null}
                  </div>
                ) : null}
                <Field id="t-footer" label="Footer" optional={`(${f.footer.length}/60)`} error={errors.footer}>
                  <Input id="t-footer" dir="auto" maxLength={60} value={f.footer} onChange={(e) => set("footer", e.target.value)} />
                </Field>
              </>,
            )}

            {section(
              "Buttons",
              f.purpose === "INVITATION" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="t-accept" label="Accept button" optional={`(${acceptText.length}/25)`} error={errors.acceptText}>
                    <Input id="t-accept" dir="auto" maxLength={25} value={acceptText} onChange={(e) => setAcceptText(e.target.value)} />
                  </Field>
                  <Field id="t-decline" label="Decline button" optional={`(${declineText.length}/25)`} error={errors.declineText}>
                    <Input id="t-decline" dir="auto" maxLength={25} value={declineText} onChange={(e) => setDeclineText(e.target.value)} />
                  </Field>
                  {errors.buttons ? <p className="text-[13px] text-rosewood sm:col-span-2">{errors.buttons}</p> : null}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                  <Field id="t-urltext" label="Button text" optional={`(${urlText.length}/25)`} error={errors.urlText}>
                    <Input id="t-urltext" dir="auto" maxLength={25} value={urlText} onChange={(e) => setUrlText(e.target.value)} />
                  </Field>
                  <Field id="t-url" label="Link" error={errors.url ?? errors.buttons} hint={f.purpose === "UPDATE" ? "Must end with {{1}} — replaced by the guest's invitation code." : "Must end with {{1}} — replaced by the payment-link code (…/pay/{{1}})."}>
                    <Input id="t-url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} className="tabular-nums" />
                  </Field>
                </div>
              ),
            )}

            {section(
              "Offered for",
              <>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {EVENT_TYPES.map((t) => (
                    <Checkbox
                      key={t}
                      checked={f.eventTypes.includes(t)}
                      onChange={(c) => set("eventTypes", c ? [...f.eventTypes, t] : f.eventTypes.filter((x) => x !== t))}
                      label={titleCase(t)}
                    />
                  ))}
                </div>
                {errors.eventTypes ? <p className="text-[13px] text-rosewood">{errors.eventTypes}</p> : null}
              </>,
            )}
          </div>

          <aside className="lg:sticky lg:top-0 lg:self-start">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-faint">Preview</p>
            <TemplatePreview
              headerType={f.headerType}
              namedBody={namedBody({ body: f.body, variables: variables as TemplateVariable[] })}
              footer={f.footer}
              buttons={buttons.map((b) => ({ type: b.type, text: b.text }))}
            />
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
              Highlighted names are filled in per guest when the message is sent. Meta reviewers see sample values.
            </p>
          </aside>
        </div>
      </Dialog>
    </>
  );
}
