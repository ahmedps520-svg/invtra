import type { Event, EventLanguage, GalleryImage, ScheduleItem } from "@prisma/client";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import type { Prisma } from "@prisma/client";

/** An in-memory sample event (never stored) for public design demos. */
export function sampleEvent(themeKey: ThemeKey, language: EventLanguage): Event & { scheduleItems: ScheduleItem[]; galleryImages: GalleryImage[] } {
  const theme = getTheme(themeKey);
  // 120 days from now at 7:30 PM Dubai time.
  const day = utcToZoned(new Date(Date.now() + 120 * 86_400_000), "Asia/Dubai").date;
  const startsAt = zonedToUtc(day, "19:30", "Asia/Dubai");
  const now = new Date();
  const schedule: [string, string, string][] = [
    ["19:00", "Guest arrival", "استقبال الضيوف"],
    ["20:00", "Dinner", "العشاء"],
    ["21:00", "Ceremony", "الزفة"],
  ];
  return {
    id: "sample",
    userId: "sample",
    type: "WEDDING",
    language,
    title: "The Wedding of Ahmed & Sara",
    titleAr: "حفل زفاف أحمد وسارة",
    hostNames: "Ahmed & Sara",
    hostNamesAr: "أحمد و سارة",
    startsAt,
    endsAt: null,
    timezone: "Asia/Dubai",
    venueName: "The Grand Ballroom, Four Seasons Resort",
    venueNameAr: "القاعة الكبرى، فندق فور سيزونز",
    address: "Jumeirah Beach Road, Dubai",
    addressAr: "شارع جميرا، دبي",
    mapsUrl: null,
    latitude: null,
    longitude: null,
    dressCode: "Black tie",
    dressCodeAr: "لباس رسمي",
    notes: "We are so grateful to celebrate this day with the people we love most.",
    notesAr: "نحمد الله أن نحتفل بهذا اليوم مع أحب الناس إلى قلوبنا.",
    parkingInfo: "Complimentary valet parking at the main entrance.",
    accommodationInfo: null,
    specialInstructions: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    rsvpDeadline: null,
    allowWebRsvp: true,
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
