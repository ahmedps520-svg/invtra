import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailX } from "lucide-react";
import { db } from "@/server/db";
import { getI18n } from "@/server/i18n";
import { validStopSignature } from "@/server/reminders/unpaid";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Email reminders", robots: { index: false, follow: false } };

const COPY = {
  en: {
    title: "Stop reminder emails?",
    body: "We'll stop emailing you reminders about invitations you haven't sent yet. Receipts, verification codes and other important emails still arrive.",
    confirm: "Stop reminders",
    doneTitle: "Reminders turned off",
    doneBody: "You won't get reminders about unsent invitations any more. You can turn them back on in Settings.",
    invalid: "This link isn't valid. Open Settings to change your email preferences.",
    settings: "Open Settings",
  },
  ar: {
    title: "إيقاف رسائل التذكير؟",
    body: "سنتوقف عن إرسال تذكيرات بالدعوات التي لم ترسلها بعد. ستصلك الإيصالات ورموز التحقق والرسائل المهمة كالمعتاد.",
    confirm: "إيقاف التذكيرات",
    doneTitle: "تم إيقاف التذكيرات",
    doneBody: "لن تصلك تذكيرات بالدعوات غير المرسلة بعد الآن. يمكنك إعادة تفعيلها من الإعدادات.",
    invalid: "هذا الرابط غير صالح. افتح الإعدادات لتغيير تفضيلات البريد.",
    settings: "فتح الإعدادات",
  },
};

/** The page behind "Stop these reminders" in reminder emails (a button, so link scanners can't trigger it). */
export default async function StopRemindersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { u = "", s = null, done } = await searchParams;
  const valid = Boolean(u) && validStopSignature(u, s);
  const user = valid ? await db.user.findUnique({ where: { id: u }, select: { locale: true, emailReminders: true } }) : null;
  const { locale } = await getI18n();
  const lang = user?.locale === "ar" || (!user && locale === "ar") ? "ar" : "en";
  const t = COPY[lang];
  const off = done === "1" || user?.emailReminders === false;
  return (
    <main dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-dvh flex-col items-center justify-center bg-ivory px-5 py-12">
      <Link href="/" aria-label="INVTRA" className="mb-10">
        <Logo markClassName="h-9" />
      </Link>
      <div className="w-full max-w-md rounded-3xl border border-line bg-paper p-8 text-center shadow-soft">
        <span className={`mx-auto flex size-14 items-center justify-center rounded-full ${off ? "bg-sage-soft text-sage" : "bg-sand text-bronze-600"}`}>
          {off ? <CheckCircle2 className="size-7" strokeWidth={1.75} /> : <MailX className="size-7" strokeWidth={1.75} />}
        </span>
        {!user ? (
          <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">{t.invalid}</p>
        ) : off ? (
          <>
            <h1 className="mt-6 font-display text-3xl text-ink">{t.doneTitle}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{t.doneBody}</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-3xl text-ink">{t.title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{t.body}</p>
            <form method="post" action={`/api/email/stop?u=${encodeURIComponent(u)}&s=${encodeURIComponent(s ?? "")}`} className="mt-7">
              <button type="submit" className={buttonClasses("primary", "lg", "w-full")}>
                {t.confirm}
              </button>
            </form>
          </>
        )}
        <Link href="/dashboard/settings" className="mt-5 inline-block text-[14px] text-bronze-700 underline-offset-4 hover:underline">
          {t.settings}
        </Link>
      </div>
    </main>
  );
}
