"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";

/** Active / Premium switches and picker position for one theme. Saves immediately. */
export function ThemeControls({ themeKey, isActive, isPremium, sortOrder }: { themeKey: string; isActive: boolean; isPremium: boolean; sortOrder: number }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState({ isActive, isPremium, sortOrder: String(sortOrder) });
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<{ isActive: boolean; isPremium: boolean; sortOrder: number }>, label: string) {
    setBusy(true);
    try {
      await api(`/api/admin/themes/${themeKey}`, { method: "PATCH", body: patch });
      toast(label);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not update the theme.", "error");
      setState({ isActive, isPremium, sortOrder: String(sortOrder) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Switch
        id={`active-${themeKey}`}
        checked={state.isActive}
        disabled={busy}
        onChange={(v) => {
          setState((s) => ({ ...s, isActive: v }));
          void save({ isActive: v }, v ? "Theme is available to customers" : "Theme hidden from customers");
        }}
        label="Available"
        description="Customers can choose it for new designs."
      />
      <Switch
        id={`premium-${themeKey}`}
        checked={state.isPremium}
        disabled={busy}
        onChange={(v) => {
          setState((s) => ({ ...s, isPremium: v }));
          void save({ isPremium: v }, v ? "Theme now requires Premium" : "Theme available on every plan");
        }}
        label="Premium"
        description="Requires the Premium or Custom plan."
      />
      <div className="flex items-center gap-3 pt-1">
        <label htmlFor={`sort-${themeKey}`} className="text-sm text-ink-soft">
          Position
        </label>
        <Input
          id={`sort-${themeKey}`}
          type="number"
          min={0}
          max={999}
          value={state.sortOrder}
          disabled={busy}
          onChange={(e) => setState((s) => ({ ...s, sortOrder: e.target.value }))}
          onBlur={() => {
            const n = Number.parseInt(state.sortOrder, 10);
            if (Number.isFinite(n) && n !== sortOrder) void save({ sortOrder: n }, "Order updated");
            else setState((s) => ({ ...s, sortOrder: String(sortOrder) }));
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-9 w-20 text-sm"
        />
      </div>
    </div>
  );
}
