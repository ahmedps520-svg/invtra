import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * While INVTRA's own WhatsApp number isn't connected (WHATSAPP_PROVIDER=off), hosts send each
 * guest's invitation from their own WhatsApp. The site must then describe exactly that: Meta
 * reviews the website during business verification, and claims such as "sent from INVTRA's
 * business account through Meta-approved templates" would be untrue. These replace the
 * statements that only hold once the Cloud API is connected.
 */

type Point = { title: string; body: string };

const OWN: Record<
  Locale,
  {
    trademark: string;
    assurance: string;
    whatsappBody: string;
    officialPoint: Point;
    replyPoint: Point;
    faqQ: string;
    faqA: string;
    pricingDelivery: Point;
    pricingMeta: string;
    termsService: string;
    tryFirst: string;
    previewStep: string;
    ctaBody: string;
    testSends: string;
    termsPreview: string;
  }
> = {
  en: {
    trademark: "WhatsApp is a trademark of Meta Platforms, Inc. INVTRA is an independent service and is not affiliated with or endorsed by Meta.",
    assurance: "Personal WhatsApp invitations",
    whatsappBody:
      "Send each guest their own invitation from your WhatsApp in one tap. INVTRA writes every message with the guest's name and personal link, so it arrives like a personal note.",
    officialPoint: {
      title: "Sent from your own WhatsApp",
      body: "Each message goes from your number, ready-written with the guest's name and link. You press send every time — nothing is automated.",
    },
    replyPoint: { title: "Accept or decline in one tap", body: "Guests reply on their personal invitation page. No app, no account, no forms." },
    faqQ: "How are the invitations sent?",
    faqA:
      "From your own WhatsApp. INVTRA prepares each guest's message with their personal invitation link, and you press send. We never use unofficial automation, and nothing is ever sent without you.",
    pricingDelivery: { title: "WhatsApp-ready invitations", body: "Every guest's message and personal link, ready to send from your WhatsApp." },
    pricingMeta: "Simple, one-time pricing per event: a personal invitation link and QR code for every guest, ready to send from your WhatsApp, with replies tracked for you.",
    termsService:
      "INVTRA lets you design digital invitations for weddings, new babies, birthdays, Ramadan gatherings, corporate events and other occasions; send each guest their personal invitation link from your own WhatsApp; collect their replies; and welcome them at the door with personal QR codes.",
    tryFirst: "Yes. Design your invitation and preview exactly what each guest will receive before you pay — you pay only when you're happy with it.",
    previewStep: "See exactly what each guest receives — before you pay.",
    ctaBody: "Create your invitation today and preview it free before you pay.",
    testSends: "Preview every invitation free — see exactly what your guests will receive before you choose a plan.",
    termsPreview: "Before you pay you can preview exactly what each guest will receive. Prices may change in the future, but a change never affects a plan you have already bought.",
  },
  ar: {
    trademark: "واتساب علامة تجارية مملوكة لشركة Meta Platforms. إنفترا خدمة مستقلة لا ترتبط بشركة Meta ولا تحظى برعايتها.",
    assurance: "دعوات شخصية عبر واتساب",
    whatsappBody: "أرسل لكل ضيف دعوته الخاصة من واتساب الخاص بك بلمسة واحدة. تكتب إنفترا كل رسالة باسم الضيف ورابطه الشخصي، فتصل كرسالة شخصية.",
    officialPoint: { title: "من واتساب الخاص بك", body: "تُرسل كل رسالة من رقمك، مكتوبة باسم الضيف ورابطه. أنت من يضغط إرسال في كل مرة — لا شيء آلي." },
    replyPoint: { title: "قبول أو اعتذار بلمسة", body: "يردّ الضيف من صفحة دعوته الشخصية، دون تطبيق أو حساب أو نماذج." },
    faqQ: "كيف تُرسل الدعوات؟",
    faqA: "من واتساب الخاص بك. تجهّز إنفترا رسالة كل ضيف مع رابط دعوته الشخصي، وأنت من يضغط إرسال. لا نستخدم أدوات آلية غير رسمية، ولا يُرسل شيء دون علمك.",
    pricingDelivery: { title: "دعوات جاهزة للواتساب", body: "رسالة كل ضيف ورابطه الشخصي، جاهزة للإرسال من واتساب الخاص بك." },
    pricingMeta: "سعر واحد لكل مناسبة يُدفع مرة واحدة: رابط دعوة شخصي ورمز QR لكل ضيف، جاهز للإرسال من واتساب الخاص بك، مع متابعة الردود.",
    termsService:
      "تتيح لك إنفترا تصميم دعوات رقمية للأعراس واستقبال المواليد وأعياد الميلاد وتجمعات رمضان وفعاليات الشركات وغيرها من المناسبات، وإرسال رابط الدعوة الشخصي لكل ضيف من واتساب الخاص بك، واستقبال ردودهم، والترحيب بهم عند الدخول برموز QR شخصية.",
    tryFirst: "نعم. صمّم دعوتك وعاين ما سيصل إلى كل ضيف بالضبط قبل الدفع — ولا تدفع إلا حين ترضى عنها.",
    previewStep: "شاهد ما سيصل إلى كل ضيف تمامًا — قبل الدفع.",
    ctaBody: "أنشئ دعوتك اليوم، وعاينها مجانًا قبل أن تدفع.",
    testSends: "عاين كل دعوة مجانًا — وشاهد ما سيصل إلى ضيوفك قبل اختيار الباقة.",
    termsPreview: "يمكنك قبل الدفع معاينة ما سيصل إلى كل ضيف بالضبط. وقد تتغير الأسعار مستقبلًا، لكن التغيير لا يؤثر على باقة اشتريتها مسبقًا.",
  },
};

