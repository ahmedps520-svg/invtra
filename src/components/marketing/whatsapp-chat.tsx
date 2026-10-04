"use client";

import { useI18n } from "@/components/i18n/provider";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { supportChatUrl } from "@/lib/support";
import { cn } from "@/lib/utils";

/**
 * Floating "Chat with us on WhatsApp" button on the website: opens a chat with INVTRA's
 * support number (an ordinary wa.me link — the visitor writes and sends from their own app).
 */
export function WhatsAppChatButton({ number }: { number: string }) {
  const { dict } = useI18n();
  const t = dict.marketing.footer;
  if (!number) return null;
  return (
    <a
      href={supportChatUrl(number, t.chatMessage)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.chatLabel}
      title={t.chatLabel}
      className={cn(
        "group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-4 z-30 flex h-14 items-center gap-2.5 rounded-full bg-[#25D366] ps-4 pe-4 text-white",
        "shadow-[0_18px_40px_-14px_rgb(18_140_126/0.7)] ring-1 ring-black/5 transition duration-300 ease-luxe hover:-translate-y-0.5 hover:bg-[#1fbd5a] sm:end-6 sm:pe-5",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#128C7E] print:hidden",
      )}
    >
      <WhatsAppIcon className="size-6 shrink-0" />
      <span className="hidden text-[14px] font-semibold sm:inline">{t.chatShort}</span>
    </a>
  );
}
