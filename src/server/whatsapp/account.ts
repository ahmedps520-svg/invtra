import { env } from "@/server/env";
import { getSetting, setSetting } from "@/server/settings";
import { logError } from "@/server/log";

/**
 * Whether INVTRA's WhatsApp Business account may send right now, as Meta reports it.
 *
 * Credentials being present isn't enough: the phone number must be registered and connected,
 * its display name approved, and the WhatsApp Business Account approved by Meta. The status is
 * read from the Graph API, cached for a few minutes (and in a setting, so every process and the
 * admin page see the same answer), and refreshed when Meta sends an account webhook.
 *
 * Business verification is reported but doesn't block sending: Meta lets an unverified business
 * message a limited number of people a day, and says so through the messaging limit.
 */

export type WhatsAppProblem =
  | "off" // not connected (hosts send from their own WhatsApp)
  | "token_invalid"
  | "unreachable"
  | "number_not_connected"
  | "name_not_approved"
  | "account_not_approved";

export interface WhatsAppAccountStatus {
  checkedAt: string;
  mode: "cloud" | "mock" | "off";
  /** Messages may be sent. */
  ok: boolean;
  problems: WhatsAppProblem[];
  phone: {
    display: string | null;
    verifiedName: string | null;
    status: string | null;
    nameStatus: string | null;
    codeVerification: string | null;
    quality: string | null;
    limitTier: string | null;
    platform: string | null;
  } | null;
  account: { name: string | null; reviewStatus: string | null; businessVerification: string | null } | null;
  error: string | null;
}

const SETTING = "whatsapp.status";
const TTL_MS = 5 * 60_000;
let memo: WhatsAppAccountStatus | null = null;

const NAME_OK = new Set(["APPROVED", "AVAILABLE_WITHOUT_REVIEW"]);
// A number that's FLAGGED or RESTRICTED can still send (Meta lowers its limits); these can't.
const NUMBER_BLOCKED = new Set(["PENDING", "DELETED", "MIGRATED", "BANNED", "DISCONNECTED", "UNVERIFIED", "OFFLINE"]);

/** Decides whether sending is allowed from what Meta returned. Exported for tests. */
export function judge(
  phone: WhatsAppAccountStatus["phone"],
  account: WhatsAppAccountStatus["account"],
): WhatsAppProblem[] {
  const problems: WhatsAppProblem[] = [];
  if (phone?.status && NUMBER_BLOCKED.has(phone.status)) problems.push("number_not_connected");
  if (phone?.nameStatus && !NAME_OK.has(phone.nameStatus)) problems.push("name_not_approved");
  if (account?.reviewStatus && account.reviewStatus !== "APPROVED") problems.push("account_not_approved");
  return problems;
}

type GraphError = { error?: { message?: string; code?: number } };

async function graph<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: GraphError["error"] }> {
  const e = env();
  const res = await fetch(`https://graph.facebook.com/${e.WHATSAPP_API_VERSION}${path}`, {
    headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  return res.ok ? { ok: true, data: json } : { ok: false, status: res.status, error: json.error };
}

/** Asks Meta. Never throws: an unreachable Graph API is reported as a problem. */
export async function fetchAccountStatus(): Promise<WhatsAppAccountStatus> {
  const e = env();
  const base = { checkedAt: new Date().toISOString(), phone: null, account: null, error: null };
  if (e.WHATSAPP_PROVIDER === "off") return { ...base, mode: "off", ok: false, problems: ["off"] };
  if (e.WHATSAPP_PROVIDER === "mock") return { ...base, mode: "mock", ok: true, problems: [] };

  try {
    const p = await graph<Record<string, unknown>>(
      `/${e.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,status,name_status,code_verification_status,quality_rating,messaging_limit_tier,platform_type`,
    );
    if (!p.ok) {
      const tokenBad = p.status === 401 || p.error?.code === 190;
      return { ...base, mode: "cloud", ok: false, problems: [tokenBad ? "token_invalid" : "unreachable"], error: p.error?.message ?? `HTTP ${p.status}` };
    }
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    const phone = {
      display: str(p.data.display_phone_number),
      verifiedName: str(p.data.verified_name),
      status: str(p.data.status),
      nameStatus: str(p.data.name_status),
      codeVerification: str(p.data.code_verification_status),
      quality: str(p.data.quality_rating),
      limitTier: str(p.data.messaging_limit_tier),
      platform: str(p.data.platform_type),
    };
    // Not every API version exposes business_verification_status on the account; fall back without it.
    let a = await graph<Record<string, unknown>>(`/${e.WHATSAPP_BUSINESS_ACCOUNT_ID}?fields=name,account_review_status,business_verification_status`);
    if (!a.ok && a.error?.code === 100) a = await graph<Record<string, unknown>>(`/${e.WHATSAPP_BUSINESS_ACCOUNT_ID}?fields=name,account_review_status`);
    const account = a.ok
      ? { name: str(a.data.name), reviewStatus: str(a.data.account_review_status), businessVerification: str(a.data.business_verification_status) }
      : null;
    const problems = judge(phone, account);
    if (!a.ok) problems.push(a.status === 401 || a.error?.code === 190 ? "token_invalid" : "unreachable");
    return { ...base, mode: "cloud", ok: problems.length === 0, problems, phone, account, error: a.ok ? null : (a.error?.message ?? null) };
  } catch (err) {
    return { ...base, mode: "cloud", ok: false, problems: ["unreachable"], error: (err as Error).message };
  }
}

/** The account status, from a recent check when there is one. */
export async function whatsappAccountStatus(opts: { fresh?: boolean } = {}): Promise<WhatsAppAccountStatus> {
  const mode = env().WHATSAPP_PROVIDER;
  const recent = (s: WhatsAppAccountStatus | null) => s && s.mode === mode && Date.now() - Date.parse(s.checkedAt) < TTL_MS;
  if (!opts.fresh) {
    if (recent(memo)) return memo!;
    const stored = await getSetting(SETTING, { fresh: true }).catch(() => null);
    const parsed = stored ? (JSON.parse(stored) as WhatsAppAccountStatus) : null;
    if (recent(parsed)) return (memo = parsed!);
  }
  const status = await fetchAccountStatus();
  memo = status;
  if (status.mode === "cloud") {
    await setSetting(SETTING, JSON.stringify(status)).catch(() => undefined);
    if (!status.ok) await logError("whatsapp:account", new Error(`WhatsApp can't send: ${status.problems.join(", ")}`), { error: status.error }, "warn");
  }
  return status;
}

/** Forget the cached status (Meta told us something changed). */
export async function invalidateAccountStatus() {
  memo = null;
  await setSetting(SETTING, null).catch(() => undefined);
}
