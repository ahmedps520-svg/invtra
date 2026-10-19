"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";

/** Upload a final deliverable for an order (the finished custom design): PNG, JPG, WEBP or PDF. */
export function FinalFileUpload({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api(`/api/admin/orders/${orderId}/files`, { method: "POST", body: form });
      toast("File added");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        onClick={() => input.current?.click()}
      >
        {busy ? "Uploading…" : "Upload final file"}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="sr-only"
        onChange={(e) => upload(e.target.files)}
        data-testid="final-input"
      />
    </>
  );
}
