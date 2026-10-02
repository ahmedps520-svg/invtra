import type { EventType } from "@prisma/client";
import type { CardContent } from "./build";
import { getTheme } from "@/lib/themes/registry";

/** Sample content per occasion, used for theme previews (landing page, gallery, demos). */
type Sample = Omit<CardContent, "eventType" | "date" | "time"> & {
  date: CardContent["date"];
  time: CardContent["time"];
  /** Wall-clock start for live demos. */
  startTime: string;
};

const DATE = { en: "Saturday, 12 December 2026", ar: "السبت، ١٢ ديسمبر ٢٠٢٦" };

export const SAMPLES: Partial<Record<EventType, Sample>> & { WEDDING: Sample } = {
  WEDDING: {
    title: "The Wedding of Ahmed & Sara",
    titleAr: "حفل زفاف أحمد وسارة",
    hostNames: "Ahmed & Sara",
    hostNamesAr: "أحمد و سارة",
    date: DATE,
    time: { en: "7:30 PM", ar: "٧:٣٠ م" },
    startTime: "19:30",
    venueName: "The Grand Ballroom, Four Seasons",
    venueNameAr: "القاعة الكبرى، فور سيزونز",
    address: "Jumeirah Beach Road, Dubai",
    addressAr: "شارع جميرا، دبي",
  },
  NEWBORN: {
    title: "Welcome, Baby Yousef",
    titleAr: "أهلًا بالمولود يوسف",
    hostNames: "Yousef",
    hostNamesAr: "يوسف",
    date: DATE,
    time: { en: "4:00 PM – 8:00 PM", ar: "٤:٠٠ – ٨:٠٠ م" },
    startTime: "16:00",
    venueName: "Al Zahra Hospital, Suite 512",
    venueNameAr: "مستشفى الزهراء، جناح ٥١٢",
    address: "Al Barsha, Dubai",
    addressAr: "البرشاء، دبي",
  },
  BABY_SHOWER: {
    title: "Baby Shower for Lina & Omar",
    titleAr: "حفل استقبال مولود لينا وعمر",
    hostNames: "Lina & Omar",
    hostNamesAr: "لينا و عمر",
    date: DATE,
    time: { en: "5:00 PM", ar: "٥:٠٠ م" },
    startTime: "17:00",
    venueName: "The Garden Café",
    venueNameAr: "مقهى الحديقة",
    address: "City Walk, Dubai",
    addressAr: "سيتي ووك، دبي",
  },
  AQIQAH: {
    title: "Aqiqah of Yousef",
    titleAr: "عقيقة يوسف",
    hostNames: "Yousef",
    hostNamesAr: "يوسف",
    date: DATE,
    time: { en: "1:00 PM", ar: "١:٠٠ م" },
    startTime: "13:00",
    venueName: "Al Mansoori Majlis",
    venueNameAr: "مجلس المنصوري",
    address: "Jumeirah 2, Dubai",
    addressAr: "جميرا ٢، دبي",
  },
  HENNA: {
    title: "Henna Night of Sara",
    titleAr: "ليلة حناء سارة",
    hostNames: "Sara",
    hostNamesAr: "سارة",
    date: DATE,
    time: { en: "8:00 PM", ar: "٨:٠٠ م" },
    startTime: "20:00",
    venueName: "Al Waha Hall",
    venueNameAr: "قاعة الواحة",
    address: "Al Khawaneej, Dubai",
    addressAr: "الخوانيج، دبي",
  },
  BIRTHDAY: {
    title: "Mariam's Birthday",
    titleAr: "عيد ميلاد مريم",
    hostNames: "Mariam",
    hostNamesAr: "مريم",
    date: DATE,
    time: { en: "7:00 PM", ar: "٧:٠٠ م" },
    startTime: "19:00",
    venueName: "The Rooftop, Address Downtown",
    venueNameAr: "روف توب، العنوان داون تاون",
    address: "Downtown Dubai",
    addressAr: "وسط مدينة دبي",
  },
  GRADUATION: {
    title: "Mariam's Graduation",
    titleAr: "حفل تخرج مريم",
    hostNames: "Mariam Al Hashimi",
    hostNamesAr: "مريم الهاشمي",
    date: DATE,
    time: { en: "6:00 PM", ar: "٦:٠٠ م" },
    startTime: "18:00",
    venueName: "Al Hashimi Residence",
    venueNameAr: "منزل عائلة الهاشمي",
    address: "Al Barsha, Dubai",
    addressAr: "البرشاء، دبي",
  },
  ANNIVERSARY: {
    title: "Khalid & Noura's 25th Anniversary",
    titleAr: "الذكرى الخامسة والعشرون لزواج خالد ونورة",
    hostNames: "Khalid & Noura",
    hostNamesAr: "خالد و نورة",
    date: DATE,
    time: { en: "8:00 PM", ar: "٨:٠٠ م" },
    startTime: "20:00",
    venueName: "Pierchic, Al Qasr",
    venueNameAr: "بيرشيك، القصر",
    address: "Madinat Jumeirah, Dubai",
    addressAr: "مدينة جميرا، دبي",
  },
  RAMADAN: {
    title: "Ramadan Ghabga",
    titleAr: "غبقة رمضانية",
    hostNames: "The Al Mansoori Family",
    hostNamesAr: "عائلة المنصوري",
    date: { en: "Friday, 26 February 2027", ar: "الجمعة، ٢٦ فبراير ٢٠٢٧" },
    time: { en: "9:30 PM", ar: "٩:٣٠ م" },
    startTime: "21:30",
    venueName: "Al Mansoori Majlis",
    venueNameAr: "مجلس المنصوري",
    address: "Jumeirah 2, Dubai",
    addressAr: "جميرا ٢، دبي",
  },
  CORPORATE: {
    title: "INVTRA Launch Evening",
    titleAr: "أمسية إطلاق إنفترا",
    hostNames: "INVTRA",
    hostNamesAr: "إنفترا",
    date: DATE,
    time: { en: "6:30 PM", ar: "٦:٣٠ م" },
    startTime: "18:30",
    venueName: "Museum of the Future",
    venueNameAr: "متحف المستقبل",
    address: "Sheikh Zayed Road, Dubai",
    addressAr: "شارع الشيخ زايد، دبي",
  },
};

export function sampleFor(type: EventType): Sample {
  return SAMPLES[type] ?? SAMPLES.WEDDING;
}

export function sampleCardContent(type: EventType = "WEDDING"): CardContent {
  const { startTime: _ignored, ...rest } = sampleFor(type);
  void _ignored;
  return { eventType: SAMPLES[type] ? type : "WEDDING", ...rest };
}

/** The occasion a theme is shown with in previews (its first recommended occasion). */
export function themeSampleType(themeKey: string): EventType {
  const t = getTheme(themeKey);
  return t.occasions.find((o) => SAMPLES[o]) ?? "WEDDING";
}

export function themeSampleContent(themeKey: string): CardContent {
  return sampleCardContent(themeSampleType(themeKey));
}

/** @deprecated use themeSampleContent / sampleCardContent */
export const SAMPLE_CARD_CONTENT: CardContent = sampleCardContent("WEDDING");

export const SAMPLE_GUEST = { en: { name: "Khalid Al Hashimi", allowedCount: 2 }, ar: { name: "خالد الهاشمي", allowedCount: 2 } };
