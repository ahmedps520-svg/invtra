"use client";

import { CardPreview } from "@/components/invitation/card-preview";
import { cn } from "@/lib/utils";
import type { CardView } from "@/lib/card/view";

/**
 * An event's invitation on a page: the full card once it's paid for, otherwise the protected
 * preview (a small watermarked JPEG rendered by the server — nothing better reaches the browser).
 */
export function EventCard({
  view,
  className,
  title = "Invitation preview",
  guest,
  qrPlaceholder,
  lazy,
}: {
  view: CardView;
  className?: string;
  title?: string;
  guest?: { name: string; allowedCount: number } | null;
  qrPlaceholder?: boolean;
  lazy?: boolean;
}) {
  if (!view.locked) {
    return <CardPreview {...view} guest={guest} qrPlaceholder={qrPlaceholder} className={className} title={title} lazy={lazy} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a private, per-event preview: not for the image optimiser
    <img
      src={view.src}
      alt={title}
      width={view.width}
      height={view.height}
      loading={lazy ? "lazy" : undefined}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className={cn("block h-auto w-full select-none bg-sand object-cover", className)}
      style={{ aspectRatio: `${view.width} / ${view.height}` }}
    />
  );
}
