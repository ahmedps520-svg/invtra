import type { Event } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

/** Lifecycle state of an event as staff care about it. */
export function EventStateBadge({ event, now = new Date() }: { event: Pick<Event, "deletedAt" | "deactivatedAt" | "startsAt"> & Partial<Pick<Event, "dateTbd">>; now?: Date }) {
  if (event.deletedAt) return <Badge>Deleted</Badge>;
  if (event.deactivatedAt) return <Badge tone="rosewood">Deactivated</Badge>;
  if (!event.dateTbd && event.startsAt <= now) return <Badge>Past</Badge>;
  return <Badge tone="sage">Upcoming</Badge>;
}
