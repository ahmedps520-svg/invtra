import { env } from "@/server/env";
import { CloudWhatsAppProvider } from "./cloud";
import { MockWhatsAppProvider } from "./mock";
import { OffWhatsAppProvider } from "./off";
import { badRequest } from "@/server/http";
import { db } from "@/server/db";
import { whatsappAccountStatus } from "./account";
import { WhatsAppNotReadyError, WhatsAppOptedOutError } from "./errors";
import type { SendCtaParams, SendTemplateParams, SendTextParams, WhatsAppProvider } from "./types";

let provider: WhatsAppProvider | null = null;

/**
 * The WhatsApp provider, behind one guard that every send goes through: INVTRA's account must
 * be able to send as Meta reports it (number connected, display name and account approved), and
 * nothing goes to a number that asked to stop.
 */
export function whatsapp(): WhatsAppProvider {
  if (!provider) {
    const kind = env().WHATSAPP_PROVIDER;
    provider = new Guarded(kind === "cloud" ? new CloudWhatsAppProvider() : kind === "off" ? new OffWhatsAppProvider() : new MockWhatsAppProvider());
  }
  return provider;
}

class Guarded implements WhatsAppProvider {
  constructor(private readonly inner: WhatsAppProvider) {}
  get name() {
    return this.inner.name;
  }
  private async check(to: string | null, allowOptedOut = false) {
    if (this.inner.name === "cloud") {
      const status = await whatsappAccountStatus();
      if (!status.ok) throw new WhatsAppNotReadyError(status.problems);
    }
    if (to && !allowOptedOut && (await isOptedOut(to))) throw new WhatsAppOptedOutError();
  }
  async sendTemplate(p: SendTemplateParams) {
    await this.check(p.to);
    return this.inner.sendTemplate(p);
  }
  async sendCtaUrl(p: SendCtaParams) {
    await this.check(p.to);
    return this.inner.sendCtaUrl(p);
  }
  async sendText(p: SendTextParams) {
    await this.check(p.to, p.allowOptedOut);
    return this.inner.sendText(p);
  }
  async uploadMedia(p: { data: Buffer; mimeType: string; filename: string }) {
    await this.check(null);
    return this.inner.uploadMedia(p);
  }
}

/** The number asked not to receive messages from INVTRA. */
export async function isOptedOut(phone: string) {
  return Boolean(await db.whatsAppOptOut.findUnique({ where: { phone }, select: { phone: true } }));
}

/**
 * Before starting something that sends (a batch, a test, reminders): INVTRA's WhatsApp is
 * connected and Meta says the account can send. Throws a clear error for the host otherwise.
 */
export async function assertWhatsAppReady() {
  assertWhatsAppOn();
  if (env().WHATSAPP_PROVIDER !== "cloud") return;
  const status = await whatsappAccountStatus();
  if (!status.ok) {
    throw badRequest("whatsapp_not_ready", "INVTRA's WhatsApp can't send right now. Please try again later, or send from your own WhatsApp.");
  }
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
