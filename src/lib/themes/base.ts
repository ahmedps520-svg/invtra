import type { InvitationDesign } from "@/lib/design/schema";

/** Building blocks shared by the coded designs (registry.ts) and the artwork designs (stationery.ts). */

export const baseSections: InvitationDesign["sections"] = {
  countdown: true,
  schedule: true,
  gallery: true,
  details: true,
  map: true,
  rsvp: true,
  music: true,
  contact: true,
};

export const baseCard: InvitationDesign["card"] = {
  showBranding: true,
  showGuestName: true,
  showVenueAddress: true,
  lines: { eyebrow: true, names: true, intro: true, date: true, time: true, venue: true },
  qr: { enabled: true, link: "", caption: "", position: "bottom-center", size: "md", style: "rounded", showLogo: true },
};

export const emptyTexts: InvitationDesign["texts"] = { eyebrow: "", intro: "", closing: "", eyebrowAr: "", introAr: "", closingAr: "", extra: "", extraAr: "" };

export function design(d: Omit<InvitationDesign, "sections" | "card" | "texts" | "monogram" | "names" | "couple" | "customQr" | "background" | "digits"> &
  Partial<Pick<InvitationDesign, "card" | "background" | "digits" | "names">>): InvitationDesign {
  return {
    texts: emptyTexts,
    monogram: "",
    names: { font: null, fontAr: null, color: null, size: null },
    couple: { first: "", second: "", firstAr: "", secondAr: "", joinFont: null, joinFontAr: null },
    sections: baseSections,
    background: { mode: "theme", imageKey: null, overlay: 0.35 },
    customQr: { x: 0.5, y: 0.82, size: 0.22 },
    digits: "arab",
    ...d,
    card: d.card ?? baseCard,
  };
}

