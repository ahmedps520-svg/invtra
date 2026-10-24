import type { EventType, PlanTier } from "@prisma/client";
import type { DesignStyle } from "./design-styles";

export type QuizDesign = {
  key: string;
  name: string;
  premium: boolean;
  occasions: EventType[];
  style: DesignStyle;
  language: "EN" | "AR" | "BILINGUAL";
};

export type QuizAnswers = { occasion: EventType; guests: number; language: "EN" | "AR" | "BILINGUAL"; style: DesignStyle };

/** The plan by the real rule: guests decide (100 Standard, 500 Premium, more Custom), and a Premium design needs Premium. */
export function planFor(guests: number, design: Pick<QuizDesign, "premium">): { tier: PlanTier; reason: "basic" | "premiumGuests" | "premiumDesign" | "custom" } {
  if (guests > 500) return { tier: "CUSTOM", reason: "custom" };
  if (guests > 100) return { tier: "PREMIUM", reason: "premiumGuests" };
  if (design.premium) return { tier: "PREMIUM", reason: "premiumDesign" };
  return { tier: "BASIC", reason: "basic" };
}

/** The three designs that best fit the answers: made for the occasion first, then the style, then the language. */
export function matchDesigns(designs: QuizDesign[], a: QuizAnswers): QuizDesign[] {
  const score = (d: QuizDesign) => {
    const at = d.occasions.indexOf(a.occasion);
    return (at >= 0 ? 6 - Math.min(at, 3) : 0) + (d.style === a.style ? 4 : 0) + (d.language === a.language ? 2 : a.language === "BILINGUAL" && d.language !== "EN" ? 1 : 0);
  };
  return [...designs].sort((x, y) => score(y) - score(x)).slice(0, 3);
}
