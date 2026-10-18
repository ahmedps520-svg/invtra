import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Users } from "lucide-react";
import { getI18n } from "@/server/i18n";
import { getSessionUser } from "@/server/auth/session";
import { findInvite } from "@/server/events/cohosts";
import { AuthHeading } from "@/components/auth/auth-heading";
import { CoHostAccept } from "@/components/auth/cohost-accept";
import { buttonClasses } from "@/components/ui/button";
import { fmt } from "@/lib/i18n/config";
import { whenLabel } from "@/lib/event-when";

export const metadata: Metadata = { title: "Guest list", robots: { index: false, follow: false } };

/**
 * Where an invitation to keep a guest list leads: who invited them and for which event,
 * then sign in (or sign up) and accept. The link is signed; an old or edited one says so.
 */
export default async function CoHostInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { dict, locale } = await getI18n();
  const t = dict.dashboard.cohosts;
  const [invite, user] = await Promise.all([findInvite(token), getSessionUser()]);

  if (!invite) {
    return (
      <>
        <AuthHeading title={t.joinInvalid} subtitle={t.joinInvalidBody} />
        <Link href={user ? "/dashboard" : "/"} className={buttonClasses("outline", "md", "mt-8")}>
          {user ? dict.dashboard.header.back : dict.auth.backHome}
        </Link>
      </>
    );
  }
  if (user && invite.userId === user.id) redirect(`/dashboard/events/${invite.eventId}/guests`);

  const event = invite.event;
  const ar = locale === "ar";
  const owner = event.user.name || event.user.email;
  const title = ar && event.titleAr ? event.titleAr : event.title;
  const here = `/cohost/${token}`;

  return (
    <>
      <AuthHeading title={fmt(t.joinTitle, { label: invite.label })} subtitle={fmt(t.joinBody, { owner, event: title })} />
      <div className="mt-7 rounded-2xl border border-line bg-paper/80 px-5 py-4 shadow-soft">
        <p className="font-display text-xl leading-snug text-ink">{title}</p>
        <p className="mt-2 flex items-center gap-2 text-[13.5px] text-ink-soft">
          <CalendarDays className="size-4 shrink-0 text-bronze-500" aria-hidden="true" />
          {whenLabel(event, locale)}
        </p>
        <p className="mt-1 flex items-center gap-2 text-[13.5px] text-ink-soft">
          <Users className="size-4 shrink-0 text-bronze-500" aria-hidden="true" />
          {fmt(t.hostedBy, { owner })}
        </p>
      </div>
      <div className="mt-8">
        {!user ? (
          <div className="grid gap-3">
            <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonClasses("primary", "lg", "w-full")}>
              {t.joinSignIn}
            </Link>
            <Link href={`/signup?next=${encodeURIComponent(here)}`} className={buttonClasses("outline", "lg", "w-full")}>
              {t.joinSignUp}
            </Link>
          </div>
        ) : user.id === event.userId ? (
          <div>
            <p className="text-[14px] text-ink-soft">{t.joinOwn}</p>
            <Link href={`/dashboard/events/${event.id}/guests`} className={buttonClasses("primary", "md", "mt-5")}>
              {dict.dashboard.steps.guests}
            </Link>
          </div>
        ) : invite.userId ? (
          <p className="text-[14px] text-rosewood" role="alert">
            {t.joinTaken}
          </p>
        ) : (
          <CoHostAccept
            token={token}
            labels={{
              accept: t.joinAccept,
              signedInAs: fmt(t.joinAs, { email: user.email }),
              notYou: t.joinNotYou,
              errors: dict.dashboard.errors as Record<string, string>,
              generic: dict.dashboard.errors.generic,
            }}
          />
        )}
      </div>
    </>
  );
}
