import { z } from "zod";
import { EVENT_TYPES } from "@/lib/events/types";
import { UNLIMITED_GUESTS } from "@/lib/plans";

/** A custom package prepared by staff (Admin → Custom events). Shared by the wizard and the API. */
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const optional = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .transform((v) => v || null);

export const customPackageSchema = z.object({
  host: z.object({
    name: z.string().trim().min(2, "Enter the host's name").max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email")
      .max(160),
    phone: z.string().trim().max(32).optional().default(""),
    locale: z.enum(["en", "ar"]).default("en"),
  }),
  event: z.object({
    type: z.enum(EVENT_TYPES),
    language: z.enum(["EN", "AR", "BILINGUAL"]),
    title: z.string().trim().min(2, "Give the event a name").max(160),
    titleAr: optional,
    hostNames: z.string().trim().min(1, "Required").max(160),
    hostNamesAr: optional,
    date,
    time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
    timezone: z.string().min(3).max(64),
    venueName: z.string().trim().min(1, "Where is it?").max(200),
    venueNameAr: optional,
    address: optional,
  }),
  package: z
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
    }),
  send: z
    .object({ whatsapp: z.boolean(), email: z.boolean() })
    .default({ whatsapp: true, email: true }),
});

export type CustomPackageInput = z.infer<typeof customPackageSchema>;
