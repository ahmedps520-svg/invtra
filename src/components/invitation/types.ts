import type { EventType, RsvpStatus } from "@prisma/client";
import type { InvitationDesign } from "@/lib/design/schema";
import type { ThemeKey } from "@/lib/themes/registry";
import type { invitation } from "@/lib/i18n/dictionaries/en/invitation";

export type InvitationDict = typeof invitation;
export type PageLang = "en" | "ar" | "bilingual";
export type Bi = { en: string; ar: string };

/** Everything the guest-facing invitation page renders. Serializable (crosses the RSC boundary). */
export interface InvitationVM {
  mode: "guest" | "host" | "preview" | "demo";
  token: string | null;
  lang: PageLang;
  themeKey: ThemeKey;
  design: InvitationDesign;
  imageMode: "GENERATED" | "CUSTOM";
  event: {
    type: EventType;
    title: string;
    titleAr: string | null;
    hostNames: string;
    hostNamesAr: string | null;
    startsAt: string;
    endsAt: string | null;
    date: Bi;
    time: Bi;
    venueName: string;
    venueNameAr: string | null;
    address: string;
    addressAr: string | null;
    mapsUrl: string;
    mapsEmbedUrl: string;
    dressCode: string | null;
    dressCodeAr: string | null;
    notes: string | null;
    notesAr: string | null;
    parkingInfo: string | null;
    accommodationInfo: string | null;
    specialInstructions: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    rsvpDeadline: Bi | null;
    rsvpOpen: boolean;
    allowWebRsvp: boolean;
    past: boolean;
    schedule: { time: Bi; title: string; titleAr: string | null; description: string | null }[];
    gallery: { url: string; width: number; height: number; caption: string | null }[];
    coverUrl: string | null;
    logoUrl: string | null;
    musicUrl: string | null;
    backgroundUrl: string | null;
  };
  guest: {
    name: string;
    allowedCount: number;
    attendingCount: number | null;
    rsvpStatus: RsvpStatus;
    checkedInAt: string | null;
    checkedInCount: number | null;
    scanCount: number;
  } | null;
  qrSvg: string | null;
  copy: { en: { eyebrow: string; intro: string; closing: string }; ar: { eyebrow: string; intro: string; closing: string } };
  dict: { en: InvitationDict; ar: InvitationDict };
}
