import { ASSET_ROWS } from "./assets-data";
import { isPaintedAsset } from "./asset-urls";

export { STUDIO_ASSET_VERSION, assetSrc, assetThumb, assetSilhouette, PAPER_TEXTURE, isPaintedAsset } from "./asset-urls";

/**
 * Studio's painted pieces and ornaments (public/studio, made by scripts/stationery/studio.py from the
 * same public-domain paintings and gold-foil generator as INVTRA's designs).
 */

export const ASSET_CATEGORIES = ["flowers", "bouquets", "greenery", "fruit", "birds", "animals", "toys", "objects", "gold", "celebration", "ramadan", "sky"] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** id, width, height, category, English name, Arabic name, in the library (1) or template-only (0). */
export type AssetRow = [string, number, number, AssetCategory | string, string, string, 0 | 1];

export interface Asset {
  id: string;
  width: number;
  height: number;
  category: AssetCategory;
  name: { en: string; ar: string };
  /** Shown in the library (the rest are variants only used by templates). */
  library: boolean;
  /** A painted piece (has a paper silhouette) rather than foil ornament. */
  painted: boolean;
}

export const ASSETS: ReadonlyMap<string, Asset> = new Map(
  ASSET_ROWS.map(([id, width, height, category, en, ar, lib]) => [
    id,
    { id, width, height, category: category as AssetCategory, name: { en, ar }, library: lib === 1, painted: isPaintedAsset(id) },
  ]),
);

export const LIBRARY_ASSETS: Asset[] = [...ASSETS.values()].filter((a) => a.library);

export function getAsset(id: string | null | undefined): Asset | null {
  return id ? (ASSETS.get(id) ?? null) : null;
}

/** Search the library by name in either language (and by category). */
export function searchAssets(query: string, category?: AssetCategory | null): Asset[] {
  const q = query.trim().toLowerCase();
  return LIBRARY_ASSETS.filter(
    (a) => (!category || a.category === category) && (!q || a.name.en.toLowerCase().includes(q) || a.name.ar.includes(q) || a.id.includes(q)),
  );
}
