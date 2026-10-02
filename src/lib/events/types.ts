import type { EventType } from "@prisma/client";

/** Every occasion INVTRA supports, in the order customers see them. */
export const EVENT_TYPES = [
  "WEDDING",
  "ENGAGEMENT",
  "HENNA",
  "NEWBORN",
  "BABY_SHOWER",
  "AQIQAH",
  "BIRTHDAY",
  "GRADUATION",
  "ANNIVERSARY",
  "RAMADAN",
  "CORPORATE",
  "OTHER",
] as const satisfies readonly EventType[];

/** Occasion families used to group designs and marketing copy. */
export type OccasionGroup = "weddings" | "baby" | "celebrations" | "community";

export const OCCASION_GROUPS: Record<OccasionGroup, EventType[]> = {
  weddings: ["WEDDING", "ENGAGEMENT", "HENNA", "ANNIVERSARY"],
  baby: ["NEWBORN", "BABY_SHOWER", "AQIQAH"],
  celebrations: ["BIRTHDAY", "GRADUATION", "OTHER"],
  community: ["RAMADAN", "CORPORATE"],
};

export function occasionGroup(type: EventType): OccasionGroup {
  return (Object.keys(OCCASION_GROUPS) as OccasionGroup[]).find((g) => OCCASION_GROUPS[g].includes(type)) ?? "celebrations";
}
