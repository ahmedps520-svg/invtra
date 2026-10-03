"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";

/** Starts the hosted checkout for a payment link and sends the browser there. */
/** `lang` is the page language, kept on the way back from the payment page. */
export function PayButton({
  token,
  lang,
  label,
  redirecting,
  errorText,
}: {
  token: string;
  lang: "en" | "ar";
  label: string;
  redirecting: string;
  errorText: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full"
      loading={busy}
      icon={<Lock className="size-4" />}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await api<{ redirectUrl: string }>(
            `/api/pay/${encodeURIComponent(token)}/checkout`,
            { method: "POST", body: { lang } },
          );
          toast(redirecting, "info");
          window.location.assign(res.redirectUrl);
        } catch (e) {
          toast(
            e instanceof ApiError && e.message ? e.message : errorText,
            "error",
          );
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}
