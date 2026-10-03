import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/guards";
import { findEditableEvent } from "@/server/events/access";
import { buildInvitationVM } from "@/server/invitations/view-model";
import { InvitationExperience } from "@/components/invitation/experience";
import { isThemeKey } from "@/lib/themes/registry";
import { appUrl } from "@/server/env";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

type Props = { params: Promise<{ eventId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Host-only preview of the guest website with a sample guest. Embedded by the design
 * editor, which streams draft designs into it with postMessage.
 */
export default async function PreviewPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/preview/${eventId}`);
  const event = await findEditableEvent(user, eventId, {
    scheduleItems: { orderBy: { sortOrder: "asc" } },
    galleryImages: { orderBy: { sortOrder: "asc" } },
  });
  if (!event) notFound();
  const theme = typeof sp.theme === "string" && isThemeKey(sp.theme) ? sp.theme : undefined;
  const state = sp.state === "pending" ? "PENDING" : sp.state === "declined" ? "DECLINED" : "ACCEPTED";
  const ar = event.language === "AR";
  const vm = await buildInvitationVM({
    event,
    guest: {
      name: ar ? "خالد الهاشمي" : "Khalid Al Hashimi",
      allowedCount: 2,
      attendingCount: 2,
      rsvpStatus: state,
      checkedInAt: null,
      checkedInCount: null,
      scanCount: 0,
      locale: null,
    },
    token: null,
    mode: "preview",
    themeKey: theme,
    // Scanning the sample pass with a phone opens this same preview there (sign-in required).
    qrText: appUrl(`/preview/${event.id}`),
  });
  return <InvitationExperience vm={vm} />;
}
