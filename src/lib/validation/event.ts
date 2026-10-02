import { z } from "zod";
import { isValidTimeZone } from "@/lib/time";
import { EVENT_TYPES } from "@/lib/events/types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");

export const scheduleItemSchema = z.object({
  time: timeStr,
  title: z.string().trim().min(1, "Required").max(120),
  titleAr: optionalText(120),
  description: optionalText(300),
});

/** Event details form (step 1). Date/time are wall-clock values in `timezone`. */
export const eventInputSchema = z.object({
  type: z.enum(EVENT_TYPES),
  language: z.enum(["EN", "AR", "BILINGUAL"]),
  title: z.string().trim().min(2, "Give your event a name").max(140),
  titleAr: optionalText(140),
  hostNames: z.string().trim().min(2, "Who is hosting?").max(120),
  hostNamesAr: optionalText(120),
  date: dateStr,
  time: timeStr,
  endTime: z.union([timeStr, z.literal("")]).optional().nullable(),
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone"),
  venueName: z.string().trim().min(2, "Where is it?").max(160),
  venueNameAr: optionalText(160),
  address: z.string().trim().min(2, "Add the address").max(300),
  addressAr: optionalText(300),
  mapsUrl: z
    .string()
    .trim()
    .max(600)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^https:\/\/([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl|apple\.com|waze\.com)\//i.test(v), {
      message: "Paste a Google Maps, Apple Maps or Waze link",
    }),
  dressCode: optionalText(160),
  dressCodeAr: optionalText(160),
  notes: optionalText(1000),
  notesAr: optionalText(1000),
  parkingInfo: optionalText(500),
  accommodationInfo: optionalText(500),
  specialInstructions: optionalText(500),
  contactName: optionalText(120),
  contactPhone: optionalText(40),
  contactEmail: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email"),
  rsvpDeadline: z.union([dateStr, z.literal("")]).optional().nullable(),
  allowWebRsvp: z.boolean().default(true),
  schedule: z.array(scheduleItemSchema).max(30).default([]),
});

export type EventInput = z.infer<typeof eventInputSchema>;
