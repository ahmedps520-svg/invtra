import type { EventType } from "@prisma/client";

/**
 * Where "Start with this design" leads: the new-invitation wizard with the design (and occasion)
 * already chosen — through sign-up first when the visitor isn't signed in.
 */
export function startHref(signedIn: boolean, opts: { theme?: string | null; occasion?: EventType | null } = {}): string {
  const q = new URLSearchParams();
  if (opts.theme) q.set("theme", opts.theme);
  if (opts.occasion && opts.occasion !== "OTHER") q.set("occasion", opts.occasion);
  if (opts.theme) q.set("product", "INVITATION");
  const target = `/dashboard/events/new${q.size ? `?${q.toString()}` : ""}`;
  return signedIn ? target : `/signup?next=${encodeURIComponent(target)}`;
}

/** How invitations reach guests on this deployment: INVTRA's WhatsApp number, or the host's own. */
export type SendingMode = "cloud" | "own";
