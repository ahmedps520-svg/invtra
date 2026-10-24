import type { EventType } from "@prisma/client";
import type { ThemeKey } from "@/lib/themes/types";

/**
 * Wording inside the marketing demos (the WhatsApp chats, the guest's page). It follows the
 * language chosen in the demo, not the page's, so both languages ship with the component.
 */

export type DemoLang = "en" | "ar";
export type StudioOccasion = "WEDDING" | "NEWBORN" | "RAMADAN" | "BIRTHDAY" | "CORPORATE";

export const STUDIO_OCCASIONS: StudioOccasion[] = ["WEDDING", "NEWBORN", "RAMADAN", "BIRTHDAY", "CORPORATE"];

/** The catalogue design each occasion opens with in the hero, and the sample wording it uses. */
export const STUDIO_DESIGN: Record<StudioOccasion, ThemeKey> = {
  WEDDING: "royal",
  NEWBORN: "teddy",
  RAMADAN: "lantern",
  BIRTHDAY: "confetti",
  CORPORATE: "modern",
};

type Chat = {
  /** What the guest is invited to, after "you are warmly invited to". */
  invite: string;
  /** Who the message comes from when the host sends it from their own WhatsApp. */
  host: string;
};

export const DEMO_CHAT: Record<StudioOccasion, Record<DemoLang, Chat>> = {
  WEDDING: {
    en: { invite: "celebrate the wedding of Ahmed & Sara on Saturday, 12 December 2026", host: "Sara" },
    ar: { invite: "حفل زفاف أحمد وسارة، يوم السبت ١٢ ديسمبر ٢٠٢٦", host: "سارة" },
  },
  NEWBORN: {
    en: { invite: "welcome baby Layla — visits from Saturday, 12 December 2026", host: "Mona" },
    ar: { invite: "استقبال المولودة ليلى، ابتداءً من السبت ١٢ ديسمبر ٢٠٢٦", host: "منى" },
  },
  RAMADAN: {
    en: { invite: "our Ramadan ghabga on Friday, 26 February 2027", host: "Abu Faisal" },
    ar: { invite: "غبقة رمضان، مساء الجمعة ٢٦ فبراير ٢٠٢٧", host: "أبو فيصل" },
  },
  BIRTHDAY: {
    en: { invite: "Mariam's birthday on Saturday, 12 December 2026", host: "Mariam" },
    ar: { invite: "عيد ميلاد مريم، يوم السبت ١٢ ديسمبر ٢٠٢٦", host: "مريم" },
  },
  CORPORATE: {
    en: { invite: "an evening of celebration and conversation on Saturday, 12 December 2026", host: "Events team" },
    ar: { invite: "أمسية احتفاء وحوار، يوم السبت ١٢ ديسمبر ٢٠٢٦", host: "فريق الفعاليات" },
  },
};

export const DEMO_GUEST: Record<DemoLang, string> = { en: "Noura", ar: "نورة" };

/** Fixed phrases of the demo conversation. */
export const DEMO_UI: Record<
  DemoLang,
  {
    dear: string;
    invited: string;
    accept: string;
    decline: string;
    question: string;
    business: string;
    businessStatus: string;
    online: string;
    today: string;
    sentWith: string;
    typeMessage: string;
    thanksAccept: string;
    thanksDecline: string;
    view: string;
    personal: string;
    admits: string;
    linkLead: string;
    linkTitle: string;
    openPage: string;
    pageTitle: string;
    pageAccept: string;
    pageDecline: string;
    pageAccepted: string;
    pageDeclined: string;
    pass: string;
    showAtDoor: string;
    noQr: string;
    time1: string;
    time2: string;
  }
> = {
  en: {
    dear: "Dear {name},",
    invited: "you are warmly invited to {invite}.",
    accept: "Accept Invitation",
    decline: "Decline",
    question: "Would you like to accept this invitation?",
    business: "INVTRA",
    businessStatus: "Business account",
    online: "online",
    today: "Today",
    sentWith: "Sent with INVTRA",
    typeMessage: "Message",
    thanksAccept: "Thank you, {name}! Here is your personal invitation. Please show your QR code at the entrance.",
    thanksDecline: "Thank you for letting us know, {name}. You'll be missed!",
    view: "View Invitation",
    personal: "Personal invitation",
    admits: "Admits {n}",
    linkLead: "Your personal invitation:",
    linkTitle: "Your invitation · INVTRA",
    openPage: "invtra.store",
    pageTitle: "Will you join us?",
    pageAccept: "Accept",
    pageDecline: "Decline",
    pageAccepted: "You're on the list! Here is your entry pass.",
    pageDeclined: "Thank you for letting us know. You'll be missed!",
    pass: "Entry pass",
    showAtDoor: "Show at the entrance",
    noQr: "No QR code is issued",
    time1: "7:02 PM",
    time2: "7:03 PM",
  },
  ar: {
    dear: "{name}،",
    invited: "يسعدنا دعوتكم إلى {invite}.",
    accept: "قبول الدعوة",
    decline: "اعتذار",
    question: "هل تودّون قبول الدعوة؟",
    business: "إنفترا",
    businessStatus: "حساب أعمال",
    online: "متصل الآن",
    today: "اليوم",
    sentWith: "أُرسلت عبر إنفترا",
    typeMessage: "رسالة",
    thanksAccept: "شكرًا {name}! هذه دعوتكم الشخصية، يُرجى إبراز رمز QR عند الدخول.",
    thanksDecline: "شكرًا لإبلاغنا يا {name}، سنفتقد حضوركم!",
    view: "عرض الدعوة",
    personal: "دعوة شخصية",
    admits: "عدد المدعوين {n}",
    linkLead: "دعوتكم الشخصية:",
    linkTitle: "دعوتكم · إنفترا",
    openPage: "invtra.store",
    pageTitle: "هل ستشرّفوننا؟",
    pageAccept: "قبول",
    pageDecline: "اعتذار",
    pageAccepted: "تم تأكيد حضوركم! هذه بطاقة الدخول.",
    pageDeclined: "شكرًا لإبلاغنا، سنفتقد حضوركم!",
    pass: "بطاقة الدخول",
    showAtDoor: "تُبرز عند المدخل",
    noQr: "لا يُرسل رمز QR",
    time1: "٧:٠٢ م",
    time2: "٧:٠٣ م",
  },
};

/** Replace ASCII digits with Arabic-Indic ones (and back). */
export function withDigits(text: string, digits: "arab" | "latn"): string {
  return digits === "arab"
    ? text.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)))
    : text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export const studioOccasionType = (o: StudioOccasion): EventType => o;
