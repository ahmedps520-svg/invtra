"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, PauseCircle, Send } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { errorMessage, plural } from "./i18n";
import { stepHref } from "./steps";
import { Bubble, ChatFrame } from "./whatsapp-preview";

type PreviewProps = React.ComponentProps<typeof CardPreview>;
export type BatchState = { id: string; total: number; sent: number; failed: number; skipped: number; status: string; kind?: string };
type Phase = "ready" | "sending" | "done" | "nothing" | "notReady";

const isRunning = (b: BatchState | null) => Boolean(b && (b.status === "QUEUED" || b.status === "RUNNING"));

export function SendPanel({
  eventId,
  ready,
  unsent,
  guestCount,
  failedCount,
  themeLabel,
  templateName,
  languageLabel,
  preview,
  message,
  runningBatch,
}: {
  eventId: string;
  ready: boolean;
  unsent: number;
  guestCount: number;
  failedCount: number;
  themeLabel: string;
  templateName: string | null;
  languageLabel: string;
  preview: PreviewProps;
  message: { body: string; footer: string | null; buttons: string[]; headerImage: boolean } | null;
  runningBatch: BatchState | null;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.send;
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();

  const initialPhase: Phase = isRunning(runningBatch) ? "sending" : unsent === 0 && guestCount > 0 ? "nothing" : !ready ? "notReady" : "ready";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [batch, setBatch] = useState<BatchState | null>(isRunning(runningBatch) ? runningBatch : null);
  const [confirm, setConfirm] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const n = (v: number) => formatNumber(v, locale);
  const processed = batch ? batch.sent + batch.failed + batch.skipped : 0;
  const batchId = batch?.id;

  const poll = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await api<{ batch: BatchState & { done: boolean } }>(`/api/events/${eventId}/batches/${batchId}`);
      setBatch(res.batch);
      if (res.batch.done) {
        setPhase("done");
        router.refresh();
      }
    } catch {
      // transient — try again on the next tick
    }
  }, [eventId, batchId, router]);

  // Each phase is a fresh screen — bring it into view.
  useEffect(() => {
    if (phase !== initialPhase) window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [phase, initialPhase, reduce]);

  useEffect(() => {
    if (phase !== "sending" || !batchId) return;
    const t = setInterval(poll, 1000);
    return () => clearInterval(t);
  }, [phase, batchId, poll]);

  async function start() {
    setBusy("send");
    try {
      const res = await api<{ batch: BatchState }>(`/api/events/${eventId}/send`, { method: "POST", body: {} });
      setBatch(res.batch);
      setPhase("sending");
      setConfirm(false);
    } catch (e) {
      setConfirm(false);
      if (e instanceof ApiError && e.code === "nothing_to_send") setPhase("nothing");
      else if (e instanceof ApiError && e.code === "batch_running") {
        try {
          const s = await api<{ latestBatch: BatchState | null }>(`/api/events/${eventId}/stats`);
          if (s.latestBatch && isRunning(s.latestBatch)) {
            setBatch(s.latestBatch);
            setPhase("sending");
            return;
          }
        } catch {
          /* fall through to the message */
        }
        toast(errorMessage(e, dict), "error");
      } else {
        toast(errorMessage(e, dict), "error");
        if (e instanceof ApiError && e.code === "not_ready") {
          setPhase("notReady");
          router.refresh();
        }
      }
    } finally {
      setBusy(null);
    }
  }

  async function stop() {
    if (!batch) return;
    setBusy("stop");
    try {
      const res = await api<{ batch: BatchState }>(`/api/events/${eventId}/batches/${batch.id}/cancel`, { method: "POST", body: {} });
      if (res.batch) setBatch(res.batch);
      setPhase("done");
      setStopConfirm(false);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(null);
    }
  }

  async function resendFailed() {
    setBusy("resend");
    try {
      const list = await api<{ guests: { id: string }[] }>(`/api/events/${eventId}/guests?status=FAILED&pageSize=200`);
      if (!list.guests.length) {
        setBusy(null);
        return;
      }
      const r = await api<{ batchId: string | null; requested: number }>(`/api/events/${eventId}/guests/resend`, {
        method: "POST",
        body: { ids: list.guests.map((g) => g.id) },
      });
      if (r.batchId) {
        setBatch({ id: r.batchId, total: r.requested, sent: 0, failed: 0, skipped: 0, status: "QUEUED" });
        setPhase("sending");
      } else toast(dict.dashboard.guests.resendNothing, "info");
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(null);
    }
  }

  const fade = {
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <AnimatePresence mode="wait">
        {phase === "ready" ? (
          <motion.div key="ready" {...fade}>
            <div className="text-center">
              <p className="eyebrow">{d.eyebrow}</p>
              <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl leading-[1.1] text-ink sm:text-[3.4rem]">{plural(locale, d.ready.title, unsent)}</h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">{d.ready.body}</p>
            </div>

            <dl className="mt-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-paper shadow-soft md:grid-cols-4">
              {[
                { label: d.ready.guests, value: n(unsent), display: true },
                { label: d.ready.design, value: themeLabel },
                { label: d.ready.message, value: templateName ?? "—" },
                { label: d.ready.language, value: languageLabel },
              ].map((x, i) => (
                <div key={x.label} className={cn("px-5 py-4", i % 2 === 1 && "border-s border-line", i > 1 && "border-t border-line md:border-t-0", i === 2 && "md:border-s")}>
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-faint">{x.label}</dt>
                  <dd className={cn("mt-1.5 text-ink", x.display ? "font-display text-3xl leading-none lining-nums" : "text-[15px] font-medium")}>{x.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 grid items-center gap-8 rounded-3xl border border-line bg-ivory/60 px-6 py-8 sm:px-10 md:grid-cols-2">
              <div className="paper-grain flex justify-center rounded-2xl bg-sand px-6 py-8">
                <CardPreview {...preview} guest={null} qrPlaceholder={false} className="w-full max-w-[240px] rounded-[3px] shadow-lift ring-1 ring-ink/5" />
              </div>
              {message ? (
                <ChatFrame title={dict.dashboard.whatsapp.business} subtitle={dict.dashboard.whatsapp.verified}>
                  <Bubble
                    header={message.headerImage ? <CardPreview {...preview} guest={null} qrPlaceholder={false} className="rounded-lg" /> : undefined}
                    body={message.body}
                    footer={message.footer}
                    buttons={message.buttons.map((text) => ({ text }))}
                  />
                </ChatFrame>
              ) : null}
            </div>

            <div className="mt-10 flex flex-col items-center gap-3">
              <Button variant="accent" size="lg" className="h-14 px-10 text-[13px] uppercase tracking-[0.2em]" icon={<Send className="size-4 rtl:-scale-x-100" />} onClick={() => setConfirm(true)}>
                {d.ready.button}
              </Button>
              {guestCount > unsent ? <p className="text-[13px] text-ink-faint">{plural(locale, d.ready.alreadySent, guestCount - unsent)}</p> : null}
            </div>
          </motion.div>
        ) : phase === "sending" && batch ? (
          <motion.div key="sending" {...fade}>
            <Card className="relative overflow-hidden px-6 py-12 text-center sm:px-14 sm:py-16">
              <div className="paper-grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />
              <div className="relative">
                <motion.div
                  className="mx-auto flex size-16 items-center justify-center rounded-full border border-bronze-200 bg-bronze-50 text-bronze-600"
                  animate={reduce ? undefined : { y: [0, -4, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Send className="size-6 rtl:-scale-x-100" />
                </motion.div>
                <p className="eyebrow mt-8">{d.eyebrow}</p>
                <h2 className="mt-3 font-display text-4xl text-ink sm:text-5xl">{d.sending.title}</h2>
                <p className="mt-6 font-display text-6xl leading-none text-ink lining-nums tabular-nums sm:text-7xl" aria-live="polite">
                  {fmt(d.sending.progress, { done: n(processed), total: n(batch.total) })}
                </p>
                <div className="mx-auto mt-8 max-w-lg">
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-mist"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={batch.total}
                    aria-valuenow={processed}
                  >
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-bronze-500 to-bronze-700 transition-[width] duration-700 ease-luxe rtl:bg-gradient-to-l"
                      style={{ width: `${batch.total ? Math.max(3, (processed / batch.total) * 100) : 0}%` }}
                    >
                      <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.35),transparent)] bg-[length:200%_100%]" />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[13px] text-ink-soft">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-sage" />
                      {fmt(d.sending.sent, { n: n(batch.sent) })}
                    </span>
                    {batch.failed ? (
                      <span className="flex items-center gap-1.5 text-rosewood">
                        <span className="size-1.5 rounded-full bg-rosewood" />
                        {fmt(d.sending.failed, { n: n(batch.failed) })}
                      </span>
                    ) : null}
                    {batch.skipped ? (
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-ink-faint" />
                        {fmt(d.sending.skipped, { n: n(batch.skipped) })}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-8 text-[13px] text-ink-faint">{d.sending.leave}</p>
                <Button variant="ghost" size="sm" className="mt-3" icon={<PauseCircle className="size-4" />} onClick={() => setStopConfirm(true)}>
                  {d.sending.stop}
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : phase === "done" ? (
          <motion.div key="done" {...fade}>
            <Card className="px-6 py-12 text-center sm:px-14 sm:py-16">
              <motion.div
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className={cn(
                  "mx-auto flex size-16 items-center justify-center rounded-full",
                  batch?.status === "CANCELLED" ? "bg-sand text-ink-soft" : "bg-sage-soft text-sage",
                )}
              >
                {batch?.status === "CANCELLED" ? <PauseCircle className="size-7" /> : <CheckCircle2 className="size-7" />}
              </motion.div>
              <h2 className="mt-7 font-display text-4xl text-ink sm:text-5xl">{batch?.status === "CANCELLED" ? d.done.cancelled : d.done.title}</h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-soft">{d.done.body}</p>
              {batch ? (
                <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[13px] text-ink-soft">
                  <span>{fmt(d.sending.sent, { n: n(batch.sent) })}</span>
                  {batch.skipped ? <span>{fmt(d.sending.skipped, { n: n(batch.skipped) })}</span> : null}
                </div>
              ) : null}
              {batch?.failed ? (
                <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-2 rounded-2xl border border-rosewood/20 bg-rosewood-soft/60 px-5 py-4 text-sm">
                  <p className="flex items-center gap-2 font-medium text-rosewood">
                    <CircleAlert className="size-4" />
                    {plural(locale, d.done.failed, batch.failed)}
                  </p>
                  <Link href={`${stepHref(eventId, "guests")}?status=FAILED`} className="font-medium text-ink underline-offset-4 hover:underline">
                    {d.done.reviewFailed}
                  </Link>
                </div>
              ) : null}
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href={stepHref(eventId, "overview")} className={buttonClasses("primary", "lg")}>
                  {d.done.overview}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
                <Link href={stepHref(eventId, "guests")} className={buttonClasses("outline", "lg")}>
                  {d.done.guests}
                </Link>
              </div>
            </Card>
          </motion.div>
        ) : phase === "nothing" ? (
          <motion.div key="nothing" {...fade}>
            <Card className="px-6 py-12 text-center sm:px-14 sm:py-16">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-sage-soft text-sage">
                <CheckCircle2 className="size-7" />
              </div>
              <h2 className="mt-7 font-display text-4xl text-ink">{failedCount > 0 ? d.nothing.titleSent : d.nothing.title}</h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-soft">{d.nothing.body}</p>
              {failedCount > 0 ? (
                <div className="mx-auto mt-7 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-rosewood/20 bg-rosewood-soft/60 px-5 py-4 text-sm">
                  <p className="flex items-center gap-2 font-medium text-rosewood">
                    <CircleAlert className="size-4" />
                    {plural(locale, d.nothing.failed, failedCount)}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="primary" size="sm" loading={busy === "resend"} onClick={resendFailed}>
                      {d.nothing.resendFailed}
                    </Button>
                    <Link href={`${stepHref(eventId, "guests")}?status=FAILED`} className={buttonClasses("ghost", "sm")}>
                      {d.done.reviewFailed}
                    </Link>
                  </div>
                </div>
              ) : null}
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href={stepHref(eventId, "overview")} className={buttonClasses("primary", "lg")}>
                  {d.nothing.overview}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
                <Link href={stepHref(eventId, "guests")} className={buttonClasses("outline", "lg")}>
                  {d.nothing.addGuests}
                </Link>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="notReady" {...fade}>
            <Card className="px-6 py-12 text-center sm:px-14 sm:py-16">
              <p className="eyebrow">{d.eyebrow}</p>
              <h2 className="mt-4 font-display text-4xl text-ink">{d.notReady.title}</h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-soft">{d.notReady.body}</p>
              <Link href={stepHref(eventId, "review")} className={buttonClasses("primary", "lg", "mt-8")}>
                {d.notReady.cta}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={confirm}
        onClose={() => busy !== "send" && setConfirm(false)}
        title={plural(locale, d.ready.confirmTitle, unsent)}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy === "send"}>
              {dict.common.actions.cancel}
            </Button>
            <Button variant="accent" loading={busy === "send"} onClick={start}>
              {d.ready.confirm}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{d.ready.confirmBody}</p>
      </Dialog>

      <Dialog
        open={stopConfirm}
        onClose={() => busy !== "stop" && setStopConfirm(false)}
        title={d.sending.stopTitle}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStopConfirm(false)} disabled={busy === "stop"}>
              {d.sending.keep}
            </Button>
            <Button variant="danger" loading={busy === "stop"} onClick={stop}>
              {d.sending.stopConfirm}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft">{d.sending.stopBody}</p>
      </Dialog>
    </div>
  );
}
