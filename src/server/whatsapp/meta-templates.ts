import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MessageTemplate, TemplateStatus } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { isTemplateButtons, type TemplateButton, type TemplateVariable } from "@/lib/whatsapp/templates";

/**
 * WhatsApp message-template management through the Meta Graph API.
 *
 *   submit — POST /{WABA_ID}/message_templates (or POST /{template_id} to edit a
 *            rejected/draft template Meta already knows) → status PENDING.
 *   sync   — GET /{WABA_ID}/message_templates (all pages) → status, id and rejection
 *            reason copied onto the rows with the same (name, language).
 *
 * IMAGE headers need an example image, uploaded through the Resumable Upload API of the
 * Meta app (WHATSAPP_APP_ID) to obtain a `header_handle`.
 *
 * With WHATSAPP_PROVIDER=mock nothing is sent to Meta: submit approves the template
 * immediately (clearly reported as simulated) and sync is a no-op.
 */

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly code: number | null,
    public readonly httpStatus: number | null,
    public readonly subcode: number | null = null,
    public readonly fbtraceId: string | null = null,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

type GraphErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number; error_user_title?: string; error_user_msg?: string; fbtrace_id?: string };
};

function graphBase() {
  return `https://graph.facebook.com/${env().WHATSAPP_API_VERSION}`;
}

function requireCloudConfig(...keys: ("WHATSAPP_ACCESS_TOKEN" | "WHATSAPP_BUSINESS_ACCOUNT_ID" | "WHATSAPP_APP_ID")[]) {
  const e = env();
  const missing = keys.filter((k) => !e[k]);
  if (missing.length) throw new MetaGraphError(`Missing configuration: ${missing.join(", ")}`, null, null);
  return e;
}

async function graph<T>(url: string, init: RequestInit & { auth?: "bearer" | "oauth" | "none" } = {}): Promise<T> {
  const token = env().WHATSAPP_ACCESS_TOKEN ?? "";
  const auth = init.auth ?? "bearer";
  const headers = new Headers(init.headers);
  if (auth === "bearer") headers.set("Authorization", `Bearer ${token}`);
  if (auth === "oauth") headers.set("Authorization", `OAuth ${token}`);
  let res: Response;
  try {
    res = await fetch(url.startsWith("http") ? url : `${graphBase()}${url}`, { ...init, headers, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new MetaGraphError(`Could not reach the Meta Graph API: ${(e as Error).message}`, null, null);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const err = (json as GraphErrorBody | null)?.error;
    const human = err?.error_user_msg ? `${err.error_user_title ? `${err.error_user_title}: ` : ""}${err.error_user_msg}` : (err?.message ?? `HTTP ${res.status}`);
    throw new MetaGraphError(human, err?.code ?? null, res.status, err?.error_subcode ?? null, err?.fbtrace_id ?? null);
  }
  return json as T;
}

// ── Components ──────────────────────────────────────────────────────────────

/** Example values Meta reviewers see for each variable. */
export const SAMPLE_VALUES: Record<TemplateVariable, string> = {
  guest_name: "Khalid",
  host_names: "Ahmed & Sara",
  host_names_ar: "أحمد وسارة",
  event_name: "The Wedding of Ahmed & Sara",
  event_name_ar: "حفل زفاف أحمد وسارة",
  event_date: "Saturday, 12 December 2026",
  event_date_ar: "السبت ١٢ ديسمبر ٢٠٢٦",
  event_time: "7:30 PM",
  event_time_ar: "٧:٣٠ م",
  venue: "The Grand Ballroom, Four Seasons",
  venue_ar: "القاعة الكبرى، فور سيزونز",
  invitation_token: "8F3K92QXHT",
  customer_name: "Sara",
  package_amount: "SAR 2,500",
  receipt_number: "INVTRA-2026-0042",
};

type Component =
  | { type: "HEADER"; format: "IMAGE"; example: { header_handle: string[] } }
  | { type: "BODY"; text: string; example?: { body_text: string[][] } }
  | { type: "FOOTER"; text: string }
  | { type: "BUTTONS"; buttons: ({ type: "QUICK_REPLY"; text: string } | { type: "URL"; text: string; url: string; example?: string[] })[] };

export function buildTemplateComponents(
  t: Pick<MessageTemplate, "headerType" | "body" | "variables" | "footer" | "buttons">,
  headerHandle?: string | null,
): Component[] {
  const components: Component[] = [];
  if (t.headerType === "IMAGE") {
    if (!headerHandle) throw new MetaGraphError("An example image handle is required for an IMAGE header", null, null);
    components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [headerHandle] } });
  }
  const variables = (Array.isArray(t.variables) ? t.variables : []) as TemplateVariable[];
  components.push({
    type: "BODY",
    text: t.body,
    ...(variables.length ? { example: { body_text: [variables.map((v) => SAMPLE_VALUES[v] ?? v)] } } : {}),
  });
  if (t.footer) components.push({ type: "FOOTER", text: t.footer });
  const buttons: TemplateButton[] = isTemplateButtons(t.buttons) ? t.buttons : [];
  if (buttons.length) {
    components.push({
      type: "BUTTONS",
      buttons: buttons.map((b) =>
        b.type === "QUICK_REPLY"
          ? { type: "QUICK_REPLY" as const, text: b.text }
          : { type: "URL" as const, text: b.text, url: b.url, ...(b.url.includes("{{1}}") ? { example: [b.url.replace("{{1}}", SAMPLE_VALUES.invitation_token)] } : {}) },
      ),
    });
  }
  return components;
}

