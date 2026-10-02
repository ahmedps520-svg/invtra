import type { EventType, PlanTier, UploadKind } from "@prisma/client";
import type { CardContent, CardLanguage } from "@/lib/card/build";
import type { InvitationDesign } from "@/lib/design/schema";
import type { ThemeKey } from "@/lib/themes/registry";

export type ImageMode = "GENERATED" | "CUSTOM";
export type Digits = InvitationDesign["digits"];

/** Everything the editor saves through PATCH /api/events/[id]/design. */
export interface Draft {
  themeKey: ThemeKey;
  design: InvitationDesign;
  imageMode: ImageMode;
  customImageKey: string | null;
  coverImageKey: string | null;
  logoKey: string | null;
  musicKey: string | null;
}

export type MediaKeyField = "customImageKey" | "coverImageKey" | "logoKey" | "musicKey";

export interface EditorUpload {
  id: string;
  key: string;
  kind: UploadKind;
  width: number | null;
  height: number | null;
  mimeType: string;
  url: string | null;
}

export interface EditorGalleryImage {
  id: string;
  storageKey: string;
  url: string | null;
  width: number;
  height: number;
  caption: string | null;
}

export interface EditorThemeOption {
  key: ThemeKey;
  premium: boolean;
}

export interface EditorEvent {
  id: string;
  type: EventType;
  language: CardLanguage;
  hostNames: string;
  hostNamesAr: string | null;
  plan: PlanTier | null;
  /** Event details that feed optional website sections (to hint when a section would be empty). */
  hasSchedule: boolean;
  hasDetails: boolean;
  hasContact: boolean;
}

/** Serializable props handed from the design page (server) to the editor (client). */
export interface EditorProps {
  event: EditorEvent;
  /** Card content formatted for both numeral styles, so switching digits updates the preview instantly. */
  contentByDigits: Record<Digits, CardContent>;
  initial: Draft;
  uploads: EditorUpload[];
  gallery: EditorGalleryImage[];
  themes: EditorThemeOption[];
  premiumIncluded: boolean;
  staleAccepted: number;
}

export interface DesignSaveResponse {
  design: InvitationDesign;
  themeKey: string;
  imageMode: ImageMode;
  cardChanged: boolean;
  staleAccepted: number;
}
