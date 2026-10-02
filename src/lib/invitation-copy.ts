import type { EventType } from "@prisma/client";

/**
 * Guest-facing invitation wording, by event type, in English and Arabic.
 * Used on the invitation image, the invitation website and WhatsApp messages.
 * Customers can override eyebrow / intro / closing per event in the design editor.
 */

type Copy = { eyebrow: string; intro: string; closing: string };

export const INVITATION_COPY: Record<EventType, { en: Copy; ar: Copy }> = {
  WEDDING: {
    en: {
      eyebrow: "Together with their families",
      intro: "request the pleasure of your company at the celebration of their marriage",
      closing: "We would be honoured to celebrate this day with you.",
    },
    ar: {
      eyebrow: "بكل الحب والسرور",
      intro: "يتشرفون بدعوتكم لحضور حفل زفافهم",
      closing: "وجودكم يكمل فرحتنا",
    },
  },
  ENGAGEMENT: {
    en: {
      eyebrow: "Please join us to celebrate",
      intro: "the engagement of",
      closing: "We can't wait to celebrate with you.",
    },
    ar: {
      eyebrow: "يسعدنا دعوتكم لمشاركتنا فرحة",
      intro: "حفل خطوبة",
      closing: "بانتظار تشريفكم",
    },
  },
  BIRTHDAY: {
    en: {
      eyebrow: "You're invited to celebrate",
      intro: "a birthday celebration in honour of",
      closing: "Come celebrate with us.",
    },
    ar: {
      eyebrow: "يسعدنا دعوتكم للاحتفال",
      intro: "بعيد ميلاد",
      closing: "بانتظاركم لنحتفل معًا",
    },
  },
  CORPORATE: {
    en: {
      eyebrow: "You are cordially invited",
      intro: "to join us for an evening hosted by",
      closing: "We look forward to welcoming you.",
    },
    ar: {
      eyebrow: "يسرّنا دعوتكم",
      intro: "لحضور الفعالية التي تقيمها",
      closing: "نتطلع إلى استقبالكم",
    },
  },
  GRADUATION: {
    en: {
      eyebrow: "Celebrating the graduation of",
      intro: "please join us as we honour this milestone",
      closing: "Your presence will make it unforgettable.",
    },
    ar: {
      eyebrow: "احتفالًا بتخرج",
      intro: "يسعدنا مشاركتكم فرحة هذا الإنجاز",
      closing: "حضوركم يزيد فرحتنا",
    },
  },
  OTHER: {
    en: {
      eyebrow: "You're invited",
      intro: "please join us for a special occasion hosted by",
      closing: "We look forward to seeing you.",
    },
    ar: {
      eyebrow: "أنتم مدعوون",
      intro: "لمشاركتنا مناسبة خاصة",
      closing: "بانتظار تشريفكم",
    },
  },
};

/** Short fixed phrases printed on cards and pages. */
export const CARD_PHRASES = {
  en: {
    scan: "Scan for your invitation",
    dear: "Dear {name}",
    admits: "Admits {n}",
    admitsOne: "Admits 1",
    at: "at",
    poweredBy: "invtra.store",
    sample: "Sample guest",
  },
  ar: {
    scan: "امسح الرمز لعرض دعوتك",
    dear: "دعوة خاصة لـ {name}",
    admits: "عدد المدعوين: {n}",
    admitsOne: "دعوة لشخص واحد",
    at: "الساعة",
    poweredBy: "invtra.store",
    sample: "ضيف تجريبي",
  },
};

export function copyFor(type: EventType, lang: "en" | "ar", overrides?: Partial<Copy>): Copy {
  const base = INVITATION_COPY[type][lang];
  return {
    eyebrow: overrides?.eyebrow?.trim() || base.eyebrow,
    intro: overrides?.intro?.trim() || base.intro,
    closing: overrides?.closing?.trim() || base.closing,
  };
}
