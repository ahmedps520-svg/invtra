import { env } from "@/server/env";
import { toWhatsAppId } from "@/lib/phone";
import { WhatsAppApiError } from "./errors";
import type { SendCtaParams, SendResult, SendTemplateParams, SendTextParams, WhatsAppProvider } from "./types";

/**
 * Official WhatsApp Business Platform — Cloud API client.
 * Credentials are read from the server environment only and never leave it.
 */
export class CloudWhatsAppProvider implements WhatsAppProvider {
  readonly name = "cloud" as const;

  private base() {
    const e = env();
    return `https://graph.facebook.com/${e.WHATSAPP_API_VERSION}`;
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    const e = env();
    let res: Response;
    try {
      res = await fetch(`${this.base()}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new WhatsAppApiError(`Network error calling WhatsApp: ${(err as Error).message}`, null, null);
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok) {
      const err = (json as { error?: { message?: string; code?: number; error_data?: { details?: string } } } | null)?.error;
      throw new WhatsAppApiError(err?.message ?? `WhatsApp API HTTP ${res.status}`, err?.code ?? null, res.status, err?.error_data?.details);
    }
    return json as T;
  }

  private async sendMessage(body: Record<string, unknown>): Promise<SendResult> {
    const e = env();
    const r = await this.call<{ messages?: { id: string }[] }>(`/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
    });
    const id = r.messages?.[0]?.id;
    if (!id) throw new WhatsAppApiError("WhatsApp did not return a message id", null, 200);
    return { messageId: id };
  }

  sendTemplate(p: SendTemplateParams) {
    return this.sendMessage({
      to: toWhatsAppId(p.to),
      type: "template",
      template: { name: p.templateName, language: { code: p.languageCode }, components: p.components },
    });
  }

  sendCtaUrl(p: SendCtaParams) {
    return this.sendMessage({
      to: toWhatsAppId(p.to),
      type: "interactive",
      interactive: {
        type: "cta_url",
        ...(p.headerImageMediaId ? { header: { type: "image", image: { id: p.headerImageMediaId } } } : {}),
        body: { text: p.body },
        ...(p.footer ? { footer: { text: p.footer } } : {}),
        action: { name: "cta_url", parameters: { display_text: p.buttonText, url: p.url } },
      },
    });
  }

  sendText(p: SendTextParams) {
    return this.sendMessage({ to: toWhatsAppId(p.to), type: "text", text: { body: p.body, preview_url: false } });
  }

  async uploadMedia(p: { data: Buffer; mimeType: string; filename: string }) {
    const e = env();
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", p.mimeType);
    form.append("file", new Blob([new Uint8Array(p.data)], { type: p.mimeType }), p.filename);
    const r = await this.call<{ id: string }>(`/${e.WHATSAPP_PHONE_NUMBER_ID}/media`, { method: "POST", body: form });
    return { mediaId: r.id };
  }
}
