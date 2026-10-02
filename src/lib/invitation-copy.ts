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
      eyebrow: "Please join us to celebrate the engagement of",
      intro: "an evening of joy as two families become one",
      closing: "We can't wait to celebrate with you.",
    },
    ar: {
      eyebrow: "يسعدنا دعوتكم لمشاركتنا فرحة خطوبة",
      intro: "في أمسية يجتمع فيها الأهل والأحبة",
      closing: "بانتظار تشريفكم",
    },
  },
  BIRTHDAY: {
    en: {
      eyebrow: "You're invited to celebrate",
      intro: "on a very special birthday — an evening of laughter, cake and good company",
      closing: "Come celebrate with us.",
    },
    ar: {
      eyebrow: "يسعدنا دعوتكم للاحتفال بعيد ميلاد",
      intro: "في أمسية مليئة بالفرح والضحك",
      closing: "بانتظاركم لنحتفل معًا",
    },
  },
  CORPORATE: {
    en: {
      eyebrow: "You are cordially invited by",
      intro: "to an evening of celebration and conversation",
      closing: "We look forward to welcoming you.",
    },
    ar: {
      eyebrow: "يسرّنا دعوتكم من",
      intro: "لحضور أمسية مميزة",
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
  NEWBORN: {
    en: {
      eyebrow: "With hearts full of joy, we welcome",
      intro: "our little one. Family and friends are warmly invited to visit and share our happiness",
      closing: "Thank you for celebrating our newest blessing with us.",
    },
    ar: {
      eyebrow: "بقلوب يغمرها الفرح نستقبل مولودنا",
      intro: "ويسعدنا أن تشاركونا فرحتنا بزيارتكم",
      closing: "شكرًا لمشاركتنا فرحة قدوم مولودنا",
    },
  },
  BABY_SHOWER: {
    en: {
      eyebrow: "Oh baby! Please join us for a baby shower honouring",
      intro: "as we celebrate the little one on the way",
      closing: "We can't wait to celebrate with you.",
    },
    ar: {
      eyebrow: "يسعدنا دعوتكم لحفل استقبال المولود المنتظر",
      intro: "لنحتفل معًا بقدوم مولودنا",
      closing: "بانتظاركم لنحتفل معًا",
    },
  },
  AQIQAH: {
    en: {
      eyebrow: "In gratitude for the blessing of",
      intro: "you are warmly invited to the aqiqah celebration",
      closing: "Your presence and prayers mean the world to us.",
    },
    ar: {
      eyebrow: "شكرًا لله على نعمة المولود",
      intro: "يسرّنا دعوتكم لحضور العقيقة",
      closing: "حضوركم ودعواتكم تسعدنا",
    },
  },
  HENNA: {
    en: {
      eyebrow: "Please join us for the henna night of",
      intro: "an evening of music, colour and celebration",
      closing: "We would love to celebrate with you.",
    },
    ar: {
      eyebrow: "يسعدنا دعوتكم لحضور ليلة حناء",
      intro: "أمسية من الفرح والطرب والألوان",
      closing: "وجودكم يكمل فرحتنا",
    },
  },
  ANNIVERSARY: {
    en: {
      eyebrow: "Celebrating a love story",
      intro: "please join us as we celebrate their wedding anniversary",
      closing: "Thank you for being part of our story.",
    },
    ar: {
      eyebrow: "احتفالًا بقصة حب",
      intro: "يسعدنا دعوتكم للاحتفال بذكرى زواجهما",
      closing: "شكرًا لكونكم جزءًا من قصتنا",
    },
  },
  RAMADAN: {
    en: {
      eyebrow: "Ramadan Kareem — you are warmly invited by",
      intro: "to an evening of iftar, togetherness and blessings",
      closing: "May this blessed month bring joy to you and your family.",
    },
    ar: {
      eyebrow: "رمضان كريم — تتشرف بدعوتكم",
      intro: "لمشاركتها أمسية رمضانية مباركة",
      closing: "كل عام وأنتم بخير",
    },
  },
  OTHER: {
    en: {
      eyebrow: "You're invited by",
      intro: "to join us for a special occasion",
      closing: "We look forward to seeing you.",
    },
    ar: {
      eyebrow: "أنتم مدعوون من",
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
