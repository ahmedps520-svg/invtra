import type { Currency } from "@/lib/plans";

/**
 * Limited-time offers. An offer is a first purchase of a plan tier at a special price with
 * its own guest allowance; it is only sold between `startsAt` and `endsAt` and disappears
 * from the site by itself afterwards (server checks and the client countdown both use these
 * times). To run it again, change the dates and deploy.
 */
export interface Offer {
  key: string;
  name: { en: string; ar: string };
  /** The plan the event gets (its features: designs, sending…). */
  tier: "BASIC";
  guestLimit: number;
  prices: Record<Currency, number>;
  startsAt: string;
  endsAt: string;
}

/** Saudi National Day 96 — 96 riyals for up to 96 invitations, 5 days only. */
export const NATIONAL_DAY_OFFER: Offer = {
  key: "national-day-96",
  name: { en: "National Day offer", ar: "عرض اليوم الوطني" },
  tier: "BASIC",
  guestLimit: 96,
  // 96 SAR; other currencies are rounded equivalents (KWD/BHD/OMR in fils/baisa).
  prices: {
    SAR: 9600,
    USD: 2600,
    AED: 9400,
    QAR: 9400,
    KWD: 7900,
    BHD: 9700,
    OMR: 9900,
  },
  startsAt: "2026-10-03T00:00:00+03:00",
  // Midnight at the end of Thursday 8 October, Riyadh time.
  endsAt: "2026-10-09T00:00:00+03:00",
};

export const OFFERS: Offer[] = [NATIONAL_DAY_OFFER];

export function isOfferActive(offer: Offer, now: Date = new Date()): boolean {
  return now >= new Date(offer.startsAt) && now < new Date(offer.endsAt);
}

/** The offer on sale right now, if any. */
export function activeOffer(now: Date = new Date()): Offer | null {
  return OFFERS.find((o) => isOfferActive(o, now)) ?? null;
}

export function findOffer(key: string | null | undefined): Offer | null {
  return OFFERS.find((o) => o.key === key) ?? null;
}

/** "National Day offer" / "عرض اليوم الوطني" for an order's promo key (null if none). */
export function offerName(
  key: string | null | undefined,
  locale: "en" | "ar" = "en",
): string | null {
  return findOffer(key)?.name[locale] ?? null;
}

/** What the browser needs to show an offer (and hide it when it ends). */
export type OfferInfo = {
  key: string;
  tier: "BASIC";
  guestLimit: number;
  price: number;
  endsAt: string;
};

export function offerInfo(
  offer: Offer | null,
  currency: Currency,
): OfferInfo | null {
  return offer
    ? {
        key: offer.key,
        tier: offer.tier,
        guestLimit: offer.guestLimit,
        price: offer.prices[currency],
        endsAt: offer.endsAt,
      }
    : null;
}
