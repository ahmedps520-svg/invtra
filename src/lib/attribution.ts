/** Cookies that remember where a visitor came from (set in src/proxy.ts). */

/** The latest discount code from a link (?code=…), applied at checkout. Readable by the page. */
export const CODE_COOKIE = "invtra_code";
/** The first source seen ("code:TIKTOK10", "invitation", "utm:tiktok"), saved on the account. */
export const SOURCE_COOKIE = "invtra_src";

/** A source value from a visitor's cookie, or null if it isn't one we set. ("staff" is only set by INVTRA.) */
export function cleanSource(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^(code:[A-Z0-9][A-Z0-9-]{2,29}|invitation|utm:[a-z0-9_.-]{1,40})$/.test(value) ? value : null;
}
