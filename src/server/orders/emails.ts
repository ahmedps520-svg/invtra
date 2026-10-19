import type { Order, OrderFile } from "@prisma/client";
import { appUrl, env } from "@/server/env";
import { formatIban, orderReference, type BankDetails } from "@/server/payments/bank";
import type { EmailBlock } from "@/server/email-template";
import type { Mail } from "@/server/emails";
import { formatMoney } from "@/lib/format";
import { supportChatUrl } from "@/lib/support";
import { productName } from "@/lib/products";

/** What INVTRA tells customers (and staff) as an order moves along. */

type MailOrder = Pick<Order, "id" | "amount" | "currency" | "product" | "transferReference" | "receiptNumber"> & {
  user: { name: string; locale: string };
  event: { title: string; titleAr: string | null } | null;
};

const greet = (o: MailOrder, ar: boolean): EmailBlock => ({ kind: "p", text: ar ? `مرحبًا ${o.user.name}،` : `Hello ${o.user.name},` });
const eventTitle = (o: MailOrder, ar: boolean) => (ar ? o.event?.titleAr || o.event?.title : o.event?.title) ?? "INVTRA";
const orderLink = (o: MailOrder) => appUrl(`/dashboard/orders/${o.id}`);

function summary(o: MailOrder, ar: boolean): EmailBlock {
  return {
    kind: "details",
    rows: [
      { label: ar ? "رقم الطلب" : "Order number", value: orderReference(o.id) },
      { label: ar ? "الطلب" : "Order", value: productName(o.product, ar) },
      { label: ar ? "المناسبة" : "Event", value: eventTitle(o, ar) },
    ],
  };
}

/** Right after the customer submits: how to pay, and that staff confirm the transfer by hand. */
export function orderSubmittedEmail(o: MailOrder, bank: BankDetails): Mail {
  const ar = o.user.locale === "ar";
  const ref = orderReference(o.id);
  const amount = formatMoney(o.amount, o.currency, ar ? "ar" : "en");
  return {
    lang: ar ? "ar" : "en",
    subject: ar ? `استلمنا طلبك ${ref} — إنفترا` : `We've received your order ${ref}`,
    preheader: ar ? `حوّل ${amount} وسنؤكد الدفع ونبدأ بطلبك.` : `Transfer ${amount} and we'll confirm it and get started.`,
    eyebrow: ar ? "تم استلام الطلب" : "Order received",
    title: ar ? "بانتظار تأكيد الدفع" : "Waiting for payment confirmation",
    blocks: [
      greet(o, ar),
      {
        kind: "p",
        text: ar
          ? "شكرًا لطلبك. سيتحقق فريقنا من وصول التحويل البنكي، ثم نؤكد الدفع ونرسل لك ملفاتك. لن يُعتبر الطلب مدفوعًا قبل ذلك."
          : "Thank you for your order. Our team will check that your bank transfer has arrived, then confirm the payment and send you your files. The order isn't treated as paid until then.",
      },
      summary(o, ar),
      { kind: "amount", label: ar ? "المبلغ المطلوب" : "Amount to transfer", value: amount, note: ar ? "شامل ضريبة القيمة المضافة" : "VAT included" },
      {
        kind: "box",
        title: ar ? "بيانات التحويل" : "Bank transfer details",
        rows: [
          { label: ar ? "البنك" : "Bank", value: ar ? bank.bankAr || bank.bank : bank.bank },
          { label: ar ? "اسم المستفيد" : "Account name", value: bank.name },
          { label: "IBAN", value: formatIban(bank.iban), ltr: true },
          ...(bank.account ? [{ label: ar ? "رقم الحساب" : "Account number", value: bank.account, ltr: true }] : []),
          { label: ar ? "اكتب في الملاحظة" : "Reference to quote", value: ref, ltr: true },
        ],
      },
      { kind: "button", label: ar ? "افتح طلبك" : "Open your order", href: orderLink(o) },
      {
        kind: "p",
        muted: true,
        text: ar
          ? "يمكنك رفع إيصال التحويل من صفحة الطلب لتسريع التأكيد."
          : "You can upload your transfer receipt on the order page to help us confirm it faster.",
      },
    ],
  };
}

