"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Copy, Plus, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/toggle";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Kind = "percent" | "amount";
type Plans = "all" | "BASIC" | "PREMIUM";

const segment = (on: boolean) =>
  cn(
    "flex-1 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
    on ? "bg-ink text-ivory shadow-soft" : "text-ink-soft hover:text-ink",
  );

/** Admin → Discount codes → New code. */
export function PromoCodeForm({ currency }: { currency: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<Kind>("percent");
  const [value, setValue] = useState("10");
  const [plans, setPlans] = useState<Plans>("all");
  const [maxUses, setMaxUses] = useState("");
  const [onePerCustomer, setOnePerCustomer] = useState(true);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await api<{ message: string; redirectTo: string }>(
        "/api/admin/codes",
        {
          body: {
            code,
            kind,
            value: Number(value),
            plans: plans === "all" ? [] : [plans],
            maxUses: maxUses ? Number(maxUses) : null,
            onePerCustomer,
            startsOn: startsOn || null,
            endsOn: endsOn || null,
            note,
          },
        },
      );
      toast(res.message, "success");
      router.push(res.redirectTo);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      if (err instanceof ApiError && err.code === "code_taken")
        setErrors({ code: err.message });
      toast(
        err instanceof ApiError ? err.message : "Couldn't create the code.",
        "error",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="primary"
        icon={<Plus className="size-4" />}
        onClick={() => setOpen(true)}
        data-testid="new-code"
      >
        New code
      </Button>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <TicketPercent className="size-5 text-bronze-600" />
            New discount code
          </span>
        }
        description="Customers enter it at checkout, or open your link with it already applied. It works on the Standard and Premium plans, not with limited-time offers."
      >
        <form
          id="code-form"
          onSubmit={submit}
          noValidate
          data-testid="code-form"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id="code-code"
              label="Code"
              error={errors.code}
              hint="Letters, digits and dashes — e.g. TIKTOK10 or SARA-15."
            >
              <Input
                id="code-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))
                }
                maxLength={30}
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase tracking-[0.08em]"
                aria-invalid={Boolean(errors.code)}
                required
              />
            </Field>
            <div>
              <span className="block text-[13px] font-medium text-ink">
                Discount
              </span>
              <div className="mt-1.5 flex gap-2">
                <div
                  role="radiogroup"
                  aria-label="Discount type"
                  className="flex w-44 shrink-0 rounded-xl border border-line bg-sand/60 p-1"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={kind === "percent"}
                    className={segment(kind === "percent")}
                    onClick={() => setKind("percent")}
                  >
                    Percent
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={kind === "amount"}
                    className={segment(kind === "amount")}
                    onClick={() => setKind("amount")}
                  >
                    {currency}
                  </button>
                </div>
                <div className="relative min-w-0 flex-1">
                  <Input
                    id="code-value"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={kind === "percent" ? 100 : undefined}
                    step={kind === "percent" ? 1 : 0.01}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    aria-label={
                      kind === "percent" ? "Percent off" : `${currency} off`
                    }
                    aria-invalid={Boolean(errors.value)}
                    className="pe-12"
                  />
                  <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">
                    {kind === "percent" ? "%" : currency}
                  </span>
                </div>
              </div>
              {errors.value ? (
                <p className="mt-1.5 text-[13px] text-rosewood" role="alert">
                  {errors.value}
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] text-ink-faint">
                  {kind === "percent" && value === "100"
                    ? "100% makes the plan free."
                    : "Taken off the plan's price."}
                </p>
              )}
            </div>
            <div>
              <span className="block text-[13px] font-medium text-ink">
                Works for
              </span>
              <div
                role="radiogroup"
                aria-label="Plans"
                className="mt-1.5 flex rounded-xl border border-line bg-sand/60 p-1"
              >
                {(
                  [
                    ["all", "Both"],
                    ["BASIC", "Standard"],
                    ["PREMIUM", "Premium"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={plans === k}
                    className={segment(plans === k)}
                    onClick={() => setPlans(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Field
              id="code-max"
              label="Total uses"
              optional="(optional)"
              hint="Paid orders in total. Leave empty for no limit."
              error={errors.maxUses}
            >
              <Input
                id="code-max"
                type="number"
                inputMode="numeric"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </Field>
            <Field
              id="code-start"
              label="Starts"
              optional="(optional)"
              hint="Riyadh time, from the start of the day."
              error={errors.startsOn}
            >
              <Input
                id="code-start"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
              />
            </Field>
            <Field
              id="code-end"
              label="Ends"
              optional="(optional)"
              hint="Works until the end of this day."
              error={errors.endsOn}
            >
              <Input
                id="code-end"
                type="date"
                value={endsOn}
                min={startsOn || undefined}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            </Field>
            <Field
              id="code-note"
              label="Note"
              optional="(optional)"
              hint="Who or what it's for — only staff see this."
              className="md:col-span-2"
              error={errors.note}
            >
              <Input
                id="code-note"
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. TikTok ad, October · Influencer @sara"
              />
            </Field>
            <div className="md:col-span-2">
              <Switch
                id="code-once"
                checked={onePerCustomer}
                onChange={setOnePerCustomer}
                label="Once per customer"
                description="Each account can buy with this code once."
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-line pt-5">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={!code || !value}
            >
              Create code
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Copy a code's share link (the code is applied at checkout for whoever opens it). */
export function CopyLink({
  url,
  label = "Copy link",
}: {
  url: string;
  label?: string;
}) {
  const toast = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      icon={<Copy className="size-3.5" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast("Link copied", "success");
        } catch {
          window.prompt("Copy this link", url);
        }
      }}
    >
      {label}
    </Button>
  );
}

/** Edit a live code's note, limit and end date. */
export function PromoEditForm({
  id,
  note: n0,
  maxUses: m0,
  endsOn: e0,
}: {
  id: string;
  note: string;
  maxUses: number | null;
  endsOn: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState(n0);
  const [maxUses, setMaxUses] = useState(m0 ? String(m0) : "");
  const [endsOn, setEndsOn] = useState(e0);
  const [busy, setBusy] = useState(false);
  const dirty =
    note !== n0 || maxUses !== (m0 ? String(m0) : "") || endsOn !== e0;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ message: string }>(`/api/admin/codes/${id}`, {
        body: {
          action: "update",
          note,
          maxUses: maxUses ? Number(maxUses) : null,
          endsOn: endsOn || null,
        },
      });
      toast(res.message, "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-2xl border border-line bg-paper px-5 py-5 shadow-soft"
    >
      <p className="font-medium text-ink">Edit</p>
      <div className="mt-4 space-y-4">
        <Field id="edit-note" label="Note" optional="(optional)">
          <Input
            id="edit-note"
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Field
          id="edit-max"
          label="Total uses"
          optional="(optional)"
          hint="Empty = no limit."
        >
          <Input
            id="edit-max"
            type="number"
            inputMode="numeric"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </Field>
        <Field
          id="edit-end"
          label="Ends"
          optional="(optional)"
          hint="Works until the end of this day (Riyadh)."
        >
          <Input
            id="edit-end"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </Field>
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        className="mt-5"
        loading={busy}
        disabled={!dirty}
      >
        Save changes
      </Button>
    </form>
  );
}
