import type { Event, Guest, MessageTemplate } from "@prisma/client";
import { db } from "@/server/db";
import { formatDate, formatTime } from "@/lib/format";
import {
  buttonPayload,
  isTemplateButtons,
  renderTemplateBody,
  sanitizeParam,
  type TemplateVariable,
} from "@/lib/whatsapp/templates";
import { eventDesign } from "@/server/events/design";
import type { MessageContent, SendTemplateParams, TemplateComponent } from "./types";

export type MessageLocale = "en" | "ar" | "bilingual";

export function eventLocale(event: Pick<Event, "language">): MessageLocale {
  return event.language === "AR" ? "ar" : event.language === "BILINGUAL" ? "bilingual" : "en";
}

export function guestLocale(event: Pick<Event, "language">, guest: Pick<Guest, "locale">): MessageLocale {
  if (guest.locale === "en" || guest.locale === "ar") return guest.locale;
  return eventLocale(event);
}

type EventForValues = Pick<
  Event,
  "hostNames" | "hostNamesAr" | "title" | "titleAr" | "startsAt" | "timezone" | "venueName" | "venueNameAr" | "templateVariables" | "themeKey" | "design"
>;

/** Values for every template variable, with the customer's per-event overrides applied. */
export function templateValues(event: EventForValues, guest: Pick<Guest, "name">, token: string): Record<TemplateVariable, string> {
  const digits = eventDesign(event).digits;
  const overrides = (event.templateVariables ?? {}) as Partial<Record<TemplateVariable, string>>;
  const pick = (k: TemplateVariable, fallback: string) => {
    const v = overrides[k];
    return typeof v === "string" && v.trim() ? v.trim() : fallback;
  };
  return {
    guest_name: guest.name,
    host_names: pick("host_names", event.hostNames),
    host_names_ar: pick("host_names_ar", event.hostNamesAr || event.hostNames),
    event_name: pick("event_name", event.title),
    event_name_ar: pick("event_name_ar", event.titleAr || event.title),
    event_date: formatDate(event.startsAt, { locale: "en", timeZone: event.timezone, style: "full" }),
    event_date_ar: formatDate(event.startsAt, { locale: "ar", timeZone: event.timezone, style: "full", digits }),
    event_time: formatTime(event.startsAt, { locale: "en", timeZone: event.timezone }),
    event_time_ar: formatTime(event.startsAt, { locale: "ar", timeZone: event.timezone, digits }),
    venue: pick("venue", event.venueName),
    venue_ar: pick("venue_ar", event.venueNameAr || event.venueName),
    invitation_token: token,
  };
}

/** Build the Cloud API components + a rendered preview for a template send. */
export function composeTemplate(
  template: Pick<MessageTemplate, "metaName" | "language" | "body" | "variables" | "headerType" | "footer" | "buttons">,
  values: Record<TemplateVariable, string>,
  opts: { to: string; token: string; headerMediaId?: string | null; headerImageKey?: string | null },
): { params: SendTemplateParams; content: MessageContent } {
  const variables = (template.variables ?? []) as TemplateVariable[];
  const buttons = isTemplateButtons(template.buttons) ? template.buttons : [];
  const components: TemplateComponent[] = [];
  if (template.headerType === "IMAGE") {
    if (!opts.headerMediaId) throw new Error("Template requires a header image");
    components.push({ type: "header", parameters: [{ type: "image", image: { id: opts.headerMediaId } }] });
  }
  if (variables.length) {
    components.push({ type: "body", parameters: variables.map((v) => ({ type: "text" as const, text: sanitizeParam(values[v] ?? "") })) });
  }
  buttons.forEach((b, index) => {
    if (b.type === "QUICK_REPLY") {
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index: String(index),
        parameters: [{ type: "payload", payload: buttonPayload(b.action, opts.token) }],
      });
    } else if (b.type === "URL" && b.url.includes("{{1}}")) {
      components.push({ type: "button", sub_type: "url", index: String(index), parameters: [{ type: "text", text: opts.token }] });
    }
  });
  return {
    params: { to: opts.to, templateName: template.metaName, languageCode: template.language, components },
    content: {
      kind: "template",
      templateName: template.metaName,
      language: template.language,
      headerImageKey: opts.headerImageKey ?? null,
      body: renderTemplateBody({ body: template.body, variables }, values),
      footer: template.footer,
      buttons: buttons.map((b) =>
        b.type === "QUICK_REPLY"
          ? { type: "QUICK_REPLY" as const, text: b.text, payload: buttonPayload(b.action, opts.token) }
          : { type: "URL" as const, text: b.text, url: b.url.replace("{{1}}", opts.token) },
      ),
    },
  };
}

