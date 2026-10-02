/**
 * WhatsApp Cloud API error classification.
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

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public readonly code: number | null,
    public readonly httpStatus: number | null,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
  get retryable(): boolean {
    return isRetryable(this.code, this.httpStatus);
  }
  get reason(): FailureReason {
    return failureReason(this.code);
  }
  /** Affects every message (bad token, template paused...), not just this recipient. */
  get systemic(): boolean {
    return isSystemic(this.code);
  }
}

const RETRYABLE = new Set([1, 2, 4, 17, 341, 80007, 130429, 131000, 131016, 131048, 131056, 133004, 133005]);
const SYSTEMIC = new Set([0, 3, 10, 190, 200, 131005, 131008, 131009, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 132068, 133010, 368]);

export function isRetryable(code: number | null, httpStatus: number | null): boolean {
  if (code !== null && RETRYABLE.has(code)) return true;
  if (code === null && (httpStatus === null || httpStatus >= 500 || httpStatus === 429)) return true;
  return httpStatus !== null && httpStatus >= 500 && (code === null || !SYSTEMIC.has(code));
}

export function isSystemic(code: number | null): boolean {
  return code !== null && SYSTEMIC.has(code);
}

export function failureReason(code: number | null): FailureReason {
  switch (code) {
    case 131026:
      return "not_on_whatsapp";
    case 100:
    case 1013:
    case 131021:
    case 131030:
      return "invalid_number";
    case 131047:
      return "window_closed";
    case 131049:
    case 131050:
      return "opted_out";
    case 4:
    case 80007:
    case 130429:
    case 131048:
    case 131056:
      return "rate_limited";
    case 132000:
    case 132001:
    case 132005:
    case 132007:
    case 132012:
    case 132015:
    case 132016:
    case 132068:
      return "template_unavailable";
    case 0:
    case 3:
    case 10:
    case 190:
    case 200:
    case 131005:
    case 133010:
      return "configuration";
    default:
      return "unknown";
  }
}
