import { z } from "zod";

/**
 * Server configuration, validated once on first access.
 *
 * Everything secret lives here and is only ever read on the server. Nothing in
 * this module may be imported from a client component.
 */

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),

    // WhatsApp Business Platform (Cloud API)
    WHATSAPP_PROVIDER: z.enum(["cloud", "mock"]).default("mock"),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
    WHATSAPP_APP_SECRET: z.string().optional(),
    WHATSAPP_VERIFY_TOKEN: z.string().optional(),
    WHATSAPP_API_VERSION: z.string().default("v23.0"),
    // Meta App id — needed only to upload the sample header image when submitting IMAGE templates.
    WHATSAPP_APP_ID: z.string().optional(),
    WHATSAPP_MAX_MPS: z.coerce.number().int().positive().default(20),

    // Object storage
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().default("./storage"),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default("auto"),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool,

    // Email (password resets)
    EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
    SMTP_URL: z.string().optional(),
    EMAIL_FROM: z.string().default("INVTRA <contact@invtra.store>"),

    // Payments
    PAYMENT_PROVIDER: z.enum(["mock", "manual", "stripe", "tap"]).default("mock"),
    PAYMENT_CURRENCY: z.enum(["USD", "AED", "SAR", "KWD", "QAR", "BHD", "OMR"]).default("SAR"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    // Tap Payments (Saudi Arabia / GCC): Apple Pay, Google Pay, mada, cards, STC Pay on Tap's hosted page.
    TAP_SECRET_KEY: z.string().optional(),
    TAP_MERCHANT_ID: z.string().optional(),
    // Shown to customers for PAYMENT_PROVIDER=manual (bank transfer details etc.).
    PAYMENT_MANUAL_INSTRUCTIONS: z.string().optional(),

    // Business identity shown in the footer and Terms (Saudi e-commerce rules require the CR number).
    LEGAL_ENTITY_NAME: z.string().optional(),
    LEGAL_CR_NUMBER: z.string().optional(),
    LEGAL_VAT_NUMBER: z.string().optional(),
    LEGAL_ADDRESS: z.string().optional(),

    // Support chat: the "Chat with us on WhatsApp" button (digits with country code; empty hides it).
    SUPPORT_WHATSAPP: z.string().default("966557663974"),

    // Background jobs
    INLINE_WORKER: bool,
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),

    // Seed / bootstrap
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.WHATSAPP_PROVIDER === "cloud") {
      for (const key of [
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "WHATSAPP_APP_SECRET",
        "WHATSAPP_VERIFY_TOKEN",
      ] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when WHATSAPP_PROVIDER=cloud` });
      }
    }
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when STORAGE_DRIVER=s3` });
      }
    }
    if (env.EMAIL_PROVIDER === "smtp" && !env.SMTP_URL) {
      ctx.addIssue({ code: "custom", path: ["SMTP_URL"], message: "SMTP_URL is required when EMAIL_PROVIDER=smtp" });
    }
    if (env.PAYMENT_PROVIDER === "stripe") {
      for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when PAYMENT_PROVIDER=stripe` });
      }
    }
    if (env.PAYMENT_PROVIDER === "tap" && !env.TAP_SECRET_KEY) {
      ctx.addIssue({ code: "custom", path: ["TAP_SECRET_KEY"], message: "TAP_SECRET_KEY is required when PAYMENT_PROVIDER=tap" });
    }
    if (env.NODE_ENV === "production") {
      if (env.WHATSAPP_PROVIDER === "mock" && process.env.ALLOW_MOCK_IN_PRODUCTION !== "true") {
        ctx.addIssue({ code: "custom", path: ["WHATSAPP_PROVIDER"], message: "The mock WhatsApp provider cannot be used in production" });
      }
      if (env.PAYMENT_PROVIDER === "mock" && process.env.ALLOW_MOCK_IN_PRODUCTION !== "true") {
        ctx.addIssue({ code: "custom", path: ["PAYMENT_PROVIDER"], message: "The mock payment provider cannot be used in production" });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid INVTRA configuration:\n${details}\nSee .env.example for every supported variable.`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

/** Absolute URL on the public app origin. */
export function appUrl(path = "/"): string {
  return new URL(path, env().APP_URL).toString();
}
