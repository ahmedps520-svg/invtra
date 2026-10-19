import type { CardContent, CardImage, CardLanguage } from "@/lib/card/build";
import type { InvitationDesign } from "@/lib/design/schema";

/** Everything <CardPreview> needs to draw an event's invitation in the browser. */
export interface CardPreviewProps {
  themeKey: string;
  design: InvitationDesign;
  language: CardLanguage;
  content: CardContent;
  backgroundImage: CardImage | null;
  customImage: CardImage | null;
}

/**
 * How a page may show an event's invitation: drawn in full once it's paid for, otherwise only as
 * the server's low-resolution, watermarked preview image.
 */
export type CardView = ({ locked: false } & CardPreviewProps) | { locked: true; src: string; width: number; height: number };
