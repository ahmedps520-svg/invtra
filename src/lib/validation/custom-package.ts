import { z } from "zod";
import { UNLIMITED_GUESTS } from "@/lib/plans";

/**
 * The host and the package for a custom event (Admin → Custom events → Host & payment),
 * added once the invitation is designed. Shared by the form and the API.
 */
/** Starting text for "What's included", in the host's language (the guest allowance is shown separately). */
export const INCLUDED_EXAMPLE = {
  en: "Any design, including premium designs\nWhatsApp invitations with a personal QR code for every guest\nRSVP tracking and check-in at the door",
  ar: "جميع التصاميم بما فيها التصاميم المميزة\nدعوات واتساب مع رمز QR خاص لكل ضيف\nمتابعة تأكيد الحضور وتسجيل الدخول عند الباب",
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const customHostSchema = z.object({
  name: z.string().trim().min(2, "Enter the host's name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  phone: z.string().trim().max(32).optional().default(""),
  locale: z.enum(["en", "ar"]).default("en"),
});

export const customPackageTermsSchema = z
  .object({
    unlimited: z.boolean(),
    guestLimit: z.coerce
      .number()
      .int()
      .min(1)
      .max(UNLIMITED_GUESTS - 1)
      .optional()
      .nullable(),
    price: z.coerce.number().positive("Enter the price").max(10_000_000),
    included: z.string().trim().max(800).optional().default(""),
    dueDate: date
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    note: z.string().trim().max(500).optional().default(""),
  })
  .refine((p) => p.unlimited || (p.guestLimit ?? 0) >= 1, {
    path: ["guestLimit"],
    message: "How many guests are included?",
  });

export const customPackageSchema = z.object({
  host: customHostSchema,
  package: customPackageTermsSchema,
});

export type CustomPackageInput = z.infer<typeof customPackageSchema>;
