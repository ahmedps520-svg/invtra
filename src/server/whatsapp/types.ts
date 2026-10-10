/** Provider-neutral WhatsApp types. Shapes mirror the Cloud API so the mock behaves identically. */

export interface TemplateComponentParam {
  type: "text" | "image" | "payload";
  text?: string;
  image?: { id?: string; link?: string };
  payload?: string;
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters: TemplateComponentParam[];
}

export interface SendTemplateParams {
  to: string; // E.164
  templateName: string;
  languageCode: string;
  components: TemplateComponent[];
}

export interface SendCtaParams {
  to: string;
  headerImageMediaId?: string;
  body: string;
  footer?: string;
  buttonText: string;
  url: string;
}

export interface SendTextParams {
  to: string;
  body: string;
}

export interface SendResult {
  messageId: string;
}

export interface WhatsAppProvider {
  readonly name: "cloud" | "mock" | "off";
  sendTemplate(p: SendTemplateParams): Promise<SendResult>;
  sendCtaUrl(p: SendCtaParams): Promise<SendResult>;
  sendText(p: SendTextParams): Promise<SendResult>;
  uploadMedia(p: { data: Buffer; mimeType: string; filename: string }): Promise<{ mediaId: string }>;
}

/** Rendered representation of an outbound message, stored on WhatsAppMessage.content (dashboard, simulator). */
export interface MessageContent {
  kind: "template" | "cta" | "text";
  templateName?: string;
  language?: string;
  headerImageKey?: string | null;
  body: string;
  footer?: string | null;
  buttons?: { type: "QUICK_REPLY" | "URL"; text: string; payload?: string; url?: string }[];
}
