import { z } from "zod";

export const guestInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the guest's name").max(120),
  phone: z.string().trim().min(5, "Enter a WhatsApp number").max(32),
  groupName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  allowedCount: z.coerce.number().int().min(1, "At least 1").max(50, "At most 50").default(1),
  locale: z.enum(["en", "ar"]).optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export type GuestInput = z.infer<typeof guestInputSchema>;

export const authSignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  password: z.string().min(10, "Use at least 10 characters").max(200),
});

export const authLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  password: z.string().min(1, "Enter your password").max(200),
});
