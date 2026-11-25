/**
 * Where Studio's pieces are served from (public/studio). Kept apart from the asset table so the
 * card renderer, which every invitation preview loads, doesn't carry the whole library with it.
 */

/** Bump when the files under public/studio change, so browsers fetch the new ones. */
export const STUDIO_ASSET_VERSION = 1;

export function assetSrc(id: string): string {
  return `/studio/a/${id}.webp?v=${STUDIO_ASSET_VERSION}`;
}

export function assetThumb(id: string): string {
  return `/studio/t/${id}.webp?v=${STUDIO_ASSET_VERSION}`;
}

export function assetSilhouette(id: string): string {
  return `/studio/s/${id}.webp?v=${STUDIO_ASSET_VERSION}`;
}

export const PAPER_TEXTURE = `/studio/paper.jpg?v=${STUDIO_ASSET_VERSION}`;

/** A painted piece (it has a paper silhouette); the gold-foil ornaments' ids start with "g-". */
export function isPaintedAsset(id: string): boolean {
  return !id.startsWith("g-");
}
