export const GUEST_STATUSES = ["PENDING", "MESSAGE_SENT", "ACCEPTED", "DECLINED", "INVITATION_SENT", "VIEWED", "QR_SCANNED", "FAILED"] as const;
export type GuestStatusKey = (typeof GUEST_STATUSES)[number];

/** A guest as returned by GET /api/events/[id]/guests (dates as ISO strings). */
export type GuestRow = {
  id: string;
  name: string;
  phone: string;
  groupName: string | null;
  allowedCount: number;
  attendingCount: number | null;
  locale: string | null;
  notes: string | null;
  status: GuestStatusKey;
  rsvpStatus: "PENDING" | "ACCEPTED" | "DECLINED";
  rsvpSource: "WHATSAPP" | "WEB" | "HOST" | null;
  deliveryStatus: string;
  deliveryError: string | null;
  deliveryErrorCode: string | null;
  requestSentAt: string | null;
  invitationSentAt: string | null;
  viewCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  scanCount: number;
  firstScannedAt: string | null;
  lastScannedAt: string | null;
  checkedInAt: string | null;
  checkedInCount: number | null;
  lastActivityAt: string;
  createdAt: string;
  invitationUrl: string | null;
};

export type GuestList = {
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<GuestStatusKey, number>>;
  guests: GuestRow[];
};

export type FailureKey =
  | "not_on_whatsapp"
  | "invalid_number"
  | "window_closed"
  | "opted_out"
  | "rate_limited"
  | "template_unavailable"
  | "configuration"
  | "unknown";

const KNOWN: FailureKey[] = ["not_on_whatsapp", "invalid_number", "window_closed", "opted_out", "rate_limited", "template_unavailable", "configuration"];

/** WhatsApp Cloud API error code → plain-language failure (mirrors src/server/whatsapp/errors.ts). */
const BY_CODE: Record<string, FailureKey> = {
  "131026": "not_on_whatsapp",
  "100": "invalid_number",
  "1013": "invalid_number",
  "131021": "invalid_number",
  "131030": "invalid_number",
  "131047": "window_closed",
  "131049": "opted_out",
  "131050": "opted_out",
  "4": "rate_limited",
  "80007": "rate_limited",
  "130429": "rate_limited",
  "131048": "rate_limited",
  "131056": "rate_limited",
  "132000": "template_unavailable",
  "132001": "template_unavailable",
  "132005": "template_unavailable",
  "132007": "template_unavailable",
  "132012": "template_unavailable",
  "132015": "template_unavailable",
  "132016": "template_unavailable",
  "132068": "template_unavailable",
  "0": "configuration",
  "3": "configuration",
  "10": "configuration",
  "190": "configuration",
  "200": "configuration",
  "131005": "configuration",
  "133010": "configuration",
};

/** Accepts either a failure reason ("not_on_whatsapp") or a numeric WhatsApp error code. */
export function failureKey(code: string | null | undefined): FailureKey {
  if (!code) return "unknown";
  if ((KNOWN as string[]).includes(code)) return code as FailureKey;
  return BY_CODE[code] ?? "unknown";
}
