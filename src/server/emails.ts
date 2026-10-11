import type { Order } from "@prisma/client";
import { appUrl, env } from "@/server/env";
import { bankDetails, formatIban, orderReference } from "@/server/payments/bank";
import type { EmailBlock, EmailContent } from "@/server/email-template";
import { formatDate, formatMoney } from "@/lib/format";
import { whenLabel } from "@/lib/event-when";
import { isUnlimited } from "@/lib/plans";
import { supportChatUrl } from "@/lib/support";

/** What INVTRA's emails say, in the customer's language (the design is in email-template.ts). */

export type Mail = EmailContent & { subject: string };

/** "Unlimited guests" / "Up to 500 guests". */
function guests(limit: number, ar: boolean) {
  if (isUnlimited(limit)) return ar ? "عدد غير محدود من الضيوف" : "Unlimited guests";
  return ar ? `حتى ${limit.toLocaleString("ar")} ضيف` : `Up to ${limit.toLocaleString("en")} guests`;
}

type PaymentOrder = Pick<Order, "id" | "amount" | "currency" | "guestLimit" | "title" | "dueAt" | "payToken" | "eventId"> & {
  user: { name: string; locale: string };
  event: {
    title: string;
    titleAr: string | null;
    startsAt: Date;
    timezone: string;
    dateTbd: boolean;
    timeTbd: boolean;
    venueName: string;
    venueNameAr: string | null;
  } | null;
};

/** The payment link for a custom package: the invitation, what's included, the total and how to pay. */
export async function paymentRequestEmail(order: PaymentOrder, setupLink: string | null): Promise<Mail> {
  const ar = order.user.locale === "ar";
  const lang = ar ? "ar" : "en";
  const ev = order.event;
  const event = (ar ? ev?.titleAr || ev?.title : ev?.title) ?? "INVTRA";
  const amount = formatMoney(order.amount, order.currency, lang);
  const link = appUrl(`/pay/${order.payToken}${ar ? "?lang=ar" : ""}`);
  const transfer = env().PAYMENT_PROVIDER === "manual" ? await bankDetails() : null;
  const ref = orderReference(order.id);
  const venue = ev ? (ar ? ev.venueNameAr || ev.venueName : ev.venueName || ev.venueNameAr) : null;

  const rows: { label: string; value: string }[] = [];
  if (ev) rows.push({ label: ar ? "الموعد" : "When", value: whenLabel(ev, lang) });
  if (venue) rows.push({ label: ar ? "المكان" : "Where", value: venue });
  rows.push({ label: ar ? "الباقة" : "Package", value: guests(order.guestLimit, ar) });
  if (order.title) rows.push({ label: ar ? "ما تتضمنه الباقة" : "What's included", value: order.title });
  if (order.dueAt) {
    rows.push({ label: ar ? "يرجى الدفع قبل" : "Please pay by", value: formatDate(order.dueAt, { locale: lang, timeZone: ev?.timezone ?? "Asia/Riyadh", style: "long" }) });
  }

  const blocks: EmailBlock[] = [
    { kind: "p", text: ar ? `مرحبًا ${order.user.name}،` : `Hello ${order.user.name},` },
    {
      kind: "p",
      text: ar
        ? ["جهّزنا باقة دعوات ", { b: event }, ". هذا تصميم دعوتك وكل ما تتضمنه الباقة — راجعها وأكمل الدفع لتبدأ بدعوة ضيوفك."]
        : ["We've prepared your invitation package for ", { b: event }, ". Here's your invitation design and everything included — review it and complete the payment to start inviting your guests."],
    },
  ];
  if (ev && order.payToken) {
    blocks.push({
      kind: "image",
      src: appUrl(`/pay/${order.payToken}/card`),
      alt: ar ? `تصميم دعوة ${event}` : `Invitation design for ${event}`,
      width: 240,
      href: link,
      caption: ar ? "تصميم دعوتك" : "Your invitation design",
    });
  }
  blocks.push(
    { kind: "details", rows },
    { kind: "amount", label: ar ? "الإجمالي" : "Total", value: amount, note: ar ? "بالريال السعودي، شامل ضريبة القيمة المضافة" : "In Saudi riyals, VAT included" },
    {
      kind: "button",
      label: transfer ? (ar ? "عرض الباقة وتفاصيل الدفع" : "View package & payment details") : ar ? "مراجعة ودفع" : "Review & pay",
      href: link,
      fallback: ar ? "أو افتح هذا الرابط:" : "Or open this link:",
    },
  );
  if (transfer) {
    const receipt = supportChatUrl(
      env().SUPPORT_WHATSAPP,
      ar ? `مرحبًا إنفترا، حوّلت ${amount} لمناسبة ${event} (المرجع ${ref}). هذا إيصال التحويل:` : `Hello INVTRA, I've transferred ${amount} for ${event} (reference ${ref}). Here is the transfer receipt:`,
    );
    blocks.push({
      kind: "box",
      title: ar ? "الدفع بالتحويل البنكي" : "Pay by bank transfer",
      text: ar
        ? `حوّل ${amount} إلى الحساب التالي، ثم أرسل لنا إيصال التحويل على واتساب. نفعّل باقتك فور التأكد من التحويل.`
        : `Transfer ${amount} to the account below, then send us the transfer receipt on WhatsApp. We activate your package as soon as it's confirmed.`,
      rows: [
        { label: ar ? "البنك" : "Bank", value: ar ? transfer.bankAr || transfer.bank : transfer.bank },
        { label: ar ? "اسم المستفيد" : "Account name", value: transfer.name },
        { label: ar ? "الآيبان" : "IBAN", value: formatIban(transfer.iban), ltr: true },
        ...(transfer.account ? [{ label: ar ? "رقم الحساب" : "Account number", value: transfer.account, ltr: true }] : []),
        { label: ar ? "المرجع" : "Reference", value: ref, ltr: true },
      ],
      footer: [{ a: ar ? "أرسل إيصال التحويل على واتساب" : "Send the transfer receipt on WhatsApp", href: receipt }],
    });
  }
  if (setupLink) {
    blocks.push({
      kind: "box",
      title: ar ? "حسابك في إنفترا" : "Your INVTRA account",
      text: ar
        ? `أنشأنا لك حسابًا لإدارة ${event} — قائمة الضيوف، والردود، وتسجيل الدخول عند الباب.`
        : `We've created an account for you to manage ${event} — your guest list, replies and check-in at the door.`,
      footer: [{ a: ar ? "اختر كلمة المرور" : "Choose your password", href: setupLink }, ar ? " (الرابط صالح 7 أيام)" : " (the link is valid for 7 days)"],
    });
  }
  blocks.push({
    kind: "p",
    muted: true,
    text: ar ? "لديك سؤال؟ ردّ على هذه الرسالة أو راسلنا على واتساب." : "Any questions? Reply to this email or message us on WhatsApp.",
  });

  return {
    lang,
    subject: ar ? `باقة دعوات ${event} جاهزة — إنفترا` : `Your invitation package for ${event} is ready`,
    preheader: ar ? `${amount} · ${guests(order.guestLimit, true)} — راجع دعوتك وأكمل الدفع.` : `${amount} · ${guests(order.guestLimit, false)} — review your invitation and pay securely.`,
    eyebrow: ar ? "باقة دعواتك" : "Your invitation package",
    title: event,
    blocks,
  };
}

