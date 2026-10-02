/**
 * Plain-language reasons for WhatsApp delivery failures. Shared by the server (error
 * classification) and the dashboard (explaining failures to customers).
 * https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */

export type FailureReason =
  | "not_on_whatsapp"
  | "invalid_number"
  | "window_closed"
  | "opted_out"
  | "rate_limited"
  | "template_unavailable"
  | "configuration"
  | "unknown";

const BY_CODE: Record<number, FailureReason> = {
  131026: "not_on_whatsapp",
  100: "invalid_number",
  1013: "invalid_number",
  131021: "invalid_number",
  131030: "invalid_number",
  131047: "window_closed",
  131049: "opted_out",
  131050: "opted_out",
  4: "rate_limited",
  80007: "rate_limited",
  130429: "rate_limited",
  131048: "rate_limited",
  131056: "rate_limited",
  132000: "template_unavailable",
  132001: "template_unavailable",
  132005: "template_unavailable",
  132007: "template_unavailable",
  132012: "template_unavailable",
  132015: "template_unavailable",
  132016: "template_unavailable",
  132068: "template_unavailable",
  0: "configuration",
  3: "configuration",
  10: "configuration",
  190: "configuration",
  200: "configuration",
  131005: "configuration",
  133010: "configuration",
};

const REASONS: FailureReason[] = ["not_on_whatsapp", "invalid_number", "window_closed", "opted_out", "rate_limited", "template_unavailable", "configuration", "unknown"];

export function failureReason(code: number | null): FailureReason {
  return code === null ? "unknown" : (BY_CODE[code] ?? "unknown");
}

/** Accepts a stored reason ("not_on_whatsapp") or a numeric WhatsApp error code ("131026"). */
export function failureKey(value: string | null | undefined): FailureReason {
  if (!value) return "unknown";
  if ((REASONS as string[]).includes(value)) return value as FailureReason;
  return /^\d+$/.test(value) ? failureReason(Number(value)) : "unknown";
}
