import type { Event, EventLanguage, GalleryImage, ScheduleItem } from "@prisma/client";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import { themeSample } from "@/lib/card/sample";
import type { EventType, Prisma } from "@prisma/client";

type Extras = {
  schedule: [string, string, string][];
  dressCode?: [string, string];
  notes?: [string, string];
  parkingInfo?: string;
  specialInstructions?: string;
};

/** Programme and practical details that fit each occasion's demo. */
const EXTRAS: Partial<Record<EventType, Extras>> & { WEDDING: Extras } = {
  WEDDING: {
    schedule: [
      ["19:00", "Guest arrival", "استقبال الضيوف"],
      ["20:00", "Dinner", "العشاء"],
      ["21:00", "Ceremony", "الزفة"],
    ],
    dressCode: ["Black tie", "لباس رسمي"],
    notes: ["We are so grateful to celebrate this day with the people we love most.", "نحمد الله أن نحتفل بهذا اليوم مع أحب الناس إلى قلوبنا."],
    parkingInfo: "Complimentary valet parking at the main entrance.",
  },
  NEWBORN: {
    schedule: [
      ["16:00", "Visiting hours begin", "بداية الزيارة"],
      ["17:30", "Tea & sweets", "الشاي والحلويات"],
      ["20:00", "Visiting hours end", "نهاية الزيارة"],
    ],
    notes: ["Thank you for welcoming our little one with us. Visits are kept short so mother and baby can rest.", "شكرًا لمشاركتنا فرحة استقبال مولودنا. نرجو أن تكون الزيارة قصيرة لراحة الأم والمولود."],
    parkingInfo: "Visitor parking is available at the hospital's main entrance.",
    specialInstructions: "Please postpone your visit if you feel unwell.",
  },
  BABY_SHOWER: {
    schedule: [
      ["17:00", "Welcome & mocktails", "الاستقبال والمشروبات"],
      ["17:45", "Games & wishes for baby", "ألعاب وأمنيات للمولود"],
      ["18:30", "Cake & gifts", "الكعكة والهدايا"],
    ],
    notes: ["Come celebrate the newest member of our family before they arrive!", "شاركونا الاحتفال بأحدث فرد في عائلتنا قبل قدومه!"],
  },
  AQIQAH: {
    schedule: [
      ["13:00", "Guest reception", "استقبال الضيوف"],
      ["13:30", "Prayers & blessings", "الدعاء والتبريكات"],
      ["14:00", "Lunch", "الغداء"],
    ],
    notes: ["We give thanks for the blessing of our child and would be honoured by your presence.", "نحمد الله على نعمة المولود ويشرفنا حضوركم."],
  },
  HENNA: {
    schedule: [
      ["20:00", "Arrival", "الاستقبال"],
      ["20:30", "Henna artists", "نقش الحناء"],
      ["22:00", "Dinner & celebration", "العشاء والاحتفال"],
    ],
    dressCode: ["Traditional attire", "لباس تقليدي"],
  },
  BIRTHDAY: {
    schedule: [
      ["19:00", "Welcome drinks", "مشروبات الترحيب"],
      ["20:00", "Dinner", "العشاء"],
      ["21:30", "Cake", "الكعكة"],
    ],
    dressCode: ["Smart casual", "أنيق غير رسمي"],
  },
  GRADUATION: {
    schedule: [
      ["18:00", "Welcome", "الاستقبال"],
      ["19:00", "Dinner", "العشاء"],
      ["20:00", "Speeches & photos", "الكلمات والصور"],
    ],
  },
  ANNIVERSARY: {
    schedule: [
      ["20:00", "Welcome", "الاستقبال"],
      ["20:30", "Dinner", "العشاء"],
      ["22:00", "Toast", "نخب الذكرى"],
    ],
    dressCode: ["Cocktail attire", "لباس سهرة"],
  },
  RAMADAN: {
    schedule: [
      ["21:30", "Arrival & Arabic coffee", "الاستقبال والقهوة العربية"],
      ["22:00", "Ghabga dinner", "الغبقة"],
      ["23:30", "Majlis & conversation", "المجلس والسمر"],
    ],
    dressCode: ["Traditional attire", "لباس تقليدي"],
  },
  CORPORATE: {
    schedule: [
      ["18:30", "Registration", "التسجيل"],
      ["19:00", "Keynote", "الكلمة الرئيسية"],
      ["20:00", "Networking dinner", "عشاء التواصل"],
    ],
    dressCode: ["Business formal", "لباس رسمي للأعمال"],
    parkingInfo: "Valet parking available at the main entrance.",
  },
};

/** An in-memory sample event (never stored) for public design demos — dressed for the theme's occasion. */
export function sampleEvent(themeKey: ThemeKey, language: EventLanguage): Event & { scheduleItems: ScheduleItem[]; galleryImages: GalleryImage[] } {
  const theme = getTheme(themeKey);
  const sample = themeSample(theme.key);
  const extras = EXTRAS[sample.eventType] ?? EXTRAS.WEDDING;
  // 120 days from now, at the occasion's usual time, Dubai time.
  const day = utcToZoned(new Date(Date.now() + 120 * 86_400_000), "Asia/Dubai").date;
  const startsAt = zonedToUtc(day, sample.startTime, "Asia/Dubai");
  const now = new Date();
  const schedule = extras.schedule;
  return {
    id: "sample",
    userId: "sample",
    type: sample.eventType,
    language,
    title: sample.title,
    titleAr: sample.titleAr ?? null,
    hostNames: sample.hostNames,
    hostNamesAr: sample.hostNamesAr ?? null,
    startsAt,
    endsAt: null,
    timezone: "Asia/Dubai",
    venueName: sample.venueName,
    venueNameAr: sample.venueNameAr ?? null,
    address: sample.address ?? null,
    addressAr: sample.addressAr ?? null,
    mapsUrl: null,
    latitude: null,
    longitude: null,
    dressCode: extras.dressCode?.[0] ?? null,
    dressCodeAr: extras.dressCode?.[1] ?? null,
    notes: extras.notes?.[0] ?? null,
    notesAr: extras.notes?.[1] ?? null,
    parkingInfo: extras.parkingInfo ?? null,
    accommodationInfo: null,
    specialInstructions: extras.specialInstructions ?? null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    rsvpDeadline: null,
    allowWebRsvp: true,
    sectionsEnabled: false,
    sections: null,
    doorToken: null,
    doorTokenCreatedAt: null,
    autoReminder: false,
    custom: false,
    customDraft: false,
    themeKey: theme.key,
    design: theme.defaults as unknown as Prisma.JsonValue,
    imageMode: "GENERATED",
    customImageKey: null,
    customImageWidth: null,
    customImageHeight: null,
    coverImageKey: null,
    logoKey: null,
    musicKey: null,
    contentVersion: 1,
    messageTemplateId: null,
    templateVariables: null,
    plan: null,
    guestLimit: 0,
    testSendsUsed: 0,
    teaserMediaId: null,
    teaserMediaVersion: null,
    teaserMediaExpiresAt: null,
    sectionTeaserMedia: null,
    firstSentAt: null,
    deactivatedAt: null,
    deactivatedReason: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    scheduleItems: schedule.map(([time, title, titleAr], i) => ({ id: `s${i}`, eventId: "sample", time, title, titleAr, description: null, sortOrder: i })),
    galleryImages: [],
  };
}
