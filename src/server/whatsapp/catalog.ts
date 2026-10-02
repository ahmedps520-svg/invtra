import type { EventType, TemplatePurpose } from "@prisma/client";
import type { TemplateButton, TemplateVariable } from "@/lib/whatsapp/templates";
import { EVENT_TYPES } from "@/lib/events/types";

/**
 * INVTRA's standard WhatsApp templates. `npm run db:seed` loads them into the
 * MessageTemplate table; admins submit them to Meta for approval from /admin/templates
 * (or create them in WhatsApp Manager with the same name + language and press "Sync").
 */
export interface CatalogTemplate {
  key: string;
  name: string;
  nameAr: string;
  description: string;
  purpose: TemplatePurpose;
  metaName: string;
  language: string;
  locale: "en" | "ar" | "bilingual";
  category: "UTILITY" | "MARKETING";
  headerType: "NONE" | "IMAGE";
  body: string;
  variables: TemplateVariable[];
  footer: string | null;
  buttons: TemplateButton[];
  eventTypes: EventType[];
  sortOrder: number;
}

const ALL: EventType[] = [...EVENT_TYPES];
const BABY: EventType[] = ["NEWBORN", "AQIQAH"];
const PARTY: EventType[] = ["BABY_SHOWER", "BIRTHDAY", "GRADUATION", "ANNIVERSARY", "OTHER"];
const ACCEPT_DECLINE_EN: TemplateButton[] = [
  { type: "QUICK_REPLY", text: "Accept Invitation", action: "ACCEPT" },
  { type: "QUICK_REPLY", text: "Decline", action: "DECLINE" },
];
const ACCEPT_DECLINE_AR: TemplateButton[] = [
  { type: "QUICK_REPLY", text: "قبول الدعوة", action: "ACCEPT" },
  { type: "QUICK_REPLY", text: "اعتذار", action: "DECLINE" },
];

