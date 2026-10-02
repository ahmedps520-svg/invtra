import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Initials for monograms / avatars: "Ahmed & Sara" → "A&S". */
export function monogramOf(names: string): string {
  const parts = names
    .split(/\s*(?:&|and|و)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${[...parts[0]][0] ?? ""}&${[...parts[1]][0] ?? ""}`.toUpperCase();
  const words = names.trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((w) => [...w][0] ?? "")
    .join("")
    .toUpperCase();
}

export function pluralize(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
