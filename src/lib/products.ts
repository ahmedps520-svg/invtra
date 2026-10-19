import type { DesignSource, OrderStage, Product } from "@prisma/client";

/**
 * What customers can order, shared by the wizard (browser) and the server.
 *
 *  - Digital invitation: a design plus guest pages, replies, QR check-in and sending.
 *  - Custom event design: INVTRA's designers create a one-off design from the customer's brief,
 *    with everything the digital invitation has.
 *  - Photo only: just the finished invitation image — no guest list, replies or sending.
 */

export const PRODUCTS = ["INVITATION", "CUSTOM_DESIGN", "PHOTO_ONLY"] as const satisfies readonly Product[];
export const DESIGN_SOURCES = ["TEMPLATE", "REQUEST", "UPLOAD"] as const satisfies readonly DesignSource[];

const PRODUCT_NAMES: Record<Product, { en: string; ar: string }> = {
  INVITATION: { en: "Digital invitation", ar: "دعوة رقمية" },
  CUSTOM_DESIGN: { en: "Custom event design", ar: "تصميم مخصّص للمناسبة" },
  PHOTO_ONLY: { en: "Invitation image only", ar: "صورة الدعوة فقط" },
};

/** For emails, receipts and staff screens (the dashboard uses its dictionary). */
export const productName = (p: Product | null | undefined, ar = false) => (p ? PRODUCT_NAMES[p][ar ? "ar" : "en"] : ar ? "باقة" : "Package");

export const isProduct = (v: unknown): v is Product => typeof v === "string" && (PRODUCTS as readonly string[]).includes(v);

/** Design choices offered for each product (step 3). */
export function designSourcesFor(product: Product): DesignSource[] {
  switch (product) {
    case "CUSTOM_DESIGN":
      return ["REQUEST"];
    case "PHOTO_ONLY":
      return ["TEMPLATE", "REQUEST"]; // a photo of their own design is already theirs
    default:
      return ["TEMPLATE", "REQUEST", "UPLOAD"];
  }
}

/** The design source an event ends up with for a product (keeps the current one when allowed). */
export function designSourceFor(product: Product, current: DesignSource): DesignSource {
  const allowed = designSourcesFor(product);
  return allowed.includes(current) ? current : allowed[0];
}

/** Guest list, replies, QR codes and sending come with every product except Photo only. */
export const hasGuests = (product: Product) => product !== "PHOTO_ONLY";

/** INVTRA's designers make it after payment, so the order goes into production first. */
export const needsProduction = (product: Product, source: DesignSource) => product === "CUSTOM_DESIGN" || source === "REQUEST";

// ── Optional features (step 4) ──────────────────────────────────────────────

export type QrChoice = "add" | "skip" | "later";
export type PackageTier = "BASIC" | "PREMIUM";

export interface Features {
  /** Personal QR codes on each guest's invitation, for check-in at the door. */
  qr: QrChoice;
  /** Guests are sent their invitations on WhatsApp (from INVTRA, or from the host's own WhatsApp). */
  whatsapp: boolean;
  /** How many guests the digital invitation covers (Standard 100, Premium 500). */
  tier: PackageTier;
}

export const DEFAULT_FEATURES: Features = { qr: "later", whatsapp: true, tier: "BASIC" };

/** Features stored on an event, with defaults for anything missing or invalid. */
export function readFeatures(raw: unknown): Features {
  const f = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Features, unknown>>;
  return {
    qr: f.qr === "add" || f.qr === "skip" || f.qr === "later" ? f.qr : DEFAULT_FEATURES.qr,
    whatsapp: typeof f.whatsapp === "boolean" ? f.whatsapp : DEFAULT_FEATURES.whatsapp,
    tier: f.tier === "PREMIUM" ? "PREMIUM" : "BASIC",
  };
}

// ── Order stages ────────────────────────────────────────────────────────────

/** The path an order takes, as shown on the customer's timeline. */
export function stagePath(product: Product | null, source: DesignSource | null): OrderStage[] {
  const production = product ? needsProduction(product, source ?? "TEMPLATE") : false;
  return ["SUBMITTED", "PENDING_VERIFICATION", "APPROVED", ...(production ? (["IN_PRODUCTION"] as const) : []), "READY", "DELIVERED"];
}

/** Stages in which staff can approve or reject the payment. */
export const VERIFIABLE_STAGES: OrderStage[] = ["SUBMITTED", "PENDING_VERIFICATION", "INFO_REQUIRED", "REJECTED"];

/** Stages in which the customer can still add a receipt or a transfer reference. */
export const CUSTOMER_EDITABLE_STAGES: OrderStage[] = ["DRAFT", "SUBMITTED", "PENDING_VERIFICATION", "INFO_REQUIRED", "REJECTED"];

/** The payment has been approved (files may exist or be on their way). */
export const APPROVED_STAGES: OrderStage[] = ["APPROVED", "IN_PRODUCTION", "READY", "DELIVERED"];

/** Final files can be downloaded. */
export const DOWNLOADABLE_STAGES: OrderStage[] = ["READY", "DELIVERED"];
