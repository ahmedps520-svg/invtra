import { failureReason, type FailureReason } from "@/server/whatsapp/errors";

/** Plain-English explanation of a WhatsApp delivery failure, for staff. */
export const FAILURE_TEXT: Record<FailureReason, string> = {
  not_on_whatsapp: "The number isn't registered on WhatsApp.",
  invalid_number: "The phone number is invalid or can't receive messages.",
  window_closed: "Outside the 24-hour window — only an approved template can be sent.",
  opted_out: "The guest blocked or opted out of business messages.",
  rate_limited: "WhatsApp throttled sending (rate or pair limit). Retrying later usually works.",
  template_unavailable: "The template is missing, paused, rejected or its parameters don't match.",
  configuration: "Account or credentials problem (token, phone number, permissions) — affects every message.",
  unknown: "WhatsApp did not deliver the message (no specific reason given).",
};

const REASONS = new Set(Object.keys(FAILURE_TEXT));

/**
 * Accepts either a stored reason ("not_on_whatsapp") or a numeric Cloud API error code
 * ("131026") and returns "explanation (code)".
 */
export function failureExplanation(reasonOrCode: string | null | undefined, code?: string | null): string {
  let reason: FailureReason = "unknown";
  if (reasonOrCode && REASONS.has(reasonOrCode)) reason = reasonOrCode as FailureReason;
  else if (reasonOrCode && /^\d+$/.test(reasonOrCode)) reason = failureReason(Number(reasonOrCode));
  else if (code && /^\d+$/.test(code)) reason = failureReason(Number(code));
  const c = code ?? (reasonOrCode && /^\d+$/.test(reasonOrCode) ? reasonOrCode : null);
  return c ? `${FAILURE_TEXT[reason]} (code ${c})` : FAILURE_TEXT[reason];
}

export function failureReasonOf(errorCode: string | null | undefined): FailureReason {
  if (!errorCode) return "unknown";
  if (REASONS.has(errorCode)) return errorCode as FailureReason;
  return /^\d+$/.test(errorCode) ? failureReason(Number(errorCode)) : "unknown";
}
