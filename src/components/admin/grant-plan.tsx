"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";

const DEFAULT_LIMIT: Record<string, number> = { BASIC: 100, PREMIUM: 500, CUSTOM: 1000 };

/** Admin: give an event a plan without payment (comp, custom deal, goodwill). */
export function GrantPlanButton({
  eventId,
  currentPlan,
  currentLimit,
  guestCount,
}: {
  eventId: string;
  currentPlan: string | null;
  currentLimit: number;
  guestCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(currentPlan === "BASIC" ? "PREMIUM" : currentPlan ?? "PREMIUM");
  const [limit, setLimit] = useState(String(Math.max(currentLimit, DEFAULT_LIMIT[currentPlan === "BASIC" ? "PREMIUM" : currentPlan ?? "PREMIUM"])));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit() {
    setBusy(true);
    setErrors({});
    try {
      const r = await api<{ message: string }>(`/api/admin/events/${eventId}`, { body: { action: "grant_plan", plan, guestLimit: Number(limit), note } });
      toast(r.message);
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setErrors(err.fields ?? { _: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" icon={<Gift className="size-3.5" />} onClick={() => setOpen(true)}>
        Grant plan
      </Button>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Grant a plan"
        description="Sets the event's plan and guest limit without payment and records a paid zero-amount order."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={busy}>
              Grant plan
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field id="grant-plan" label="Plan" error={errors.plan}>
              <Select
                id="grant-plan"
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  setLimit(String(Math.max(currentLimit, DEFAULT_LIMIT[e.target.value] ?? 100)));
                }}
              >
                <option value="BASIC">Basic</option>
                <option value="PREMIUM">Premium</option>
                <option value="CUSTOM">Custom</option>
              </Select>
            </Field>
            <Field id="grant-limit" label="Guest limit" error={errors.guestLimit} hint={guestCount ? `${guestCount} guests on the list` : undefined}>
              <Input id="grant-limit" type="number" min={Math.max(1, guestCount)} max={100000} value={limit} onChange={(e) => setLimit(e.target.value)} aria-invalid={Boolean(errors.guestLimit)} />
            </Field>
          </div>
          <Field id="grant-note" label="Note" error={errors.note} hint="Why this plan was granted — kept on the order and in the audit log.">
            <Textarea id="grant-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Corporate deal #2026-114, 1,200 guests" aria-invalid={Boolean(errors.note)} />
          </Field>
          {errors._ ? (
            <p role="alert" className="rounded-xl border border-rosewood/20 bg-rosewood-soft px-3.5 py-2.5 text-[13px] text-rosewood">
              {errors._}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
