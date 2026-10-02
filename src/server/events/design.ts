import type { Event } from "@prisma/client";
import { normalizeDesign, type InvitationDesign } from "@/lib/design/schema";
import { getTheme } from "@/lib/themes/registry";
import { formatDate, formatTime } from "@/lib/format";
import type { CardContent, CardLanguage } from "@/lib/card/build";

type EventLike = Pick<
  Event,
  | "type"
  | "language"
  | "title"
  | "titleAr"
  | "hostNames"
  | "hostNamesAr"
  | "startsAt"
  | "timezone"
  | "venueName"
  | "venueNameAr"
  | "address"
  | "addressAr"
  | "themeKey"
  | "design"
>;

export function eventTheme(event: Pick<Event, "themeKey">) {
  return getTheme(event.themeKey);
}

export function eventDesign(event: Pick<Event, "themeKey" | "design">): InvitationDesign {
  return normalizeDesign(getTheme(event.themeKey).defaults, event.design);
}

/** Everything printed on the invitation card, formatted in the event's timezone. */
export function cardContent(event: EventLike, design: InvitationDesign = eventDesign(event)): CardContent {
  return {
    eventType: event.type,
    title: event.title,
    titleAr: event.titleAr,
    hostNames: event.hostNames,
    hostNamesAr: event.hostNamesAr,
    date: {
      en: formatDate(event.startsAt, { locale: "en", timeZone: event.timezone, style: "full" }),
      ar: formatDate(event.startsAt, { locale: "ar", timeZone: event.timezone, style: "full", digits: design.digits }),
    },
    time: {
      en: formatTime(event.startsAt, { locale: "en", timeZone: event.timezone }),
      ar: formatTime(event.startsAt, { locale: "ar", timeZone: event.timezone, digits: design.digits }),
    },
    venueName: event.venueName,
    venueNameAr: event.venueNameAr,
    address: event.address,
    addressAr: event.addressAr,
  };
}

export function cardLanguage(event: Pick<Event, "language">): CardLanguage {
  return event.language;
}