/** Staff: a new (or re-submitted) order needs its payment checked. */
export function adminNewOrderEmail(o: MailOrder & { user: { email: string } }, opts: { resubmitted: boolean }): Mail {
  const ref = orderReference(o.id);
  const amount = formatMoney(o.amount, o.currency, "en");
  return {
    lang: "en",
    subject: `${opts.resubmitted ? "Updated" : "New"} order to verify: ${ref} · ${amount}`,
    preheader: `${o.user.name} · ${productName(o.product, false)} · ${eventTitle(o, false)}`,
    eyebrow: "Payment verification",
    title: opts.resubmitted ? "The customer replied" : "New order to verify",
    blocks: [
      {
        kind: "details",
        rows: [
          { label: "Order", value: ref },
          { label: "Customer", value: `${o.user.name} (${o.user.email})` },
          { label: "Product", value: productName(o.product, false) },
          { label: "Event", value: eventTitle(o, false) },
          { label: "Transfer reference", value: o.transferReference || "—" },
        ],
      },
      { kind: "amount", label: "Amount", value: amount },
      { kind: "p", text: "Check the bank account for the transfer before approving. A receipt alone isn't proof that the money arrived." },
      { kind: "button", label: "Review the order", href: appUrl(`/admin/orders/${o.id}`) },
    ],
  };
}

/** Staff couldn't confirm the payment. */
export function orderRejectedEmail(o: MailOrder, reason: string): Mail {
  const ar = o.user.locale === "ar";
  const ref = orderReference(o.id);
  return {
    lang: ar ? "ar" : "en",
    subject: ar ? `تعذّر تأكيد الدفع للطلب ${ref}` : `We couldn't confirm the payment for ${ref}`,
    preheader: reason.slice(0, 120),
    eyebrow: ar ? "الدفع غير مؤكد" : "Payment not confirmed",
    title: ar ? "تعذّر تأكيد الدفع" : "We couldn't confirm your payment",
    blocks: [
      greet(o, ar),
      summary(o, ar),
      { kind: "box", title: ar ? "السبب" : "Reason", text: reason },
      {
        kind: "p",
        text: ar
          ? "يمكنك تصحيح ذلك وإعادة إرسال الطلب من صفحة الطلب، أو التواصل معنا إن كان لديك استفسار."
          : "You can put it right and resubmit the order from the order page, or contact us if you have a question.",
      },
      { kind: "button", label: ar ? "افتح طلبك" : "Open your order", href: orderLink(o) },
      {
        kind: "secondary",
        label: ar ? "تواصل معنا على واتساب" : "Contact us on WhatsApp",
        href: supportChatUrl(env().SUPPORT_WHATSAPP, ar ? `مرحبًا إنفترا، لدي سؤال عن الطلب ${ref}.` : `Hello INVTRA, I have a question about order ${ref}.`),
      },
    ],
  };
}

/** Staff need more information before deciding. */
export function orderInfoEmail(o: MailOrder, message: string): Mail {
  const ar = o.user.locale === "ar";
  const ref = orderReference(o.id);
  return {
    lang: ar ? "ar" : "en",
    subject: ar ? `نحتاج معلومة إضافية عن طلبك ${ref}` : `We need a little more information about ${ref}`,
    preheader: message.slice(0, 120),
    eyebrow: ar ? "مطلوب معلومات" : "Information needed",
    title: ar ? "نحتاج معلومة إضافية" : "One more thing",
    blocks: [
      greet(o, ar),
      summary(o, ar),
      { kind: "box", title: ar ? "ما نحتاجه" : "What we need", text: message },
      { kind: "button", label: ar ? "الرد من صفحة الطلب" : "Reply on the order page", href: orderLink(o) },
    ],
  };
}

