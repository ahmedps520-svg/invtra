import { randomBytes } from "node:crypto";
import { storage } from "@/server/storage";
import { WhatsAppApiError } from "./errors";
import type { SendCtaParams, SendResult, SendTemplateParams, SendTextParams, WhatsAppProvider } from "./types";

/**
 * Development provider. Nothing leaves the machine; outbound messages are recorded
 * (by the caller) and delivery receipts are simulated through the real webhook
 * pipeline by the `mock.status` job (see src/server/queue/handlers.ts).
 *
 * Test numbers:
 *   …9999  → rejected immediately by the API (invalid number)
 *   …0000  → accepted, then fails to deliver (not on WhatsApp)
 *   anything else → sent → delivered → read
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly name = "mock" as const;

  private id() {
    return `wamid.MOCK${randomBytes(12).toString("hex").toUpperCase()}`;
  }

  private check(to: string) {
    if (to.endsWith("9999")) {
      throw new WhatsAppApiError("(#100) Invalid parameter — the phone number is not a valid WhatsApp number", 100, 400);
    }
  }

  async sendTemplate(p: SendTemplateParams): Promise<SendResult> {
    this.check(p.to);
    return { messageId: this.id() };
  }

  async sendCtaUrl(p: SendCtaParams): Promise<SendResult> {
    this.check(p.to);
    return { messageId: this.id() };
  }

  async sendText(p: SendTextParams): Promise<SendResult> {
    this.check(p.to);
    return { messageId: this.id() };
  }

  async uploadMedia(p: { data: Buffer; mimeType: string }) {
    const mediaId = `MOCKMEDIA${randomBytes(8).toString("hex").toUpperCase()}`;
    await storage().put(`mock-wa/${mediaId}.png`, p.data, p.mimeType);
    return { mediaId };
  }
}

export function mockMediaKey(mediaId: string) {
  return `mock-wa/${mediaId}.png`;
}
