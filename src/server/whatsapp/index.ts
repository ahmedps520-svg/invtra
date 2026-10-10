import { env } from "@/server/env";
import { CloudWhatsAppProvider } from "./cloud";
import { MockWhatsAppProvider } from "./mock";
import { OffWhatsAppProvider } from "./off";
import { badRequest } from "@/server/http";
import type { WhatsAppProvider } from "./types";

let provider: WhatsAppProvider | null = null;

export function whatsapp(): WhatsAppProvider {
  if (!provider) {
    const kind = env().WHATSAPP_PROVIDER;
    provider = kind === "cloud" ? new CloudWhatsAppProvider() : kind === "off" ? new OffWhatsAppProvider() : new MockWhatsAppProvider();
  }
  return provider;
}

/** INVTRA's own WhatsApp isn't connected: hosts send from their own WhatsApp, INVTRA sends nothing. */
export function whatsappOff() {
  return env().WHATSAPP_PROVIDER === "off";
}

/** Refuse anything that would make INVTRA send a WhatsApp message while it isn't connected. */
export function assertWhatsAppOn() {
  if (whatsappOff()) {
    throw badRequest("whatsapp_off", "INVTRA's WhatsApp isn't connected yet — send from your own WhatsApp instead.");
  }
}

export function isMockWhatsApp() {
  return env().WHATSAPP_PROVIDER === "mock";
}

/** Token bucket so a worker never exceeds the configured messages-per-second. */
class Throttle {
  private tokens: number;
  private last = Date.now();
  constructor(private rate: number) {
    this.tokens = rate;
  }
  async take() {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(this.rate, this.tokens + ((now - this.last) / 1000) * this.rate);
      this.last = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await new Promise((r) => setTimeout(r, Math.ceil(((1 - this.tokens) / this.rate) * 1000)));
    }
  }
}

let throttle: Throttle | null = null;
export async function throttleSend() {
  if (!throttle) throttle = new Throttle(env().WHATSAPP_MAX_MPS);
  await throttle.take();
}
