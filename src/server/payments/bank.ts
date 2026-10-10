import { z } from "zod";
import { getSetting, setSetting } from "@/server/settings";
import { badRequest } from "@/server/http";

/**
 * Bank details for payments by bank transfer (PAYMENT_PROVIDER=manual): shown on payment links
 * and the billing page, editable in Admin → Payments. Staff confirm each transfer by marking
 * the order paid.
 */

const KEY = "payments.bank";

export const bankSchema = z.object({
  bank: z.string().trim().min(2, "Enter the bank's name").max(80),
  bankAr: z.string().trim().max(80).default(""),
  name: z.string().trim().min(2, "Enter the account holder's name").max(120),
  iban: z
    .string()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => /^SA\d{22}$/.test(v) && validIban(v), "Enter a valid Saudi IBAN (SA + 22 digits)"),
  account: z.string().trim().max(40).default(""),
});

export type BankDetails = z.infer<typeof bankSchema>;

/** Until changed in Admin → Payments. */
export const DEFAULT_BANK: BankDetails = {
  bank: "Al Rajhi Bank",
  bankAr: "مصرف الراجحي",
  name: "احمد محمد احمد الغامدي",
  iban: "SA2380000141608016102717",
  account: "141000010006086102717",
};

/** ISO 13616 check digits (mod 97). */
export function validIban(iban: string): boolean {
  const s = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of s) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

/** "SA23 8000 0141 6080 1610 2717" */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

export async function bankDetails(): Promise<BankDetails> {
  const raw = await getSetting(KEY);
  if (raw) {
    try {
      const parsed = bankSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      /* fall back to the default */
    }
  }
  return DEFAULT_BANK;
}

export async function saveBankDetails(input: unknown): Promise<BankDetails> {
  const parsed = bankSchema.safeParse(input);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
    throw badRequest("invalid_bank", parsed.error.issues[0]?.message ?? "Check the bank details.", fields);
  }
  await setSetting(KEY, JSON.stringify(parsed.data));
  return parsed.data;
}

/** Plain-text transfer instructions (billing page, emails). */
export function transferText(b: BankDetails, lang: "en" | "ar"): string {
  return lang === "ar"
    ? `يرجى تحويل المبلغ إلى الحساب التالي:\n${b.bankAr || b.bank}\nاسم المستفيد: ${b.name}\nالآيبان: ${formatIban(b.iban)}${b.account ? `\nرقم الحساب: ${b.account}` : ""}\n\nبعد التحويل أرسل لنا إيصال التحويل على واتساب، وسنفعّل باقتك فور التأكد.`
    : `Please transfer the amount to:\n${b.bank}\nAccount name: ${b.name}\nIBAN: ${formatIban(b.iban)}${b.account ? `\nAccount number: ${b.account}` : ""}\n\nAfter transferring, send us the transfer receipt on WhatsApp — we activate your package as soon as it's confirmed.`;
}

/** Short reference customers quote with a transfer, e.g. "INV-7K2Q9XWD" (shown to staff too). */
export function orderReference(orderId: string): string {
  return `INV-${orderId.slice(-8).toUpperCase()}`;
}
