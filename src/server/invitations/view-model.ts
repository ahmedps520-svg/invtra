import type { Event, GalleryImage, Guest, ScheduleItem } from "@prisma/client";
import { mediaUrl } from "@/server/storage";
import { eventDesign } from "@/server/events/design";
import { rsvpDeadlinePassed } from "@/server/rsvp";
import { invitationQrText } from "@/server/invitations";
import { formatDate, formatTime, formatWallTime } from "@/lib/format";
import { copyFor } from "@/lib/invitation-copy";
import { normalizeDesign, type InvitationDesign } from "@/lib/design/schema";
import { getTheme, type ThemeKey } from "@/lib/themes/registry";
import { qrSvg } from "@/lib/qr";
import { en } from "@/lib/i18n/dictionaries/en";
import { ar } from "@/lib/i18n/dictionaries/ar";
import type { InvitationVM, PageLang } from "@/components/invitation/types";

type FullEvent = Event & { scheduleItems: ScheduleItem[]; galleryImages: GalleryImage[] };

export function pageLang(event: Pick<Event, "language">, guest?: Pick<Guest, "locale"> | null): PageLang {
  if (guest?.locale === "en" || guest?.locale === "ar") return guest.locale;
  return event.language === "AR" ? "ar" : event.language === "BILINGUAL" ? "bilingual" : "en";
}

export function mapsLinks(event: Pick<Event, "mapsUrl" | "venueName" | "address" | "latitude" | "longitude">) {
  const q = event.latitude && event.longitude ? `${event.latitude},${event.longitude}` : `${event.venueName}, ${event.address}`;
  return {
    mapsUrl: event.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    mapsEmbedUrl: `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`,
  };
}

/** Build the invitation page view model. `guest` null renders a non-personal page. */
export async function buildInvitationVM(opts: {
  event: FullEvent;
  guest: (Pick<Guest, "name" | "allowedCount" | "attendingCount" | "rsvpStatus" | "checkedInAt" | "checkedInCount" | "scanCount" | "locale">) | null;
  token: string | null;
  mode: InvitationVM["mode"];
  themeKey?: ThemeKey;
  design?: InvitationDesign;
  /** Show the entry-pass QR (accepted guest or preview). */
  qrText?: string | null;
}): Promise<InvitationVM> {
  const { event, guest } = opts;
  const themeKey = (opts.themeKey ?? getTheme(event.themeKey).key) as ThemeKey;
  const design = opts.design ?? (opts.themeKey && opts.themeKey !== event.themeKey ? normalizeDesign(getTheme(themeKey).defaults, { ...eventDesign(event), palette: getTheme(themeKey).defaults.palette, fonts: getTheme(themeKey).defaults.fonts }) : eventDesign(event));
  const tz = event.timezone;
  const digits = design.digits;
  const now = new Date();
  const lang = pageLang(event, guest);
  const qrText = opts.qrText ?? (opts.token && guest?.rsvpStatus === "ACCEPTED" ? invitationQrText(opts.token) : null);
  const textColor = design.palette.text;
  const plate = design.palette.surface;

  const [coverUrl, logoUrl, musicUrl, backgroundUrl, gallery] = await Promise.all([
    mediaUrl(event.coverImageKey),
    mediaUrl(event.logoKey),
    mediaUrl(event.musicKey),
    design.background.mode === "image" ? mediaUrl(design.background.imageKey) : Promise.resolve(null),
    Promise.all(
      event.galleryImages.map(async (g) => ({ url: (await mediaUrl(g.storageKey)) ?? "", width: g.width, height: g.height, caption: g.caption })),
    ),
  ]);

  return {
    mode: opts.mode,
    token: opts.token,
    lang,
    themeKey,
    design,
    imageMode: event.imageMode,
    event: {
      type: event.type,
      title: event.title,
      titleAr: event.titleAr,
      hostNames: event.hostNames,
      hostNamesAr: event.hostNamesAr,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      date: {
        en: formatDate(event.startsAt, { locale: "en", timeZone: tz }),
        ar: formatDate(event.startsAt, { locale: "ar", timeZone: tz, digits }),
      },
      time: {
        en: formatTime(event.startsAt, { locale: "en", timeZone: tz }) + (event.endsAt ? ` – ${formatTime(event.endsAt, { locale: "en", timeZone: tz })}` : ""),
        ar: formatTime(event.startsAt, { locale: "ar", timeZone: tz, digits }) + (event.endsAt ? ` – ${formatTime(event.endsAt, { locale: "ar", timeZone: tz, digits })}` : ""),
      },
      venueName: event.venueName,
      venueNameAr: event.venueNameAr,
      address: event.address,
      addressAr: event.addressAr,
      ...mapsLinks(event),
      dressCode: event.dressCode,
      dressCodeAr: event.dressCodeAr,
      notes: event.notes,
      notesAr: event.notesAr,
      parkingInfo: event.parkingInfo,
      accommodationInfo: event.accommodationInfo,
      specialInstructions: event.specialInstructions,
      contactName: event.contactName,
      contactPhone: event.contactPhone,
      contactEmail: event.contactEmail,
      rsvpDeadline: event.rsvpDeadline
        ? {
            en: formatDate(event.rsvpDeadline, { locale: "en", timeZone: tz, style: "long" }),
            ar: formatDate(event.rsvpDeadline, { locale: "ar", timeZone: tz, style: "long", digits }),
          }
        : null,
      rsvpOpen: !rsvpDeadlinePassed(event, now) && (event.endsAt ?? event.startsAt) > now,
      allowWebRsvp: event.allowWebRsvp,
      past: (event.endsAt ?? new Date(event.startsAt.getTime() + 6 * 3600_000)) < now,
      schedule: event.scheduleItems.map((s) => ({
        time: { en: formatWallTime(s.time, "en"), ar: formatWallTime(s.time, "ar", digits) },
        title: s.title,
        titleAr: s.titleAr,
        description: s.description,
      })),
      gallery: gallery.filter((g) => g.url),
      coverUrl,
      logoUrl,
      musicUrl,
      backgroundUrl,
    },
    guest: guest
      ? {
          name: guest.name,
          allowedCount: guest.allowedCount,
          attendingCount: guest.attendingCount,
          rsvpStatus: guest.rsvpStatus,
          checkedInAt: guest.checkedInAt?.toISOString() ?? null,
          checkedInCount: guest.checkedInCount,
          scanCount: guest.scanCount,
        }
      : null,
    qrSvg: qrText ? qrSvg({ text: qrText, size: 320, style: design.card.qr.style, fg: textColor, bg: plate, logo: design.card.qr.showLogo }) : null,
    copy: {
      en: copyFor(event.type, "en", { eyebrow: design.texts.eyebrow, intro: design.texts.intro, closing: design.texts.closing }),
      ar: copyFor(event.type, "ar", { eyebrow: design.texts.eyebrowAr, intro: design.texts.introAr, closing: design.texts.closingAr }),
    },
    dict: { en: en.invitation, ar: ar.invitation },
  };
}
