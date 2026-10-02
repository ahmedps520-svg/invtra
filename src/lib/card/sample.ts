import type { CardContent } from "./build";

/** Sample event used for theme previews (landing page, theme picker). */
export const SAMPLE_CARD_CONTENT: CardContent = {
  eventType: "WEDDING",
  title: "The Wedding of Ahmed & Sara",
  titleAr: "حفل زفاف أحمد وسارة",
  hostNames: "Ahmed & Sara",
  hostNamesAr: "أحمد و سارة",
  date: { en: "Saturday, 12 December 2026", ar: "السبت، ١٢ ديسمبر ٢٠٢٦" },
  time: { en: "7:30 PM", ar: "٧:٣٠ م" },
  venueName: "The Grand Ballroom, Four Seasons",
  venueNameAr: "القاعة الكبرى، فور سيزونز",
  address: "Jumeirah Beach Road, Dubai",
  addressAr: "شارع جميرا، دبي",
};

export const SAMPLE_GUEST = { en: { name: "Khalid Al Hashimi", allowedCount: 2 }, ar: { name: "خالد الهاشمي", allowedCount: 2 } };
