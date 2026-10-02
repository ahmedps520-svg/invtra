import { env } from "@/server/env";
import { CloudWhatsAppProvider } from "./cloud";
import { MockWhatsAppProvider } from "./mock";
import type { WhatsAppProvider } from "./types";

let provider: WhatsAppProvider | null = null;

export function whatsapp(): WhatsAppProvider {
  if (!provider) provider = env().WHATSAPP_PROVIDER === "cloud" ? new CloudWhatsAppProvider() : new MockWhatsAppProvider();
  return provider;
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