/** Receipt after any payment. */
export function receiptEmail(o: {
  name: string;
  locale: string;
  number: string;
  amount: string;
  paidOn: string;
  event: string;
  link: string;
  eventId: string | null;
}): Mail {
  const ar = o.locale === "ar";
  const blocks: EmailBlock[] = [
    { kind: "p", text: ar ? `مرحبًا ${o.name}،` : `Hello ${o.name},` },
    {
      kind: "p",
      text: ar
        ? ["استلمنا دفعتك لمناسبة ", { b: o.event }, " وأصبحت باقتك مفعّلة. يمكنك الآن إضافة ضيوفك وإرسال دعواتك."]
        : ["We've received your payment for ", { b: o.event }, " and your package is now active. You can add your guests and start sending your invitations."],
    },
    {
      kind: "details",
      rows: [
        { label: ar ? "رقم الإيصال" : "Receipt number", value: o.number },
        { label: ar ? "تاريخ الدفع" : "Paid on", value: o.paidOn },
        { label: ar ? "المناسبة" : "Event", value: o.event },
      ],
    },
    { kind: "amount", label: ar ? "المبلغ المدفوع" : "Amount paid", value: o.amount, note: ar ? "شامل ضريبة القيمة المضافة" : "VAT included" },
    { kind: "button", label: ar ? "عرض الإيصال" : "View your receipt", href: o.link },
  ];
  if (o.eventId) blocks.push({ kind: "secondary", label: ar ? "افتح مناسبتك" : "Open your event", href: appUrl(`/dashboard/events/${o.eventId}`) });
  blocks.push({ kind: "p", muted: true, text: ar ? "شكرًا لاختيارك إنفترا." : "Thank you for choosing INVTRA." });
  return {
    lang: ar ? "ar" : "en",
    subject: ar ? `إيصال الدفع ${o.number} — إنفترا` : `Your INVTRA receipt ${o.number}`,
    preheader: ar ? `استلمنا ${o.amount} — باقتك مفعّلة.` : `We received ${o.amount} — your package is active.`,
    eyebrow: ar ? "تم الدفع" : "Payment received",
    title: ar ? "شكرًا لك" : "Thank you",
    blocks,
  };
}

/** "Forgot password". */
export function passwordResetEmail(o: { name: string; locale: string; link: string }): Mail {
  const ar = o.locale === "ar";
  return {
    lang: ar ? "ar" : "en",
    subject: ar ? "إعادة تعيين كلمة المرور — إنفترا" : "Reset your INVTRA password",
    preheader: ar ? "رابط لاختيار كلمة مرور جديدة، صالح لمدة ساعة." : "A link to choose a new password, valid for one hour.",
    eyebrow: ar ? "حسابك" : "Your account",
    title: ar ? "إعادة تعيين كلمة المرور" : "Reset your password",
    blocks: [
      { kind: "p", text: ar ? `مرحبًا ${o.name}،` : `Hi ${o.name},` },
      {
        kind: "p",
        text: ar
          ? "وصلنا طلب لإعادة تعيين كلمة مرور حسابك في إنفترا. اضغط الزر أدناه لاختيار كلمة مرور جديدة — الرابط صالح لمدة ساعة."
          : "We received a request to reset the password for your INVTRA account. Press the button below to choose a new one — the link is valid for one hour.",
      },
      { kind: "button", label: ar ? "اختر كلمة مرور جديدة" : "Choose a new password", href: o.link, fallback: ar ? "أو افتح هذا الرابط:" : "Or open this link:" },
      {
        kind: "p",
        muted: true,
        text: ar ? "إذا لم تطلب ذلك، تجاهل هذه الرسالة — تبقى كلمة مرورك كما هي." : "If you didn't ask for this, you can ignore this email — your password stays the same.",
      },
    ],
  };
}