// ── Example header image (Resumable Upload API) ─────────────────────────────

/** Upload INVTRA's brand image as the example header and return the `h` handle. */
export async function uploadSampleHeaderImage(file = path.join(process.cwd(), "public/brand/icon-512.png")): Promise<string> {
  const e = requireCloudConfig("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_APP_ID");
  const bytes = await readFile(file);
  const q = new URLSearchParams({
    file_name: path.basename(file),
    file_length: String(bytes.length),
    file_type: "image/png",
    access_token: e.WHATSAPP_ACCESS_TOKEN!,
  });
  const session = await graph<{ id?: string }>(`/${e.WHATSAPP_APP_ID}/uploads?${q}`, { method: "POST", auth: "none" });
  if (!session.id) throw new MetaGraphError("Meta did not return an upload session id", null, 200);
  const uploaded = await graph<{ h?: string }>(`/${session.id}`, {
    method: "POST",
    auth: "oauth",
    headers: { file_offset: "0", "Content-Type": "application/octet-stream" },
    body: new Uint8Array(bytes),
  });
  if (!uploaded.h) throw new MetaGraphError("Meta did not return a header handle for the example image", null, 200);
  return uploaded.h;
}

// ── Submit ──────────────────────────────────────────────────────────────────

const META_STATUS: Record<string, TemplateStatus> = {
  APPROVED: "APPROVED",
  PENDING: "PENDING",
  IN_APPEAL: "PENDING",
  REJECTED: "REJECTED",
  PAUSED: "PAUSED",
  LIMIT_EXCEEDED: "PAUSED",
  DISABLED: "DISABLED",
  PENDING_DELETION: "DISABLED",
  DELETED: "DISABLED",
  ARCHIVED: "DISABLED",
};

export function mapMetaStatus(status: string | undefined | null): TemplateStatus | null {
  return status ? (META_STATUS[status.toUpperCase()] ?? null) : null;
}

export type SubmitResult = { template: MessageTemplate; simulated: boolean; edited: boolean };

