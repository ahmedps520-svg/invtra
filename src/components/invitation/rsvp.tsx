"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronDown, Download, Lock, X } from "lucide-react";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { Label, Reveal, SectionHeading, Txt, useInvitation, useNumber } from "./primitives";
import s from "./invitation.module.css";

type Status = "PENDING" | "ACCEPTED" | "DECLINED";

/**
 * RSVP on the invitation website. Follows the same rules as the WhatsApp buttons
 * (server-side state machine): guests can change their mind until replies close.
 */
export function Rsvp({ status, attending, onChange }: { status: Status; attending: number | null; onChange: (s: Status, n: number | null) => void }) {
  const { vm, d, lang } = useInvitation();
  const router = useRouter();
  const num = useNumber();
  const guest = vm.guest;
  const [count, setCount] = useState<number>(attending ?? guest?.allowedCount ?? 1);
  const [saving, setSaving] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  if (!guest) return null;

  const live = vm.mode === "guest";
  const interactive = vm.mode !== "host" && vm.event.rsvpOpen && (vm.event.allowWebRsvp || !live);

  async function answer(next: Status) {
    setError(null);
    if (!live) {
      onChange(next, next === "ACCEPTED" ? count : 0);
      return;
    }
    setSaving(next);
    try {
      const res = await fetch(`/api/i/${vm.token}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: next, attendingCount: next === "ACCEPTED" ? count : undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { rsvpStatus: Status; attendingCount: number | null };
      onChange(body.rsvpStatus, body.attendingCount);
      setConfirmDecline(false);
      router.refresh(); // fetch the entry-pass QR for newly accepted guests
    } catch {
      setError(d.rsvp.error);
    } finally {
      setSaving(null);
    }
  }

  const counter =
    guest.allowedCount > 1 ? (
      <label className="mt-6 flex items-center justify-center gap-3 text-sm">
        <Label pick={(x) => x.rsvp.attending} className={s.muted} />
        <span className="relative">
          <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-60" aria-hidden="true" />
          <select className={cn(s.select, "pe-9 ps-5")} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {Array.from({ length: guest.allowedCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {num(n)}
              </option>
            ))}
          </select>
        </span>
      </label>
    ) : null;

  return (
    <section id="rsvp" className="scroll-mt-20">
      <SectionHeading label={(x) => x.rsvp.title} />
      <Reveal className={cn(s.card, "mx-auto max-w-lg px-6 py-10 text-center sm:px-10")}>
        {status === "PENDING" ? (
          <>
            <Label pick={(x) => x.rsvp.question} className={cn(s.display, "block text-3xl")} inline={false} />
            {vm.event.rsvpDeadline && vm.event.rsvpOpen ? (
              <Txt
                en={fmt(vm.dict.en.rsvp.deadline, { date: vm.event.rsvpDeadline.en })}
                ar={fmt(vm.dict.ar.rsvp.deadline, { date: vm.event.rsvpDeadline.ar })}
                as="p"
                className={cn(s.muted, "mt-3 text-sm")}
              />
            ) : null}
            {interactive ? (
              <>
                {counter}
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <button type="button" className={cn(s.button, s.primary)} disabled={saving !== null} onClick={() => answer("ACCEPTED")}>
                    <Check className="size-4" />
                    {saving === "ACCEPTED" ? d.rsvp.saving : lang === "bilingual" ? `${vm.dict.ar.rsvp.accept} · ${vm.dict.en.rsvp.accept}` : d.rsvp.accept}
                  </button>
                  <button type="button" className={cn(s.button, s.ghost)} disabled={saving !== null} onClick={() => answer("DECLINED")}>
                    {saving === "DECLINED" ? d.rsvp.saving : lang === "bilingual" ? `${vm.dict.ar.rsvp.decline} · ${vm.dict.en.rsvp.decline}` : d.rsvp.decline}
                  </button>
                </div>
              </>
            ) : (
              <Label
                pick={(x) => (!vm.event.rsvpOpen ? x.rsvp.closed : x.rsvp.replyOnWhatsApp)}
                className={cn(s.muted, "mt-6 block text-sm leading-relaxed")}
                inline={false}
              />
            )}
          </>
        ) : status === "ACCEPTED" ? (
          <>
            <span className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full" style={{ background: "var(--inv-accent)", color: "var(--inv-on-accent)" }}>
              <Check className="size-5" />
            </span>
            <Label pick={(x) => x.rsvp.accepted} className={cn(s.display, "block text-3xl")} inline={false} />
            <Label pick={(x) => x.rsvp.acceptedBody} className={cn(s.muted, "mt-3 block")} inline={false} />
            {attending ? (
              <Txt
                en={fmt(vm.dict.en.rsvp.acceptedCount, { n: attending })}
                ar={fmt(vm.dict.ar.rsvp.acceptedCount, { n: num(attending) })}
                as="p"
                className="mt-4 text-sm font-medium"
                inline
              />
            ) : null}
            {interactive ? (
              <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--inv-line)" }}>
                {guest.allowedCount > 1 && count !== attending ? (
                  <div className="mb-4 flex flex-col items-center gap-3">
                    {counter}
                    <button type="button" className={cn(s.button, s.ghost)} disabled={saving !== null} onClick={() => answer("ACCEPTED")}>
                      {saving === "ACCEPTED" ? d.rsvp.saving : d.rsvp.updateCount}
                    </button>
                  </div>
                ) : guest.allowedCount > 1 ? (
                  <div className="mb-2">{counter}</div>
                ) : null}
                {confirmDecline ? (
                  <div className="flex flex-col items-center gap-3">
                    <Label pick={(x) => x.rsvp.confirmDecline} className="text-sm" inline={false} />
                    <div className="flex gap-2">
                      <button type="button" className={cn(s.button, s.ghost, "min-h-10 px-5")} onClick={() => setConfirmDecline(false)}>
                        <X className="size-4" />
                      </button>
                      <button type="button" className={cn(s.button, s.primary, "min-h-10 px-5")} disabled={saving !== null} onClick={() => answer("DECLINED")}>
                        {saving === "DECLINED" ? d.rsvp.saving : d.rsvp.decline}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={cn(s.muted, "text-sm underline underline-offset-4")} onClick={() => setConfirmDecline(true)}>
                    <Label pick={(x) => x.rsvp.changeToDecline} />
                  </button>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Label pick={(x) => x.rsvp.declined} className={cn(s.display, "block text-3xl")} inline={false} />
            <Label pick={(x) => x.rsvp.declinedBody} className={cn(s.muted, "mt-3 block")} inline={false} />
            {interactive ? (
              <div className="mt-8">
                {counter}
                <button type="button" className={cn(s.button, s.ghost, "mt-5")} disabled={saving !== null} onClick={() => answer("ACCEPTED")}>
                  {saving === "ACCEPTED" ? d.rsvp.saving : <Label pick={(x) => x.rsvp.changeToAccept} />}
                </button>
              </div>
            ) : null}
          </>
        )}
        {error ? (
          <p role="alert" className="mt-5 text-sm" style={{ color: "#b4553e" }}>
            {error}
          </p>
        ) : null}
      </Reveal>
    </section>
  );
}

/** The guest's entry pass: their unique QR, only once they've accepted. */
export function EntryPass({ status }: { status: Status }) {
  const { vm, d } = useInvitation();
  const num = useNumber();
  const guest = vm.guest;
  if (!guest || status === "DECLINED") return null;
  const unlocked = status === "ACCEPTED" && vm.qrSvg;
  const live = vm.mode === "guest" && vm.token;
  return (
    <section id="pass" className="scroll-mt-20">
      <div className="mb-8 text-center">
        <Label pick={(x) => x.pass.title} className={cn(s.eyebrow, "block")} />
      </div>
      <Reveal className="mx-auto max-w-xs text-center">
        <div className={cn(s.qrPlate, "relative mx-auto aspect-square w-full max-w-[260px]")}>
          {unlocked ? (
            <div dangerouslySetInnerHTML={{ __html: vm.qrSvg! }} />
          ) : (
            <>
              <div className={cn(s.locked, "grid size-full grid-cols-7 gap-1")} aria-hidden="true">
                {Array.from({ length: 49 }).map((_, i) => (
                  <span key={i} className="rounded-sm" style={{ background: "var(--inv-text)", opacity: (i * 7919) % 3 ? 0.9 : 0.15 }} />
                ))}
              </div>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full" style={{ background: "var(--inv-surface)", border: "1px solid var(--inv-line)" }}>
                  <Lock className="size-5" />
                </span>
              </span>
            </>
          )}
        </div>
        {unlocked ? (
          <>
            <p className={cn(s.display, "mt-6 text-2xl")}>{guest.name}</p>
            {vm.section ? <Txt en={vm.section.label.en} ar={vm.section.label.ar} as="p" className={cn(s.eyebrow, "mt-2 block")} inline /> : null}
            <Txt
              en={guest.allowedCount > 1 ? fmt(vm.dict.en.admits, { n: guest.attendingCount ?? guest.allowedCount }) : vm.dict.en.admitsOne}
              ar={guest.allowedCount > 1 ? fmt(vm.dict.ar.admits, { n: num(guest.attendingCount ?? guest.allowedCount) }) : vm.dict.ar.admitsOne}
              as="p"
              className={cn(s.eyebrow, "mt-2 block")}
              inline
            />
            <Label pick={(x) => x.pass.body} className={cn(s.muted, "mt-4 block text-sm")} inline={false} />
            {live ? (
              <div className="mt-6 flex flex-col items-center gap-2.5">
                <a href={`/i/${vm.token}/image?download=1`} className={cn(s.button, s.primary, "w-full")}>
                  <Download className="size-4" />
                  {d.pass.download}
                </a>
              </div>
            ) : null}
            <Txt
              en={fmt(vm.dict.en.pass.personal, { name: guest.name })}
              ar={fmt(vm.dict.ar.pass.personal, { name: guest.name })}
              as="p"
              className={cn(s.muted, "mt-5 text-xs")}
            />
          </>
        ) : (
          <Label pick={(x) => x.pass.locked} className={cn(s.muted, "mt-5 block text-sm leading-relaxed")} inline={false} />
        )}
      </Reveal>
    </section>
  );
}
