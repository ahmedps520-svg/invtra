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

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string; action: "ACCEPT" | "DECLINE" }
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
export function buttonPayload(action: "ACCEPT" | "DECLINE", token: string) {
  return `INVTRA|${action}|${token}`;
}

export function parseButtonPayload(payload: string | undefined | null): { action: "ACCEPT" | "DECLINE"; token: string } | null {
  if (!payload) return null;
  const m = payload.match(/^INVTRA\|(ACCEPT|DECLINE)\|([A-Z0-9]{6,16})$/);
  return m ? { action: m[1] as "ACCEPT" | "DECLINE", token: m[2] } : null;
}

export function isTemplateButtons(v: unknown): v is TemplateButton[] {
  return Array.isArray(v) && v.every((b) => b && typeof b === "object" && "type" in b && "text" in b);
}