export async function submitTemplateToMeta(template: MessageTemplate): Promise<SubmitResult> {
  if (env().WHATSAPP_PROVIDER === "mock") {
    const updated = await db.messageTemplate.update({
      where: { id: template.id },
      data: {
        status: "APPROVED",
        metaTemplateId: template.metaTemplateId ?? `mock_${randomBytes(8).toString("hex")}`,
        rejectedReason: null,
        lastSyncedAt: new Date(),
      },
    });
    return { template: updated, simulated: true, edited: false };
  }

  const e = requireCloudConfig("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_BUSINESS_ACCOUNT_ID");
  const handle = template.headerType === "IMAGE" ? await uploadSampleHeaderImage() : null;
  const components = buildTemplateComponents(template, handle);

  // A template Meta already knows (rejected, or created earlier) is edited in place —
  // creating it again would fail because the name + language already exist.
  const edited = Boolean(template.metaTemplateId && !template.metaTemplateId.startsWith("mock_"));
  const res = edited
    ? await graph<{ success?: boolean; id?: string; status?: string; category?: string }>(`/${template.metaTemplateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: template.category, components }),
      })
    : await graph<{ id?: string; status?: string; category?: string }>(`/${e.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: template.metaName, language: template.language, category: template.category, components }),
      });

  const updated = await db.messageTemplate.update({
    where: { id: template.id },
    data: {
      status: mapMetaStatus(res.status) ?? "PENDING",
      metaTemplateId: res.id ?? template.metaTemplateId,
      category: res.category ?? template.category,
      rejectedReason: null,
      lastSyncedAt: new Date(),
    },
  });
  return { template: updated, simulated: false, edited };
}

// ── Sync ────────────────────────────────────────────────────────────────────

export type RemoteTemplate = { id: string; name: string; status?: string; language?: string; category?: string; rejected_reason?: string };

export async function fetchRemoteTemplates(): Promise<RemoteTemplate[]> {
  const e = requireCloudConfig("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_BUSINESS_ACCOUNT_ID");
  const out: RemoteTemplate[] = [];
  let next: string | null = `/${e.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,status,language,category,rejected_reason&limit=100`;
  for (let page = 0; next && page < 50; page++) {
    const r: { data?: RemoteTemplate[]; paging?: { next?: string } } = await graph(next);
    out.push(...(r.data ?? []));
    next = r.paging?.next ?? null;
  }
  return out;
}

export type SyncResult = {
  simulated: boolean;
  remote: number;
  matched: number;
  changed: { id: string; name: string; from: TemplateStatus; to: TemplateStatus }[];
  /** Templates in WhatsApp Manager that INVTRA doesn't have. */
  remoteOnly: string[];
  /** Submitted/approved INVTRA templates Meta no longer lists. */
  missingAtMeta: string[];
};

export async function syncTemplatesFromMeta(): Promise<SyncResult> {
  if (env().WHATSAPP_PROVIDER === "mock") {
    return { simulated: true, remote: 0, matched: 0, changed: [], remoteOnly: [], missingAtMeta: [] };
  }
  const remote = await fetchRemoteTemplates();
  const local = await db.messageTemplate.findMany();
  const key = (name: string, lang: string) => `${name}::${lang}`;
  const byKey = new Map(local.map((t) => [key(t.metaName, t.language), t]));
  const seen = new Set<string>();
  const result: SyncResult = { simulated: false, remote: remote.length, matched: 0, changed: [], remoteOnly: [], missingAtMeta: [] };
  const now = new Date();

  for (const r of remote) {
    const k = key(r.name, r.language ?? "");
    const t = byKey.get(k);
    if (!t) {
      result.remoteOnly.push(`${r.name} (${r.language ?? "?"})`);
      continue;
    }
    seen.add(k);
    result.matched++;
    const status = mapMetaStatus(r.status) ?? t.status;
    const rejectedReason = status === "REJECTED" && r.rejected_reason && r.rejected_reason !== "NONE" ? r.rejected_reason : null;
    await db.messageTemplate.update({
      where: { id: t.id },
      data: { status, metaTemplateId: r.id, rejectedReason, category: r.category ?? t.category, lastSyncedAt: now },
    });
    if (status !== t.status) result.changed.push({ id: t.id, name: t.name, from: t.status, to: status });
  }
  for (const t of local) {
    if (!seen.has(key(t.metaName, t.language)) && t.status !== "DRAFT" && t.metaTemplateId && !t.metaTemplateId.startsWith("mock_")) {
      result.missingAtMeta.push(`${t.metaName} (${t.language})`);
    }
  }
  return result;
}
