import { db } from "@/server/db";
import { logError } from "@/server/log";
import { whatsapp } from "@/server/whatsapp";
import { WhatsAppApiError } from "@/server/whatsapp/errors";
import type {
  MessageContent,
  TemplateComponent,
} from "@/server/whatsapp/types";
import { PermanentJobError } from "@/server/queue/queue";
import {
  ensureReceiptNumber,
  sendReceiptEmail,
} from "@/server/payments/receipts";
import {
  isTemplateButtons,
  renderTemplateBody,
  sanitizeParam,
  type TemplateVariable,
} from "@/lib/whatsapp/templates";
import { toWhatsAppId } from "@/lib/phone";
import { formatMoney } from "@/lib/format";

/**
 * WhatsApp messages to a host (not to guests): the payment link for a custom package
 * and the receipt once it is paid. Both are approved templates whose URL button opens
 * /pay/<payToken> (the payment page, which turns into the receipt once paid).
 */
export async function sendPaymentWhatsApp(
  orderId: string,
  kind: "request" | "receipt",
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, phone: true, locale: true } },
      event: { select: { id: true, title: true, titleAr: true } },
    },
  });
  if (!order) return; // deleted with its customer meanwhile
  if (!order.payToken) throw new PermanentJobError("Order has no payment link");
  if (kind === "request" && order.status !== "PENDING") return; // paid or withdrawn meanwhile
  if (kind === "receipt" && order.status !== "PAID") return;
  if (!order.user.phone)
    throw new PermanentJobError("The customer has no WhatsApp number");

  const locale = order.user.locale === "ar" ? "ar" : "en";
  const purpose = kind === "request" ? "PAYMENT_REQUEST" : "PAYMENT_RECEIPT";
  const candidates = await db.messageTemplate.findMany({
    where: { purpose, status: "APPROVED", isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const template =
    candidates.find((t) => t.locale === locale) ??
    candidates.find((t) => t.locale === "en") ??
    candidates[0];
  if (!template) {
    // The receipt also goes by email, so a missing WhatsApp template is a setup note, not a failure.
    if (kind === "receipt") {
      await logError(
        "custom:whatsapp",
        new Error(
          "No approved PAYMENT_RECEIPT template — receipt sent by email only",
        ),
        { orderId },
        "warn",
      );
      return;
    }
    throw new PermanentJobError(
      `No approved ${purpose} template — submit it in Admin → Templates`,
    );
  }

  const receiptNumber =
    kind === "receipt" ? ((await ensureReceiptNumber(order.id)) ?? "") : "";
  const values: Partial<Record<TemplateVariable, string>> = {
    customer_name: order.user.name,
    event_name: order.event?.title ?? "INVTRA",
    event_name_ar: order.event?.titleAr || order.event?.title || "إنفترا",
    package_amount: formatMoney(
      order.amount,
      order.currency,
      template.locale === "ar" ? "ar" : "en",
    ),
    receipt_number: receiptNumber,
  };
  const variables = (template.variables ?? []) as TemplateVariable[];
  const buttons = isTemplateButtons(template.buttons) ? template.buttons : [];
  const components: TemplateComponent[] = [];
  if (variables.length)
    components.push({
      type: "body",
      parameters: variables.map((v) => ({
        type: "text" as const,
        text: sanitizeParam(values[v] ?? ""),
      })),
    });
  buttons.forEach((b, index) => {
    if (b.type === "URL" && b.url.includes("{{1}}")) {
      components.push({
        type: "button",
        sub_type: "url",
        index: String(index),
        parameters: [{ type: "text", text: order.payToken! }],
      });
    }
  });
  const content: MessageContent = {
    kind: "template",
    templateName: template.metaName,
    language: template.language,
    body: renderTemplateBody({ body: template.body, variables }, values),
    footer: template.footer,
    buttons: buttons.map((b) =>
      b.type === "URL"
        ? {
            type: "URL" as const,
            text: b.text,
            url: b.url.replace("{{1}}", order.payToken!),
          }
        : { type: "QUICK_REPLY" as const, text: b.text },
    ),
  };

  const provider = whatsapp();
  const message = await db.whatsAppMessage.create({
    data: {
      eventId: order.event?.id ?? null,
      direction: "OUTBOUND",
      purpose,
      provider: provider.name,
      phone: order.user.phone,
      type: "template",
      status: "QUEUED",
      content: content as object,
    },
  });
  try {
    const sent = await provider.sendTemplate({
      to: toWhatsAppId(order.user.phone),
      templateName: template.metaName,
      languageCode: template.language,
      components,
    });
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: "SENT", waMessageId: sent.messageId, sentAt: new Date() },
    });
  } catch (e) {
    const err = e as Error;
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorCode:
          e instanceof WhatsAppApiError && e.code !== null
            ? String(e.code)
            : null,
        errorMessage: err.message.slice(0, 500),
      },
    });
    if (e instanceof WhatsAppApiError && !e.retryable)
      throw new PermanentJobError(err.message);
    throw e;
  }
}

/** Queue job "payment.receipt" — one job per channel, so a WhatsApp retry never re-sends the email. */
export async function sendReceipt(
  orderId: string,
  channel: "email" | "whatsapp",
) {
  if (channel === "email") return sendReceiptEmail(orderId);
  return sendPaymentWhatsApp(orderId, "receipt");
}
