"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Mail,
  MessageCircle,
  Send,
} from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CopyLinkButton } from "./custom-actions";

/** Last step of a custom event: send the payment link by WhatsApp and/or email (or copy it). */
export function SendLinkPanel({
  orderId,
  payUrl,
  hasPhone,
  whatsappReady,
  testPayments,
  lastSent,
}: {
  orderId: string;
  payUrl: string;
  hasPhone: boolean;
  /** An approved WhatsApp payment-request template exists. */
  whatsappReady: boolean;
  /** Payments run on the mock provider — the link "pays" without charging. */
  testPayments: boolean;
  /** When the link was last sent (already formatted), if ever. */
  lastSent: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const canWhatsApp = hasPhone && whatsappReady;
  const [channels, setChannels] = useState({
    whatsapp: canWhatsApp,
    email: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function send() {
    const body = {
      action: "send",
      whatsapp: channels.whatsapp && canWhatsApp,
      email: channels.email,
    };
    if (!body.whatsapp && !body.email) {
      setError("Choose WhatsApp, email or both — or just copy the link above.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ message: string }>(
        `/api/admin/custom/${orderId}`,
        { body },
      );
      setSent(res.message);
      toast(res.message, "success");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink-soft">
          Payment link
        </p>
        <div className="flex items-center gap-2 rounded-full border border-line bg-sand/50 py-1.5 pe-1.5 ps-4">
          <span
            className="min-w-0 flex-1 truncate text-[13px] text-ink-soft"
            dir="ltr"
          >
            {payUrl}
          </span>
          <CopyLinkButton url={payUrl} />
          <a
            href={payUrl}
            target="_blank"
            rel="noopener"
            className={buttonClasses("ghost", "sm")}
            title="Open the page the host sees"
          >
            <ExternalLink className="size-3.5" />
            Open
          </a>
        </div>
        {testPayments ? (
          <p className="mt-2 text-[12.5px] text-ochre">
            Test mode: no money is taken — pressing Pay on this link marks the
            package paid straight away, for you or the host. Connect Tap to take
            real payments (Apple Pay, mada, cards).
          </p>
        ) : null}
      </div>

      {sent ? (
        <div className="rounded-2xl border border-sage/25 bg-sage-soft px-5 py-5">
          <p className="flex items-center gap-2 font-medium text-ink">
            <CheckCircle2 className="size-5 text-sage" />
            Payment link sent
          </p>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {sent}. When the host pays, the plan switches on and they get a
            numbered receipt.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/custom"
              className={buttonClasses("primary", "md")}
            >
              All custom events
            </Link>
            <Button variant="outline" onClick={() => setSent(null)}>
              Send again
            </Button>
          </div>
        </div>
      ) : (
        <fieldset className="rounded-2xl border border-line bg-sand/40 p-4 sm:p-5">
          <legend className="sr-only">Send the payment link</legend>
          <p className="mb-3 text-sm font-medium text-ink">
            Send it to the host by
          </p>
          <div className="space-y-3">
            <div>
              <Checkbox
                checked={channels.whatsapp && canWhatsApp}
                disabled={!canWhatsApp}
                onChange={(v) => setChannels((c) => ({ ...c, whatsapp: v }))}
                label={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      canWhatsApp ? "text-ink" : "text-ink-faint",
                    )}
                  >
                    <MessageCircle className="size-4" /> WhatsApp
                  </span>
                }
              />
              {!hasPhone ? (
                <p className="ms-[26px] mt-1 text-[12.5px] text-ink-faint">
                  The host has no WhatsApp number on file.
                </p>
              ) : !whatsappReady ? (
                <p className="ms-[26px] mt-1 text-[12.5px] text-ochre">
                  The WhatsApp payment template isn&apos;t approved yet —{" "}
                  <Link
                    href="/admin/templates"
                    className="underline underline-offset-2"
                  >
                    submit it in Templates
                  </Link>
                  . Until then use email or copy the link.
                </p>
              ) : null}
            </div>
            <Checkbox
              checked={channels.email}
              onChange={(v) => setChannels((c) => ({ ...c, email: v }))}
              label={
                <span className="inline-flex items-center gap-1.5 text-ink">
                  <Mail className="size-4" /> Email
                </span>
              }
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rosewood/20 bg-rosewood-soft px-3.5 py-2.5 text-[13px] text-rosewood"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-ink-faint">
              {lastSent ? `Last sent ${lastSent}.` : "Not sent yet."}
            </p>
            <Button
              variant="accent"
              onClick={send}
              loading={busy}
              icon={<Send className="size-4" />}
            >
              {lastSent ? "Send again" : "Send payment link"}
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
