import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { loadPublicInvitation } from "@/server/invitations/public";
import { buildInvitationVM, pageLang } from "@/server/invitations/view-model";
import { InvitationExperience } from "@/components/invitation/experience";
import { InvitationUnavailable } from "@/components/invitation/unavailable";
import { en } from "@/lib/i18n/dictionaries/en";
import { ar } from "@/lib/i18n/dictionaries/ar";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await loadPublicInvitation(token.toUpperCase());
  const base: Metadata = { robots: { index: false, follow: false } };
  if (!data || data.state !== "active") return { ...base, title: "INVTRA" };
  const lang = pageLang(data.event, data.guest);
  const names = lang === "ar" ? data.event.hostNamesAr || data.event.hostNames : data.event.hostNames;
  const title = lang === "ar" ? `أنتم مدعوون — ${names}` : `You're invited — ${names}`;
  return {
    ...base,
    title: { absolute: title },
    description: data.event.title,
    openGraph: { title, description: data.event.title, images: [{ url: `/i/${token.toUpperCase()}/og`, width: 1080, height: 1350 }] },
  };
}

/** The guest's personal invitation website (from the WhatsApp button or the QR code). */
export default async function InvitationPage({ params, searchParams }: Props) {
  const { token: raw } = await params;
  const sp = await searchParams;
  const token = raw.toUpperCase();
  if (token !== raw) redirect(`/i/${token}`);

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await rateLimit(`invite-page:${ip}`, 240, 600)).ok) notFound();

  const data = await loadPublicInvitation(token);
  if (!data) notFound();
  const lang = pageLang(data.event, data.guest);
  if (data.state !== "active") return <InvitationUnavailable dict={lang === "ar" ? ar.invitation : en.invitation} lang={lang === "ar" ? "ar" : "en"} />;

  const user = await getSessionUser();
  const isHost = Boolean(user && (user.id === data.event.userId || user.role === "ADMIN"));
  const vm = await buildInvitationVM({ event: data.event, guest: data.guest, token, mode: isHost ? "host" : "guest" });
  return <InvitationExperience vm={vm} via={sp.via === "qr" ? "qr" : "link"} checkin={sp.checkin === "1"} />;
}
