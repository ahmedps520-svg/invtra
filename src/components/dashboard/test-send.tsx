"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CheckCircle2, Smartphone } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatPhone } from "@/lib/phone";
import { errorMessage, plural } from "./i18n";

/** "Send me a test" — the full guest experience on the host's own WhatsApp. */
export function TestSend({
  eventId,
  defaultPhone,
  defaultCountry = "SA",
  hasPlan,
  used,
  limit,
  mock,
}: {
  eventId: string;
  defaultPhone: string;
  defaultCountry?: string;
  hasPlan: boolean;
  used: number;
  limit: number;
  mock: boolean;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.review.test;
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [usedNow, setUsedNow] = useState(used);
  const remaining = Math.max(0, limit - usedNow);
  const exhausted = !hasPlan && remaining === 0;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 5) {
      setError(dict.dashboard.errors.invalid_phone);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ guest: { phone: string } }>(`/api/events/${eventId}/send-test`, { method: "POST", body: { phone } });
      setSentTo(res.guest.phone);
      setUsedNow((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "invalid_phone" ? dict.dashboard.errors.invalid_phone : errorMessage(err, dict));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="px-6 py-6 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-12">
        <div>
          <h3 className="flex items-center gap-2.5 font-display text-2xl text-ink">
            <Smartphone className="size-5 text-bronze-500" />
            {d.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{d.description}</p>
        </div>
        <form onSubmit={send} noValidate>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field id="test-phone" label={d.phone} className="flex-1" error={error}>
              <PhoneInput
                id="test-phone"
                value={phone}
                defaultCountry={defaultCountry}
                placeholder="50 123 4567"
                invalid={Boolean(error)}
                onChange={(v) => {
                  setPhone(v);
                  setError(null);
                }}
                disabled={exhausted}
              />
            </Field>
            <Button type="submit" variant="outline" size="lg" loading={busy} disabled={exhausted} className={error ? "sm:mb-[1.85rem]" : undefined}>
              {busy ? d.sending : d.send}
            </Button>
          </div>
          <p className="mt-2.5 text-[13px] text-ink-faint">{hasPlan ? null : exhausted ? d.noneLeft : plural(locale, d.remaining, remaining)}</p>
          <AnimatePresence>
            {sentTo ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-start gap-3 rounded-2xl border border-sage/20 bg-sage-soft px-4 py-3 text-sm"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sage" />
                <div>
                  <p className="text-ink">{fmt(d.sent, { phone: "⁦" + formatPhone(sentTo) + "⁩" })}</p>
                  {mock ? (
                    <Link href={`/dev/whatsapp?phone=${encodeURIComponent(sentTo)}`} className="mt-1 inline-block font-medium text-bronze-700 underline-offset-4 hover:underline">
                      {d.simulator}
                    </Link>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </form>
      </div>
    </Card>
  );
}
