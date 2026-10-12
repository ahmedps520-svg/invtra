"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { MailWarning } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { fmt } from "@/lib/i18n/config";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VERIFY_REMINDER_KEY, todayKey, type Verification } from "@/lib/auth/verification";
import { plural } from "./i18n";

const noop = () => () => {};
const isolate = (s: string) => String.fromCodePoint(0x2068) + s + String.fromCodePoint(0x2069);

/**
 * Until the email is verified: a banner on every dashboard page with the days left, and a
 * reminder popup once a day.
 */
export function VerifyEmailBanner({ verification, email }: { verification: Extract<Verification, { verified: false }>; email: string }) {
  const { dict, locale } = useI18n();
  const t = dict.dashboard.verifyEmail;
  const pathname = usePathname() ?? "/dashboard";
  const timeZone = useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => "Asia/Riyadh");
  const [popup, setPopup] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(VERIFY_REMINDER_KEY);
    } catch {
      /* private mode: show it */
    }
    if (seen === todayKey()) return;
    const id = setTimeout(() => setPopup(true), 600);
    return () => clearTimeout(id);
  }, []);

  function snooze() {
    try {
      localStorage.setItem(VERIFY_REMINDER_KEY, todayKey());
    } catch {
      /* private mode */
    }
    setPopup(false);
  }

  const href = `/verify-email?next=${encodeURIComponent(pathname)}`;
  const days = plural(locale, t.days, verification.daysLeft);
  const date = formatDate(new Date(verification.deadline), { locale, timeZone, style: "full" });
  const urgent = verification.daysLeft <= 1;

  return (
    <>
      <div
        role="status"
        className={cn("border-b", urgent ? "border-rosewood/20 bg-rosewood-soft" : "border-ochre/20 bg-ochre-soft")}
        data-testid="verify-banner"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <MailWarning className={cn("size-4 shrink-0", urgent ? "text-rosewood" : "text-ochre")} strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">
            <span className="font-medium">{urgent ? t.bannerToday : fmt(t.banner, { days })}</span>{" "}
            <span className="text-ink-soft">{fmt(t.bannerBody, { date })}</span>
          </p>
          <Link href={href} className={buttonClasses("primary", "sm", "shrink-0")}>
            {t.cta}
          </Link>
        </div>
      </div>
      <Dialog
        open={popup}
        onClose={snooze}
        title={t.popupTitle}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={snooze} data-testid="verify-popup-later">
              {t.popupLater}
            </Button>
            <Link href={href} onClick={snooze} className={buttonClasses("primary", "md")}>
              {t.cta}
            </Link>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{fmt(t.popupBody, { days, email: isolate(email), date })}</p>
      </Dialog>
    </>
  );
}
