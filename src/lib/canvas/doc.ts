import type { InvitationDesign } from "@/lib/design/schema";
import type { CanvasDoc } from "./schema";

/** The card is drawn from the Studio document (rather than the template layout). */
export function isCanvasCard(design: Pick<InvitationDesign, "canvas"> | null | undefined): boolean {
  return Boolean(design?.canvas?.enabled && design.canvas.elements.length);
}

/** Storage keys of the photos a document uses (its elements and its background). */
export function canvasUploadKeys(doc: CanvasDoc): string[] {
  const keys = new Set<string>();
  for (const el of doc.elements) if (el.type === "image" && el.upload) keys.add(el.upload);
  if (doc.bg.image?.upload) keys.add(doc.bg.image.upload);
  return [...keys];
}

/**
 * The document without photos that aren't in `allowed` (another event's files, or deleted ones):
 * photo elements are dropped and a photo background falls back to the paper.
 */
export function keepUploads(doc: CanvasDoc, allowed: ReadonlySet<string>): CanvasDoc {
  const elements = doc.elements.filter((el) => el.type !== "image" || !el.upload || allowed.has(el.upload));
  const image = doc.bg.image?.upload && !allowed.has(doc.bg.image.upload) ? null : doc.bg.image;
  return { ...doc, elements, bg: { ...doc.bg, image } };
}