/**
 * Choose the approved invitation template for a guest: the event's chosen template
 * when it matches the guest's language, otherwise the same style in that language,
 * otherwise any approved template for the language.
 */
export async function pickTemplate(
  event: Pick<Event, "type" | "language" | "messageTemplateId">,
  guest: Pick<Guest, "locale">,
  purpose: "INVITATION" | "UPDATE" = "INVITATION",
): Promise<MessageTemplate | null> {
  const locale = guestLocale(event, guest);
  const candidates = await db.messageTemplate.findMany({
    where: { purpose, status: "APPROVED", isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const forLocale = candidates.filter((t) => t.locale === locale || (locale === "bilingual" && t.locale === "ar"));
  if (purpose === "INVITATION" && event.messageTemplateId) {
    const chosen = candidates.find((t) => t.id === event.messageTemplateId);
    if (chosen && chosen.locale === locale) return chosen;
    if (chosen) {
      const family = chosen.key.replace(/_(en|ar)$/, "");
      const sibling = forLocale.find((t) => t.key.replace(/_(en|ar)$/, "") === family && t.locale === locale);
      if (sibling) return sibling;
    }
  }
  const exact = candidates.filter((t) => t.locale === locale);
  const pool = exact.length ? exact : forLocale;
  return pool.find((t) => t.eventTypes.includes(event.type)) ?? pool[0] ?? null;
}

const DELIVERY = {
  en: {
    body: (title: string) =>
      `Thank you for accepting! 🤍\n\nHere is your personal invitation to ${title}. Please present your QR code at the entrance.`,
    button: "View Invitation",
    decline: "Thank you for letting us know. We'll miss you!",
    footer: "INVTRA",
    closed: "This invitation is no longer active. Please contact the host directly.",
    deadline: "RSVPs for this event have closed. Please contact the host directly.",
  },
  ar: {
    body: (title: string) => `شكرًا لقبولكم الدعوة 🤍\n\nإليكم دعوتكم الخاصة لحضور ${title}. يرجى إبراز رمز QR عند الدخول.`,
    button: "عرض الدعوة",
    decline: "شكرًا لإعلامنا، سنفتقد حضوركم.",
    footer: "إنفترا",
    closed: "هذه الدعوة لم تعد متاحة. يرجى التواصل مع صاحب الدعوة مباشرة.",
    deadline: "انتهت مهلة تأكيد الحضور لهذه المناسبة. يرجى التواصل مع صاحب الدعوة مباشرة.",
  },
};

export function deliveryCopy(locale: MessageLocale, event: Pick<Event, "title" | "titleAr">) {
  if (locale === "en") return { body: DELIVERY.en.body(event.title), button: DELIVERY.en.button, footer: DELIVERY.en.footer };
  if (locale === "ar") return { body: DELIVERY.ar.body(event.titleAr || event.title), button: DELIVERY.ar.button, footer: DELIVERY.ar.footer };
  return {
    body: `${DELIVERY.ar.body(event.titleAr || event.title)}\n\n${DELIVERY.en.body(event.title)}`,
    button: "View · عرض الدعوة",
    footer: "INVTRA · إنفترا",
  };
}

export function systemText(locale: MessageLocale, key: "decline" | "closed" | "deadline"): string {
  if (locale === "bilingual") return `${DELIVERY.ar[key]}\n\n${DELIVERY.en[key]}`;
  return DELIVERY[locale][key];
}

export { sanitizeParam };
