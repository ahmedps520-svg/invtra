import sharp, { type Metadata, type OutputInfo } from "sharp";
import type { Order, OrderFile, OrderFileKind } from "@prisma/client";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { badRequest } from "@/server/http";
import { storage } from "@/server/storage";
import { generateSecretToken, hmac, safeEqual } from "@/server/security/tokens";
import { DOWNLOADABLE_STAGES } from "@/lib/products";

/**
 * Files attached to orders, kept in private storage and never given a public URL:
 *  - RECEIPT: the customer's bank-transfer receipt (image or PDF). It helps staff find the
 *    transfer; it is never treated as proof that the money arrived.
 *  - FINAL: the deliverables. Downloadable only once staff have approved the payment and the
 *    order is ready, by the customer (signed in, or with an expiring signed link) and by staff.
 */

const RECEIPT_LIMIT = 10 * 1024 * 1024;
const FINAL_LIMIT = 40 * 1024 * 1024;

const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString("latin1") === "%PDF-";

function cleanName(name: string, fallback: string): string {
  const n = name
    .replace(/[^\p{L}\p{N} ._()-]+/gu, "")
    .trim()
    .slice(0, 120);
  return n || fallback;
}

/** Stores a customer's transfer receipt: images are re-encoded (no metadata), PDFs checked by signature. */
export async function saveReceipt(order: Pick<Order, "id">, file: { name: string; data: Buffer }, uploadedById: string): Promise<OrderFile> {
  const { data } = file;
  if (!data.length) throw badRequest("missing_file", "Choose a file to upload.");
  if (data.length > RECEIPT_LIMIT) throw badRequest("file_too_large", "Receipts can be up to 10 MB.");
  const id = generateSecretToken(12);
  if (isPdf(data)) {
    const key = `orders/${order.id}/receipt-${id}.pdf`;
    await storage().put(key, data, "application/pdf");
    return db.orderFile.create({
      data: {
        orderId: order.id,
        kind: "RECEIPT",
        key,
        name: cleanName(file.name, "receipt.pdf"),
        mimeType: "application/pdf",
        size: data.length,
        uploadedById,
      },
    });
  }
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(data, { failOn: "error", limitInputPixels: 80_000_000 })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw badRequest("unsupported_file", "Upload a photo or screenshot (JPG, PNG, HEIC) or a PDF.");
  }
  const key = `orders/${order.id}/receipt-${id}.jpg`;
  await storage().put(key, out.data, "image/jpeg");
  return db.orderFile.create({
    data: {
      orderId: order.id,
      kind: "RECEIPT",
      key,
      name: cleanName(file.name.replace(/\.[^.]+$/, ".jpg"), "receipt.jpg"),
      mimeType: "image/jpeg",
      size: out.data.length,
      width: out.info.width,
      height: out.info.height,
      uploadedById,
    },
  });
}

/** Stores a deliverable exactly as given (no re-encoding, so quality is kept): PNG, JPEG, WEBP or PDF. */
export async function saveFinalFile(order: Pick<Order, "id">, file: { name: string; data: Buffer }, uploadedById: string | null): Promise<OrderFile> {
  const { data } = file;
  if (!data.length) throw badRequest("missing_file", "Choose a file to upload.");
  if (data.length > FINAL_LIMIT) throw badRequest("file_too_large", "Final files can be up to 40 MB.");
  const id = generateSecretToken(12);
  if (isPdf(data)) {
    const key = `orders/${order.id}/final-${id}.pdf`;
    await storage().put(key, data, "application/pdf");
    return db.orderFile.create({
      data: {
        orderId: order.id,
        kind: "FINAL",
        key,
        name: cleanName(file.name, "invitation.pdf"),
        mimeType: "application/pdf",
        size: data.length,
        uploadedById,
      },
    });
  }
  let meta: Metadata;
  try {
    meta = await sharp(data, { failOn: "error", limitInputPixels: 200_000_000 }).metadata();
  } catch {
    throw badRequest("unsupported_file", "Upload a PNG, JPG or WEBP image, or a PDF.");
  }
  const types: Record<string, { ext: string; mime: string }> = {
    png: { ext: "png", mime: "image/png" },
    jpeg: { ext: "jpg", mime: "image/jpeg" },
    webp: { ext: "webp", mime: "image/webp" },
  };
  const t = meta.format ? types[meta.format] : undefined;
  if (!t || !meta.width || !meta.height) throw badRequest("unsupported_file", "Upload a PNG, JPG or WEBP image, or a PDF.");
  const key = `orders/${order.id}/final-${id}.${t.ext}`;
  await storage().put(key, data, t.mime);
  return db.orderFile.create({
    data: {
      orderId: order.id,
      kind: "FINAL",
      key,
      name: cleanName(file.name, `invitation.${t.ext}`),
      mimeType: t.mime,
      size: data.length,
      width: meta.width,
      height: meta.height,
      uploadedById,
    },
  });
}

/** Whether the customer may download a file of this kind now. */
export function customerMayDownload(order: Pick<Order, "status" | "stage">, kind: OrderFileKind): boolean {
  if (kind === "RECEIPT") return true; // their own upload
  return order.status === "PAID" && DOWNLOADABLE_STAGES.includes(order.stage);
}

// ── Signed download links (from emails; no sign-in needed until they expire) ─

const LINK_DAYS = 14;

export function signedDownloadUrl(fileId: string, now = Date.now()): string {
  const exp = Math.ceil(now / 3_600_000) * 3_600_000 + LINK_DAYS * 86_400_000;
  return appUrl(`/d/${fileId}?exp=${exp}&s=${hmac(`order-file:${fileId}:${exp}`)}`);
}

export function validDownloadSignature(fileId: string, exp: string | null, s: string | null, now = Date.now()): "ok" | "expired" | "invalid" {
  const e = Number(exp);
  if (!exp || !s || !Number.isFinite(e)) return "invalid";
  if (!safeEqual(s, hmac(`order-file:${fileId}:${e}`))) return "invalid";
  return e < now ? "expired" : "ok";
}

/** The file's bytes as a download response. */
export async function fileResponse(file: Pick<OrderFile, "key" | "name" | "mimeType">, opts: { inline?: boolean } = {}): Promise<Response> {
  const data = await storage().get(file.key);
  if (!data) return new Response("Not found", { status: 404 });
  const name = encodeURIComponent(file.name);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${opts.inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
