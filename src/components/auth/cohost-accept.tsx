"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

/** Accepts the co-host invitation for the signed-in account, or signs out to use another. */
export function CoHostAccept({
  token,
  labels,
}: {
  token: string;
  labels: { accept: string; signedInAs: string; notYou: string; errors: Record<string, string>; generic: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ redirectTo: string }>("/api/cohost/accept", { method: "POST", body: { token } });
      router.replace(r.redirectTo);
    } catch (e) {
      setError((e instanceof ApiError && labels.errors[e.code]) || labels.generic);
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    router.refresh();
  }

  return (
    <div>
      <Button size="lg" className="w-full" loading={busy} onClick={accept}>
        {labels.accept}
      </Button>
      {error ? (
        <p className="mt-3 text-[13.5px] text-rosewood" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-5 text-center text-[13px] text-ink-faint">
        {labels.signedInAs}{" "}
        <button type="button" onClick={signOut} className="font-medium text-bronze-700 underline-offset-4 hover:underline">
          {labels.notYou}
        </button>
      </p>
    </div>
  );
}
