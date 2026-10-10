import { notFound, redirect } from "next/navigation";
import { getCustomEvent, resolveCustomEventId } from "./service";

export type CustomStep = "details" | "design" | "host" | "send";

/**
 * Data for an Admin → Custom events step page. Links from before the design-first flow used
 * the package's order id; those redirect to the event's own address.
 */
export async function customStepPage(id: string, step: CustomStep, query = "") {
  const eventId = await resolveCustomEventId(id);
  if (!eventId) notFound();
  if (eventId !== id) redirect(`/admin/custom/${eventId}/${step}${query}`);
  const data = await getCustomEvent(eventId);
  if (!data) notFound();
  return data;
}

/** Links between the steps of an existing custom event (Send only once there's a payment link). */
export function customStepLinks(eventId: string, hasLink: boolean): Partial<Record<number, string>> {
  const base = `/admin/custom/${eventId}`;
  return { 0: `${base}/details`, 1: `${base}/design`, 2: `${base}/host`, ...(hasLink ? { 3: `${base}/send` } : {}) };
}
