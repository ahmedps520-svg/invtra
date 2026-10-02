import { db } from "@/server/db";
import { env } from "@/server/env";
import { mediaUrl } from "@/server/storage";
import { forbidden } from "@/server/http";
import type { SessionUser } from "@/server/auth/session";
import { toWhatsAppId } from "@/lib/phone";
import { signWebhookBody } from "@/server/whatsapp/signature";
import { handleWhatsAppWebhook } from "@/server/whatsapp/webhook";
import type { MessageContent } from "@/server/whatsapp/types";
import { generateSecretToken } from "@/server/security/tokens";

/**
 * Development-only WhatsApp simulator (WHATSAPP_PROVIDER=mock). Shows what each
 * guest's phone would receive and lets you press the buttons — replies go through
 * the real, signature-checked webhook handler.
 */

export function assertSimulatorEnabled() {
  if (env().WHATSAPP_PROVIDER !== "mock") throw forbidden("The WhatsApp simulator is only available with the mock provider.");
}

function scope(user: SessionUser) {
  return user.role === "ADMIN" ? {} : { event: { userId: user.id } };
}

export async function listConversations(user: SessionUser) {
  const rows = await db.whatsAppMessage.findMany({
    where: { provider: "mock", ...scope(user) },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: { phone: true, createdAt: true, guest: { select: { name: true, isTest: true } }, event: { select: { title: true } } },
  });
  const map = new Map<string, { phone: string; name: string; event: string; lastAt: Date; isTest: boolean }>();
  for (const r of rows) {
    if (!map.has(r.phone)) map.set(r.phone, { phone: r.phone, name: r.guest?.name ?? r.phone, event: r.event?.title ?? "", lastAt: r.createdAt, isTest: r.guest?.isTest ?? false });
  }
  return [...map.values()];
}

export async function conversation(user: SessionUser, phone: string) {
  const msgs = await db.whatsAppMessage.findMany({
    where: { provider: "mock", phone, ...scope(user) },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return Promise.all(
    msgs.map(async (m) => {
      const content = (m.content ?? {}) as Partial<MessageContent> & { payload?: string | null };
      return {
        id: m.id,
        direction: m.direction,
        purpose: m.purpose,
        status: m.status,
        errorCode: m.errorCode,
        errorMessage: m.errorMessage,
        createdAt: m.createdAt,
        body: content.body ?? "",
        footer: content.footer ?? null,
        buttons: content.buttons ?? [],
        imageUrl: content.headerImageKey ? await mediaUrl(content.headerImageKey) : null,
      };
    }),
  );
}

function inboundPayload(phone: string, message: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "MOCK_WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "INVTRA", phone_number_id: "MOCK" },
              contacts: [{ profile: { name: "Guest" }, wa_id: toWhatsAppId(phone) }],
              messages: [{ from: toWhatsAppId(phone), id: `wamid.MOCKIN${generateSecretToken(9)}`, timestamp: String(Math.floor(Date.now() / 1000)), ...message }],
            },
          },
        ],
      },
    ],
  };
}

/** Simulate the guest tapping a quick-reply button or typing a message. */
export async function simulateReply(user: SessionUser, input: { messageId: string; buttonIndex?: number; text?: string }) {
  const original = await db.whatsAppMessage.findFirst({ where: { id: input.messageId, provider: "mock", ...scope(user) } });
  if (!original) throw forbidden("Message not found.");
  const content = (original.content ?? {}) as Partial<MessageContent>;
  let message: Record<string, unknown>;
  if (input.buttonIndex !== undefined) {
    const button = content.buttons?.[input.buttonIndex];
    if (!button || button.type !== "QUICK_REPLY") throw forbidden("That button can't be pressed.");
    message = { type: "button", context: { id: original.waMessageId, from: "INVTRA" }, button: { payload: button.payload, text: button.text } };
  } else {
    message = { type: "text", context: { id: original.waMessageId, from: "INVTRA" }, text: { body: (input.text ?? "").slice(0, 1000) } };
  }
  const raw = JSON.stringify(inboundPayload(original.phone, message));
  return handleWhatsAppWebhook(raw, signWebhookBody(raw, env().WHATSAPP_APP_SECRET ?? ""));
}
