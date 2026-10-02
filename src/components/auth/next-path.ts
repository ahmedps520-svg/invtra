/**
 * Validate a post-auth redirect target from `?next=`. Only same-site absolute paths are
 * allowed: "/dashboard" yes; "//evil.com", "/\evil.com" and "https://…" no.
 */
export function safeNext(value: string | string[] | undefined | null, fallback: string): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || typeof v !== "string") return fallback;
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return fallback;
  for (let i = 0; i < v.length; i++) if (v.charCodeAt(i) < 0x20) return fallback;
  return v;
}

/** Append `?next=` to an auth link, keeping the target across login ⇄ signup. */
export function withNext(path: string, next: string | null | undefined, defaultNext: string): string {
  if (!next || next === defaultNext) return path;
  return `${path}?next=${encodeURIComponent(next)}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 10;
