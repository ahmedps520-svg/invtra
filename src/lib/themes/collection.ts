import type { EventType } from "@prisma/client";
import type { FontKey } from "@/lib/design/fonts";
import type { InvitationDesign } from "@/lib/design/schema";
import type { DesignStyle } from "@/lib/marketing/design-style-list";
import { COLLECTION_ROWS } from "./collection-data";
import { stationery, type ArtworkSpec } from "./stationery";
import type { CollectionKey, ThemeDefinition } from "./types";

/**
 * The generated artwork collection: hundreds of designs for weddings, newborns and Ramadan, laid
 * out by scripts/stationery from public-domain paintings and gold-foil ornament. Each row is kept
 * compact (the list ships to the design picker) and expanded here into a full design.
 */

type Palette = InvitationDesign["palette"];

export interface CollectionRow {
  k: CollectionKey;
  /** Occasions it suits. */
  o: EventType[];
  /** Premium design. */
  p?: 1;
  /** Language it's designed around (English when absent). */
  l?: "AR" | "BILINGUAL";
  /** Background, surface, text, muted, accent. */
  c: [string, string, string, string, string];
  /** Display, body, Arabic display, Arabic body. */
  f: [FontKey, FontKey, FontKey, FontKey];
  /** Typefaces for the names (Latin, Arabic). */
  n?: [FontKey | null, FontKey | null];
  /** Names size. */
  s?: number;
  /** Names in capitals. */
  u?: 1;
  /** Text box: x, width, top; then the footer's bottom inset. */
  b: [number, number, number, number];
  d: ArtworkSpec["art"]["divider"];
  /** Look, for the style filter and the quiz. */
  y: DesignStyle;
}

const PAGE_DIVIDER = { floral: "floral", diamond: "diamond", hairline: "line", dots: "dots", star: "star", heart: "heart" } as const;

const palette = ([background, surface, text, muted, accent]: CollectionRow["c"]): Palette => ({ background, surface, text, muted, accent });

export const COLLECTION = Object.fromEntries(
  COLLECTION_ROWS.map((r) => [
    r.k,
    stationery(r.k, {
      premium: r.p === 1,
      language: r.l,
      occasions: r.o,
      palette: palette(r.c),
      fonts: r.f,
      names: r.n ? { font: r.n[0], fontAr: r.n[1] } : undefined,
      nameScale: r.s,
      uppercase: r.u === 1,
      art: { content: { x: r.b[0], w: r.b[1], top: r.b[2] }, bottomPad: r.b[3], sidePad: 150, divider: r.d },
      divider: PAGE_DIVIDER[r.d],
    }),
  ]),
) as Record<CollectionKey, ThemeDefinition>;

export const COLLECTION_STYLE = Object.fromEntries(COLLECTION_ROWS.map((r) => [r.k, r.y])) as Record<CollectionKey, DesignStyle>;
