"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Switch } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";

/** Enable / disable a template for new sends (any status). */
export function TemplateActiveSwitch({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(isActive);
  const [busy, setBusy] = useState(false);
  return (
    <Switch
      id={`tpl-active-${id}`}
      checked={on}
      disabled={busy}
      label={on ? "Enabled" : "Disabled"}
      onChange={async (v) => {
        setOn(v);
        setBusy(true);
        try {
          const r = await api<{ message: string }>(`/api/admin/templates/${id}`, { method: "PATCH", body: { isActive: v } });
          toast(r.message);
          router.refresh();
        } catch (e) {
          setOn(!v);
          toast(e instanceof ApiError ? e.message : "Could not update the template.", "error");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
