"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Check, Copy, ExternalLink, Palette, Send } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { ConfirmDialog } from "./actions";

/** Copy a payment link to the clipboard (falls back to selecting it in a prompt). */
export function CopyLinkButton({
  url,
  label = "Copy link",
  size = "sm",
}: {
  url: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Payment link copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the payment link:", url);
    }
  }
  return (
    <Button
      variant="outline"
      size={size}
      icon={
        copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />
      }
      onClick={copy}
    >
      {label}
    </Button>
  );
}

/** Row actions for an unpaid custom package: copy / open / resend the link, or withdraw it. */
export function CustomPackageActions({
  id,
  eventId,
  payUrl,
  pending,
  hasPhone,
}: {
  id: string;
  /** The custom event (null if it was deleted). */
  eventId: string | null;
  payUrl: string;
  pending: boolean;
  hasPhone: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [resend, setResend] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [channels, setChannels] = useState({ whatsapp: hasPhone, email: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!channels.whatsapp && !channels.email) {
      setError("Choose WhatsApp, email or both.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ message: string }>(`/api/admin/custom/${id}`, {
        body: { action: "send", ...channels },
      });
      toast(res.message, "success");
      setResend(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {eventId ? (
        <Link
          href={`/admin/custom/${eventId}/design`}
          className={buttonClasses("outline", "sm")}
          title="Choose the design and wording"
        >
          <Palette className="size-3.5" />
          Design
        </Link>
      ) : null}
      <CopyLinkButton url={payUrl} label="Copy" />
      <a
        href={payUrl}
        target="_blank"
        rel="noopener"
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink-soft transition hover:bg-sand hover:text-ink"
        title="Open the payment page the customer sees"
      >
        <ExternalLink className="size-3.5" />
        Open
      </a>
      {pending ? (
        <>
          <Button
            variant="outline"
            size="sm"
            icon={<Send className="size-3.5" />}
            onClick={() => setResend(true)}
          >
            Resend
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Ban className="size-3.5" />}
            onClick={() => setCancel(true)}
          >
            Withdraw
          </Button>
          <Dialog
            open={resend}
            onClose={() => !busy && setResend(false)}
            title="Send the payment link again"
            description="The customer gets the same link — nothing about the package changes."
            size="sm"
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setResend(false)}
                  disabled={busy}
                >
                  Cancel
                </Button>
                <Button
                  onClick={send}
                  loading={busy}
                  icon={<Send className="size-4" />}
                >
                  Send
                </Button>
              </>
            }
          >
            <div className="space-y-3">
              <Checkbox
                checked={channels.whatsapp}
                onChange={(v) => setChannels((c) => ({ ...c, whatsapp: v }))}
                label={
                  <span className="text-ink">
                    WhatsApp{" "}
                    {hasPhone ? null : (
                      <span className="text-ink-faint">
                        (no number on file)
                      </span>
                    )}
                  </span>
                }
              />
              <Checkbox
                checked={channels.email}
                onChange={(v) => setChannels((c) => ({ ...c, email: v }))}
                label={<span className="text-ink">Email</span>}
              />
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rosewood/20 bg-rosewood-soft px-3.5 py-2.5 text-[13px] text-rosewood"
                >
                  {error}
                </p>
              ) : null}
            </div>
          </Dialog>
          <ConfirmDialog
            open={cancel}
            onClose={() => setCancel(false)}
            title="Withdraw this package?"
            description="The payment link stops working. The event stays in the customer's account without a plan."
            confirmLabel="Withdraw"
            tone="danger"
            onConfirm={async () => {
              const res = await api<{ message: string }>(
                `/api/admin/custom/${id}`,
                { body: { action: "cancel" } },
              );
              toast(res.message, "success");
              setCancel(false);
              router.refresh();
            }}
          />
        </>
      ) : null}
    </div>
  );
}
