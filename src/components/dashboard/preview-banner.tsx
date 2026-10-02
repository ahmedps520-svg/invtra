"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";

/** Shown while WhatsApp runs on the simulator, so nobody wonders why phones stay silent. */
export function PreviewBanner({ admin }: { admin: boolean }) {
  const { dict } = useI18n();
  const t = dict.dashboard.nav.previewMode;
  return (
    <div role="status" className="border-b border-bronze-200/70 bg-bronze-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[13px] text-ink-soft sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1.5 font-medium text-bronze-800">
          <FlaskConical className="size-3.5" aria-hidden="true" />
          {t.title}
        </span>
        <span>{t.body}</span>
        <Link href="/dev/whatsapp" className="font-medium text-bronze-700 underline decoration-bronze-300 underline-offset-4 hover:decoration-bronze-600">
          {t.simulator}
        </Link>
        {admin ? (
          <Link href="/admin/templates#connect" className="font-medium text-bronze-700 underline decoration-bronze-300 underline-offset-4 hover:decoration-bronze-600">
            {t.admin}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
