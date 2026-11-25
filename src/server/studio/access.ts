import type { Event, UploadKind } from "@prisma/client";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import type { InvitationDesign } from "@/lib/design/schema";
import { canvasUploadKeys, keepUploads } from "@/lib/canvas/doc";

/** Studio is INVTRA's own design tool: staff use it for custom events (Admin → Custom events). */
export function canUseStudio(user: Pick<SessionUser, "role">, event: Pick<Event, "custom">): boolean {
  return user.role === "ADMIN" && event.custom;
}

/** Files a Studio design may place: photos uploaded in Studio, and the event's own pictures (its uploaded artwork too). */
export const STUDIO_UPLOAD_KINDS: UploadKind[] = ["STUDIO", "BACKGROUND", "COVER", "LOGO", "CUSTOM_INVITATION"];

/**
 * The design as it may be saved or previewed: the Studio document can only be changed by staff on
 * a custom event (anyone else keeps the saved one), and it may only use this event's own files.
 */
export async function guardCanvas(
  user: Pick<SessionUser, "role">,
  event: Pick<Event, "id" | "custom">,
  design: InvitationDesign,
  saved: InvitationDesign,
): Promise<InvitationDesign> {
  const canvas = canUseStudio(user, event) ? design.canvas : saved.canvas;
  const keys = canvasUploadKeys(canvas);
  if (!keys.length) return { ...design, canvas };
  const rows = await db.upload.findMany({
    where: { key: { in: keys }, eventId: event.id, kind: { in: STUDIO_UPLOAD_KINDS } },
    select: { key: true },
  });
  const allowed = new Set(rows.map((r) => r.key));
  return { ...design, canvas: rows.length === keys.length ? canvas : keepUploads(canvas, allowed) };
}
