"use client";

import { useState } from "react";
import { Copy, DoorOpen, ExternalLink, MessageCircle, Power, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatDate } from "@/lib/format";
import { errorMessage } from "./i18n";

/**
 * Door check-in on the event overview: the host creates a link for the people at the
 * entrance, copies it or sends it on WhatsApp, and can replace or turn it off.
 */
export function DoorCard({
  eventId,
  eventTitle,
  initialUrl,
  closesAt,
  timeZone,
}: {
  eventId: string;
  eventTitle: string;
  initialUrl: string | null;
  closesAt: string;
  timeZone: string;
}) {
  const { dict, locale } = useI18n();
  const t = dict.door.card;
  const toast = useToast();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function act(action: "create" | "regenerate" | "disable") {
    setBusy(action);
    try {
      const r = await api<{ url: string | null }>(`/api/events/${eventId}/door`, { method: "POST", body: { action } });
      setUrl(r.url);
      if (action === "regenerate") toast(t.regenerated);
      if (action === "disable") toast(t.disabled);
      setConfirm(false);
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast(t.copied);
    } catch {
      window.prompt(t.copy, url);
    }
  }

  const share = url ? `https://wa.me/?text=${encodeURIComponent(fmt(t.shareText, { event: eventTitle, url }))}` : "#";

  return (
    <Card>
      <CardHeader title={t.title} />
      <div className="px-6 pb-6">
        <p className="text-[13.5px] leading-relaxed text-ink-soft">{t.body}</p>
        {url ? (
          <>
            <p className="mt-4 truncate rounded-xl bg-sand px-3.5 py-2.5 text-[13px] text-ink-soft" dir="ltr" data-testid="door-url">
              {url}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" icon={<Copy className="size-3.5" />} onClick={copy}>
                {t.copy}
              </Button>
              <a href={share} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "sm")}>
                <MessageCircle className="size-3.5" />
                {t.share}
              </a>
              <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost", "sm", "col-span-2")}>
                <ExternalLink className="size-3.5" />
                {t.open}
              </a>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">{fmt(t.note, { date: formatDate(new Date(closesAt), { locale, timeZone, style: "long" }) })}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-bronze-700 hover:text-bronze-900">
                <RefreshCw className="size-3.5" />
                {t.regenerate}
              </button>
              <button
                type="button"
                disabled={busy === "disable"}
                onClick={() => act("disable")}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-faint hover:text-rosewood disabled:opacity-50"
              >
                <Power className="size-3.5" />
                {t.disable}
              </button>
            </div>
          </>
        ) : (
          <Button variant="primary" size="sm" className="mt-4" icon={<DoorOpen className="size-4" />} loading={busy === "create"} onClick={() => act("create")}>
            {t.create}
          </Button>
        )}
      </div>
      <Dialog
        open={confirm}
        onClose={() => busy !== "regenerate" && setConfirm(false)}
        title={t.regenerate}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy === "regenerate"}>
              {dict.common.actions.cancel}
            </Button>
            <Button variant="primary" loading={busy === "regenerate"} onClick={() => act("regenerate")}>
              {t.regenerate}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{t.regenerateConfirm}</p>
      </Dialog>
    </Card>
  );
}
