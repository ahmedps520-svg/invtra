import { PermanentJobError } from "@/server/queue/queue";
import type { WhatsAppProvider } from "./types";

/** Thrown when something tries to message a guest while INVTRA's WhatsApp isn't connected. */
export class WhatsAppOffError extends PermanentJobError {
  constructor() {
    super("WhatsApp isn't connected — invitations are sent from the host's own WhatsApp.");
  }
}

/**
 * WHATSAPP_PROVIDER=off: INVTRA's own WhatsApp number isn't connected, so INVTRA never sends a
 * message. Hosts send invitations from their own WhatsApp; anything still queued fails at once.
 */
export class OffWhatsAppProvider implements WhatsAppProvider {
  readonly name = "off" as const;
  async sendTemplate(): Promise<never> {
    throw new WhatsAppOffError();
  }
  async sendCtaUrl(): Promise<never> {
    throw new WhatsAppOffError();
  }
  async sendText(): Promise<never> {
    throw new WhatsAppOffError();
  }
  async uploadMedia(): Promise<never> {
    throw new WhatsAppOffError();
  }
}
