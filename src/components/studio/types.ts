import type { EventType } from "@prisma/client";
import type { CardContent, CardLanguage } from "@/lib/card/build";
import type { CanvasDoc } from "@/lib/canvas/schema";
import type { InvitationDesign } from "@/lib/design/schema";

/** A file the Studio can place: photos uploaded in Studio and the event's own pictures. */
export interface StudioUpload {
  id: string;
  key: string;
  kind: string;
  width: number | null;
  height: number | null;
  url: string | null;
}

export interface StudioTheme {
  key: string;
  name: string;
  occasions: EventType[];
}

/** Everything the Studio page (server) hands to the editor. */
export interface StudioProps {
  event: {
    id: string;
    title: string;
    type: EventType;
    language: CardLanguage;
    themeKey: string;
    /** The card prints the guest's QR code (Design → QR code). */
    qrOn: boolean;
  };
  design: InvitationDesign;
  content: CardContent;
  /** The saved Studio document (may be empty: Studio then starts from the event's current design). */
  canvas: CanvasDoc;
  uploads: StudioUpload[];
  themes: StudioTheme[];
  /** Where Back / Done go. */
  backHref: string;
}

export type PanelKey = "templates" | "elements" | "text" | "uploads" | "background" | "layers";

/** What the canvas shows: the editor, a guest's card (sample guest, with QR) or the shared image. */
export type ViewMode = "edit" | "guest" | "teaser";

export interface View {
  /** Zoom: screen pixels per card pixel. */
  z: number;
  /** The card's top-left corner in the stage, in screen pixels. */
  tx: number;
  ty: number;
}

export type SaveStatus = "saved" | "pending" | "saving" | "error";
