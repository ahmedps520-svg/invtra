import type { Locale } from "@/lib/i18n/config";
import type { SendingMode } from "@/lib/marketing/links";
import { INVITATIONS_HUB, type OccasionCopy, type OccasionPage } from "./occasion-pages";

/**
 * The occasion pages are written for INVTRA's own WhatsApp number (guests answer with buttons in
 * the chat). While it isn't connected, hosts send from their own WhatsApp and guests answer on
 * their invitation page, so these sentences are swapped for ones that are true (see sending-mode.ts).
 */
const OWN: Record<Locale, [string, string][]> = {
  en: [
    [
      "INVTRA delivers it through the official WhatsApp Business Platform and gives each guest their own invitation page and entry QR code.",
      "Send it from your own WhatsApp in a tap — each guest gets their own invitation page and entry QR code.",
    ],
    ["Guests tap Accept or Decline in WhatsApp.", "Guests tap Accept or Decline on their invitation page."],
    ["They tap Accept Invitation or Decline in WhatsApp.", "They tap Accept or Decline on their personal invitation page."],
    ["and INVTRA sends each guest their own invitation on WhatsApp.", "and send each guest their own invitation from your WhatsApp."],
    ["and INVTRA sends every guest their own invitation on WhatsApp.", "and send every guest their own invitation from your WhatsApp."],
    ["Guests reply in WhatsApp, and you always know", "Guests reply with one tap, and you always know"],
    ["and INVTRA delivers each invitation on WhatsApp.", "and send each invitation from your WhatsApp."],
    ["and let guests reply in WhatsApp.", "and let guests reply with one tap."],
    ["No. Messages arrive from INVTRA's verified WhatsApp Business account.", "No. The message comes from your own WhatsApp with the guest's personal link — there's nothing for them to save or install."],
    ["and INVTRA delivers each invitation personally on WhatsApp.", "and send each invitation personally from your WhatsApp."],
    ["Guests just tap a button in WhatsApp — no links to copy and nothing to install.", "Guests just tap a button on their invitation page — nothing to install."],
    [
      "INVTRA sends branded invitations on WhatsApp, tracks every reply and checks guests in with a scan.",
      "Send branded invitations from your WhatsApp, track every reply and check guests in with a scan.",
    ],
    [
      "Invitations arrive in WhatsApp through the official WhatsApp Business Platform — no apps, emails or spam folders.",
      "Invitations arrive in WhatsApp, sent personally from your own number — no apps, emails or spam folders.",
    ],
    [
      "Accept or Decline buttons right in the message. Your guest list updates the moment someone answers.",
      "Accept or Decline in one tap on each guest's invitation page. Your guest list updates the moment someone answers.",
    ],
  ],
  ar: [
    ["تُرسل إنفترا الدعوة عبر منصة واتساب للأعمال الرسمية، ويحصل كل ضيف", "أرسلها من واتساب الخاص بك بلمسة واحدة، ويحصل كل ضيف"],
    ["يضغط الضيف «قبول» أو «اعتذار» في واتساب،", "يضغط الضيف «قبول» أو «اعتذار» في صفحة دعوته،"],
    ["يضغطون «قبول الدعوة» أو «اعتذار» في واتساب.", "يضغطون «قبول» أو «اعتذار» في صفحة دعوتهم الشخصية."],
    ["وتتكفّل إنفترا بإرسال دعوة خاصة لكل ضيف عبر واتساب.", "وأرسل لكل ضيف دعوته الخاصة من واتساب الخاص بك."],
    ["وتُرسل إنفترا لكل ضيف دعوته الخاصة عبر واتساب.", "وأرسل لكل ضيف دعوته الخاصة من واتساب الخاص بك."],
    ["يرد الضيوف عبر واتساب،", "يرد الضيوف بضغطة واحدة،"],
    ["ودع الضيوف يردون عبر واتساب.", "ودع الضيوف يردون بضغطة واحدة."],
    ["لا. تصل الرسائل من حساب واتساب للأعمال الموثّق الخاص بإنفترا.", "لا. تصل الرسالة من واتساب الخاص بك مع رابط الضيف الشخصي — لا شيء ليحفظه أو يثبّته."],
    ["يكفي أن يضغط الضيف زرًا في واتساب — لا روابط لنسخها ولا شيء لتثبيته.", "يكفي أن يضغط الضيف زرًا في صفحة دعوته — دون أي شيء لتثبيته."],
    ["ترسل إنفترا دعوات بهويتك عبر واتساب، وتتابع كل رد، وتسجّل الحضور بمسح الرمز.", "أرسل دعوات بهويتك من واتساب الخاص بك، وتابِع كل رد، وسجّل الحضور بمسح الرمز."],
    ["تصل الدعوات إلى واتساب عبر منصة واتساب للأعمال الرسمية — دون تطبيقات أو بريد إلكتروني أو رسائل مزعجة.", "تصل الدعوات إلى واتساب مرسلةً من رقمك شخصيًا — دون تطبيقات أو بريد إلكتروني أو رسائل مزعجة."],
    ["زرّا القبول والاعتذار داخل الرسالة، وتتحدّث قائمة ضيوفك لحظة الرد.", "قبول أو اعتذار بضغطة واحدة في صفحة دعوة كل ضيف، وتتحدّث قائمة ضيوفك لحظة الرد."],
  ],
};

function swap(text: string, locale: Locale): string {
  return OWN[locale].reduce((t, [from, to]) => t.split(from).join(to), text);
}

/** The page's copy as true for this deployment. */
export function occasionCopy(page: OccasionPage, locale: Locale, mode: SendingMode): OccasionCopy {
  const c = page[locale];
  if (mode === "cloud") return c;
  return {
    ...c,
    intro: swap(c.intro, locale),
    points: c.points.map((p) => ({ ...p, body: swap(p.body, locale) })),
    faq: c.faq.map((f) => ({ ...f, a: swap(f.a, locale) })),
  };
}

export function hubCopy(locale: Locale, mode: SendingMode) {
  const h = INVITATIONS_HUB[locale];
  if (mode === "cloud") return h;
  return { ...h, reasons: h.reasons.map((r) => ({ ...r, body: swap(r.body, locale) })) };
}