/** The dictionary with the "INVTRA sends through the WhatsApp Business Platform" claims replaced. */
export function ownWhatsAppCopy(dict: Dictionary, locale: Locale): Dictionary {
  const c = OWN[locale];
  const m = dict.marketing;
  const officialFaq = m.faq.items.findIndex((i) => /official WhatsApp|واتساب الرسمي/.test(i.q));
  // Free test sends go through INVTRA's WhatsApp, so without it the free step is the preview.
  const tryFaq = m.faq.items.findIndex((i) => /before I pay|قبل الدفع/.test(i.q));
  const testParagraph = /test sends|رسائل تجريبية/;
  return {
    ...dict,
    marketing: {
      ...m,
      footer: { ...m.footer, trademark: c.trademark },
      hero: { ...m.hero, assurances: [c.assurance, ...m.hero.assurances.slice(1)] },
      whatsapp: {
        ...m.whatsapp,
        body: c.whatsappBody,
        points: m.whatsapp.points.map((p, i) => (i === 0 ? c.officialPoint : i === 1 ? c.replyPoint : p)),
      },
      faq: {
        ...m.faq,
        items: m.faq.items.map((item, i) => (i === officialFaq ? { ...item, q: c.faqQ, a: c.faqA } : i === tryFaq ? { ...item, a: c.tryFirst } : item)),
      },
      how: { ...m.how, steps: m.how.steps.map((step, i) => (i === 3 ? { ...step, body: c.previewStep } : step)) },
      cta: { ...m.cta, body: c.ctaBody },
      pricing: { ...m.pricing, testSends: c.testSends },
      pricingPage: { ...m.pricingPage, included: m.pricingPage.included.map((p, i) => (i === 0 ? c.pricingDelivery : p)) },
      meta: { ...m.meta, pricingDescription: c.pricingMeta },
      legal: {
        ...m.legal,
        terms: {
          ...m.legal.terms,
          sections: m.legal.terms.sections.map((s) =>
            s.id === "service"
              ? { ...s, body: [c.termsService, ...s.body.slice(1)] }
              : s.id === "payments"
                ? { ...s, body: s.body.map((para) => (testParagraph.test(para) ? c.termsPreview : para)) }
                : s,
          ),
        },
      },
    },
  } as Dictionary;
}

const BANK_TRANSFER: Record<Locale, string> = {
  en: "Prices in Saudi riyals, VAT included where applicable. Pay by bank transfer — your order goes ahead as soon as we've confirmed the transfer.",
  ar: "الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة حيثما تنطبق. الدفع بالتحويل البنكي — نبدأ بطلبك فور تأكيدنا للتحويل.",
};

/** Payments by bank transfer only (PAYMENT_PROVIDER=manual): no card or Apple Pay claims. */
export function bankTransferCopy(dict: Dictionary, locale: Locale): Dictionary {
  return { ...dict, marketing: { ...dict.marketing, pricing: { ...dict.marketing.pricing, payWith: BANK_TRANSFER[locale] } } } as Dictionary;
}