export function templateCatalog(appUrl: string): CatalogTemplate[] {
  const base = appUrl.replace(/\/$/, "");
  return [
    {
      key: "formal_wedding_en",
      name: "Formal Wedding",
      nameAr: "زفاف رسمي",
      description: "A classic wedding invitation with Accept / Decline buttons.",
      purpose: "INVITATION",
      metaName: "invtra_formal_wedding",
      language: "en",
      locale: "en",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "Dear {{1}}, you are warmly invited to celebrate the wedding of {{2}} on {{3}}.\n\nWe would be honoured to have you celebrate this special occasion with us. Would you like to accept this invitation?",
      variables: ["guest_name", "host_names", "event_date"],
      footer: "Sent with INVTRA",
      buttons: ACCEPT_DECLINE_EN,
      eventTypes: ["WEDDING", "ENGAGEMENT"],
      sortOrder: 1,
    },
    {
      key: "elegant_en",
      name: "Elegant",
      nameAr: "أنيق",
      description: "A graceful invitation for any occasion.",
      purpose: "INVITATION",
      metaName: "invtra_elegant_invite",
      language: "en",
      locale: "en",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "Dear {{1}}, with great pleasure, we invite you to join us for {{2}} on {{3}} at {{4}}.\n\nPlease let us know if you will be attending.",
      variables: ["guest_name", "event_name", "event_date", "venue"],
      footer: "Sent with INVTRA",
      buttons: ACCEPT_DECLINE_EN,
      eventTypes: ALL,
      sortOrder: 2,
    },
    {
      key: "formal_wedding_ar",
      name: "Formal Wedding (Arabic)",
      nameAr: "زفاف رسمي",
      description: "دعوة زفاف كلاسيكية مع زرّي القبول والاعتذار.",
      purpose: "INVITATION",
      metaName: "invtra_formal_wedding_ar",
      language: "ar",
      locale: "ar",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "أهلًا {{1}}،\n\nيسعدنا دعوتكم لحضور حفل زفاف {{2}} يوم {{3}}.\n\nيشرفنا أن تشاركونا فرحتنا. هل تودّون قبول الدعوة؟",
      variables: ["guest_name", "host_names_ar", "event_date_ar"],
      footer: "أُرسلت عبر إنفترا",
      buttons: ACCEPT_DECLINE_AR,
      eventTypes: ["WEDDING", "ENGAGEMENT"],
      sortOrder: 3,
    },
    {
      key: "elegant_ar",
      name: "Elegant (Arabic)",
      nameAr: "أنيق",
      description: "دعوة راقية تناسب جميع المناسبات.",
      purpose: "INVITATION",
      metaName: "invtra_elegant_invite_ar",
      language: "ar",
      locale: "ar",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "أهلًا {{1}}،\n\nيسعدنا دعوتكم لمشاركتنا {{2}} يوم {{3}} في {{4}}.\n\nنرجو إعلامنا بحضوركم.",
      variables: ["guest_name", "event_name_ar", "event_date_ar", "venue_ar"],
      footer: "أُرسلت عبر إنفترا",
      buttons: ACCEPT_DECLINE_AR,
      eventTypes: ALL,
      sortOrder: 4,
    },
    {
      key: "bilingual",
      name: "Bilingual (Arabic + English)",
      nameAr: "ثنائي اللغة",
      description: "Arabic and English in one message.",
      purpose: "INVITATION",
      metaName: "invtra_bilingual_invite",
      language: "ar",
      locale: "bilingual",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "أهلًا {{1}}، يسعدنا دعوتكم لحضور {{2}} يوم {{3}}.\n\nYou are warmly invited to {{4}} on {{5}}.\n\nهل تقبلون الدعوة؟ Would you like to accept this invitation?",
      variables: ["guest_name", "event_name_ar", "event_date_ar", "event_name", "event_date"],
      footer: "INVTRA · إنفترا",
      buttons: [
        { type: "QUICK_REPLY", text: "Accept · قبول", action: "ACCEPT" },
        { type: "QUICK_REPLY", text: "Decline · اعتذار", action: "DECLINE" },
      ],
      eventTypes: ALL,
      sortOrder: 5,
    },
    {
      key: "newborn_visit_en",
      name: "New baby visit",
      nameAr: "زيارة المولود",
      description: "Welcome a new baby — invite family and friends to visit at the hospital or at home.",
      purpose: "INVITATION",
      metaName: "invtra_newborn_visit",
      language: "en",
      locale: "en",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "Dear {{1}}, with hearts full of joy we welcome our little one, {{2}}.\n\nWe would love for you to visit us on {{3}} at {{4}}. Will you be joining us?",
      variables: ["guest_name", "host_names", "event_date", "venue"],
      footer: "Sent with INVTRA",
      buttons: ACCEPT_DECLINE_EN,
      eventTypes: BABY,
      sortOrder: 6,
    },
    {
      key: "newborn_visit_ar",
      name: "New baby visit (Arabic)",
      nameAr: "زيارة المولود",
      description: "استقبال مولود جديد — دعوة الأهل والأصدقاء للزيارة في المستشفى أو المنزل.",
      purpose: "INVITATION",
      metaName: "invtra_newborn_visit_ar",
      language: "ar",
      locale: "ar",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "أهلًا {{1}}،\n\nبقلوب يغمرها الفرح نستقبل مولودنا {{2}}، ويسعدنا أن تشاركونا فرحتنا بزيارتكم يوم {{3}} في {{4}}.\n\nهل تقبلون الدعوة؟",
      variables: ["guest_name", "host_names_ar", "event_date_ar", "venue_ar"],
      footer: "أُرسلت عبر إنفترا",
      buttons: ACCEPT_DECLINE_AR,
      eventTypes: BABY,
      sortOrder: 7,
    },
    {
      key: "celebration_en",
      name: "Celebration",
      nameAr: "احتفال",
      description: "A warm, friendly invitation for baby showers, birthdays, graduations and parties.",
      purpose: "INVITATION",
      metaName: "invtra_celebration_invite",
      language: "en",
      locale: "en",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "Hi {{1}}, you're invited to {{2}} on {{3}} at {{4}}.\n\nIt wouldn't be the same without you. Will you celebrate with us?",
      variables: ["guest_name", "event_name", "event_date", "venue"],
      footer: "Sent with INVTRA",
      buttons: ACCEPT_DECLINE_EN,
      eventTypes: PARTY,
      sortOrder: 8,
    },
    {
      key: "celebration_ar",
      name: "Celebration (Arabic)",
      nameAr: "احتفال",
      description: "دعوة ودّية لحفلات استقبال المواليد وأعياد الميلاد والتخرج.",
      purpose: "INVITATION",
      metaName: "invtra_celebration_invite_ar",
      language: "ar",
      locale: "ar",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "أهلًا {{1}}،\n\nأنتم مدعوون إلى {{2}} يوم {{3}} في {{4}}.\n\nلن تكتمل فرحتنا إلا بوجودكم، هل تشاركوننا؟",
      variables: ["guest_name", "event_name_ar", "event_date_ar", "venue_ar"],
      footer: "أُرسلت عبر إنفترا",
      buttons: ACCEPT_DECLINE_AR,
      eventTypes: PARTY,
      sortOrder: 9,
    },
    {
      key: "update_en",
      name: "Invitation update",
      nameAr: "تحديث الدعوة",
      description: "Sent to accepted guests when event details change.",
      purpose: "UPDATE",
      metaName: "invtra_invitation_update",
      language: "en",
      locale: "en",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "Hello {{1}}, there is an update to {{2}}. Tap below to view your latest invitation and QR code.",
      variables: ["guest_name", "event_name"],
      footer: "Sent with INVTRA",
      buttons: [{ type: "URL", text: "View Invitation", url: `${base}/i/{{1}}` }],
      eventTypes: ALL,
      sortOrder: 10,
    },
    {
      key: "update_ar",
      name: "Invitation update (Arabic)",
      nameAr: "تحديث الدعوة",
      description: "يُرسل للضيوف الذين قبلوا الدعوة عند تغيير التفاصيل.",
      purpose: "UPDATE",
      metaName: "invtra_invitation_update_ar",
      language: "ar",
      locale: "ar",
      category: "UTILITY",
      headerType: "IMAGE",
      body: "مرحبًا {{1}}، تم تحديث تفاصيل {{2}}. اضغط أدناه لعرض دعوتك ورمز الدخول المحدّث.",
      variables: ["guest_name", "event_name_ar"],
      footer: "أُرسلت عبر إنفترا",
      buttons: [{ type: "URL", text: "عرض الدعوة", url: `${base}/i/{{1}}` }],
      eventTypes: ALL,
      sortOrder: 11,
    },
  ];
}