/** Payment approved; INVTRA's designers are now making the custom design. */
export function orderInProductionEmail(o: MailOrder): Mail {
  const ar = o.user.locale === "ar";
  const ref = orderReference(o.id);
  return {
    lang: ar ? "ar" : "en",
    subject: ar ? `تم تأكيد الدفع — بدأنا تصميم ${ref}` : `Payment approved — we've started on ${ref}`,
    preheader: ar ? "سنرسل لك التصميم النهائي حال جاهزيته." : "We'll send you the final design as soon as it's ready.",
    eyebrow: ar ? "تم تأكيد الدفع" : "Payment approved",
    title: ar ? "بدأ مصممونا العمل" : "Our designers have started",
    blocks: [
      greet(o, ar),
      {
        kind: "p",
        text: ar
          ? "أكّدنا وصول دفعتك، وبدأ فريق التصميم العمل على دعوتك حسب طلبك. سنرسل لك التصميم النهائي بالبريد وفي حسابك حال جاهزيته."
          : "We've confirmed your payment and our design team has started on your invitation from your brief. We'll email you the final design, and add it to your account, as soon as it's ready.",
      },
      summary(o, ar),
      ...(o.receiptNumber
        ? [{ kind: "secondary" as const, label: ar ? `الإيصال ${o.receiptNumber}` : `Receipt ${o.receiptNumber}`, href: appUrl(`/receipt/${o.id}`) }]
        : []),
      { kind: "button", label: ar ? "افتح طلبك" : "Open your order", href: orderLink(o) },
    ],
  };
}

/** Approved and ready: the final files (secure links) and what to do next. */
export function orderDeliveredEmail(
  o: MailOrder & { eventId: string | null },
  files: (Pick<OrderFile, "name"> & { url: string })[],
  opts: { guests: boolean },
): Mail {
  const ar = o.user.locale === "ar";
  const ref = orderReference(o.id);
  const blocks: EmailBlock[] = [
    greet(o, ar),
    {
      kind: "p",
      text: ar
        ? "أكّدنا دفعتك وأصبحت ملفاتك جاهزة. نزّلها بالجودة الكاملة من الروابط أدناه (صالحة لمدة 14 يومًا)، وتبقى متاحة دائمًا في صفحة طلبك."
        : "We've confirmed your payment and your files are ready. Download them in full quality from the links below (they work for 14 days); they're always available on your order page too.",
    },
    summary(o, ar),
    ...files.map(
      (f, i): EmailBlock =>
        i === 0
          ? { kind: "button", label: ar ? "تنزيل الملف النهائي" : "Download your final file", href: f.url, fallback: f.name }
          : { kind: "secondary", label: ar ? `تنزيل ${f.name}` : `Download ${f.name}`, href: f.url },
    ),
    { kind: "secondary", label: ar ? "افتح طلبك" : "Open your order", href: orderLink(o) },
  ];
  if (o.receiptNumber)
    blocks.push({ kind: "secondary", label: ar ? `الإيصال ${o.receiptNumber}` : `Receipt ${o.receiptNumber}`, href: appUrl(`/receipt/${o.id}`) });
  if (opts.guests && o.eventId) {
    blocks.push({
      kind: "p",
      text: ar ? "الخطوة التالية: أضف ضيوفك وأرسل لكل منهم دعوته الشخصية." : "Next: add your guests and send each of them their personal invitation.",
    });
    blocks.push({ kind: "secondary", label: ar ? "أضف ضيوفك" : "Add your guests", href: appUrl(`/dashboard/events/${o.eventId}/guests`) });
  }
  blocks.push({ kind: "p", muted: true, text: ar ? "شكرًا لاختيارك إنفترا." : "Thank you for choosing INVTRA." });
  return {
    lang: ar ? "ar" : "en",
    subject: ar ? `ملفاتك جاهزة — الطلب ${ref}` : `Your files are ready — order ${ref}`,
    preheader: ar ? "تم تأكيد الدفع. نزّل دعوتك بالجودة الكاملة." : "Payment approved. Download your invitation in full quality.",
    eyebrow: ar ? "تم تأكيد الدفع" : "Payment approved",
    title: ar ? "دعوتك جاهزة" : "Your invitation is ready",
    blocks,
  };
}
