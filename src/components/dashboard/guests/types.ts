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

export { failureKey, type FailureReason as FailureKey } from "@/lib/whatsapp/failures";
