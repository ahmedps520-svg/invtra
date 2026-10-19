/**
 * Message-template model shared by the dashboard (previews) and the server (sending).
 * WhatsApp templates are pre-approved by Meta; customers pick one and fill variables —
 * they cannot send arbitrary free text as a template.
 */

export const TEMPLATE_VARIABLES = [
  "guest_name",
  "host_names",
  "host_names_ar",
  "event_name",
  "event_name_ar",
  "event_date",
  "event_date_ar",
  "event_time",
  "event_time_ar",
  "venue",
  "venue_ar",
  "invitation_token",
  // Payment messages to a host (custom packages)
  "customer_name",
  "package_amount",
  "receipt_number",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** Variables the customer may override per event (the rest are computed). */
export const CUSTOMIZABLE_VARIABLES: TemplateVariable[] = [
  "host_names",
  "host_names_ar",
  "event_name",
  "event_name_ar",
  "venue",
  "venue_ar",
];

/** Quick-reply actions: answer the invitation, or ask INVTRA to stop sending messages. */
export type ReplyAction = "ACCEPT" | "DECLINE" | "STOP";

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string; action: ReplyAction }
  | { type: "URL"; text: string; url: string };

export interface TemplateShape {
  body: string;
  variables: TemplateVariable[];
  headerType: string;
  footer?: string | null;
  buttons: TemplateButton[];
}

/**
 * WhatsApp rejects parameters containing new lines, tabs or more than four
 * consecutive spaces; keep values short and single-line.
 */
export function sanitizeParam(value: string, max = 200): string {
  const v = value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return (v || "—").slice(0, max);
}

export function renderTemplateBody(template: Pick<TemplateShape, "body" | "variables">, values: Partial<Record<TemplateVariable, string>>): string {
  return template.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const name = template.variables[Number(n) - 1];
    return name ? sanitizeParam(values[name] ?? "") : "";
  });
}

/** "Dear {{1}}" → "Dear {guest_name}" for showing templates to customers/admins. */
export function namedBody(template: Pick<TemplateShape, "body" | "variables">): string {
  return template.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => `{${template.variables[Number(n) - 1] ?? n}}`);
}

/** Quick-reply payloads carry the action and the invitation token. */
export function buttonPayload(action: ReplyAction, token: string) {
  return `INVTRA|${action}|${token}`;
}

export function parseButtonPayload(payload: string | undefined | null): { action: ReplyAction; token: string } | null {
  if (!payload) return null;
  const m = payload.match(/^INVTRA\|(ACCEPT|DECLINE|STOP)\|([A-Z0-9]{6,16})$/);
  return m ? { action: m[1] as ReplyAction, token: m[2] } : null;
}

/** A plain reply asking to stop (or start again) receiving messages: "STOP", "إيقاف", "START"… */
export function optOutKeyword(text: string | undefined | null): "STOP" | "START" | null {
  const t = (text ?? "").trim().toLowerCase().replace(/[.!؟?]+$/, "");
  if (/^(stop|unsubscribe|stop messages|إيقاف|ايقاف|إيقاف الرسائل|ايقاف الرسائل|الغاء الاشتراك|إلغاء الاشتراك)$/.test(t)) return "STOP";
  if (/^(start|subscribe|تشغيل|اشتراك)$/.test(t)) return "START";
  return null;
}

export function isTemplateButtons(v: unknown): v is TemplateButton[] {
  return Array.isArray(v) && v.every((b) => b && typeof b === "object" && "type" in b && "text" in b);
}
