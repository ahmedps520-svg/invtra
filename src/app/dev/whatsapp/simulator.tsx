"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Clock, FlaskConical, MessageCircle, SendHorizontal, Smartphone, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { Bubble, ChatFrame, ChatNote } from "@/components/dashboard/whatsapp-preview";
import { api, ApiError } from "@/lib/api-client";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

type Conversation = { phone: string; name: string; event: string; lastAt: string; isTest: boolean };
type SimButton = { type: "QUICK_REPLY" | "URL"; text: string; payload?: string; url?: string };
type SimMessage = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  purpose: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED";
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  body: string;
  footer: string | null;
  buttons: SimButton[];
  imageUrl: string | null;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

function Ticks({ status }: { status: SimMessage["status"] }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  const icon =
    status === "READ" ? (
      <CheckCheck className="size-3.5 text-[#53bdeb]" strokeWidth={2.5} />
    ) : status === "DELIVERED" ? (
      <CheckCheck className="size-3.5" strokeWidth={2.5} />
    ) : status === "SENT" ? (
      <Check className="size-3.5" strokeWidth={2.5} />
    ) : status === "FAILED" ? (
      <X className="size-3.5 text-rosewood" strokeWidth={2.5} />
    ) : status === "QUEUED" ? (
      <Clock className="size-3" />
    ) : null;
  return (
    <span className="inline-flex items-center" title={label} aria-label={label}>
      {icon}
    </span>
  );
}

/** Development WhatsApp simulator: each guest's phone, with working Accept / Decline buttons. */
export function WhatsAppSimulator({ initialPhone }: { initialPhone: string | null }) {
  const toast = useToast();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [phone, setPhone] = useState<string | null>(initialPhone);
  const [messages, setMessages] = useState<SimMessage[] | null>(null);
  const [text, setText] = useState("");
  const [pressing, setPressing] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const loadList = useCallback(async () => {
    try {
      const r = await api<{ conversations: Conversation[] }>("/api/dev/whatsapp");
      setConversations(r.conversations);
    } catch {
      /* keep the last list */
    }
  }, []);

  const loadChat = useCallback(async (p: string) => {
    try {
      const r = await api<{ messages: SimMessage[] }>(`/api/dev/whatsapp?phone=${encodeURIComponent(p)}`);
      setMessages(r.messages);
    } catch {
      /* keep the last messages */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive || document.visibilityState !== "visible") return;
      loadList();
      if (phone) loadChat(phone);
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [phone, loadList, loadChat]);

  // Stick to the newest message when new ones arrive.
  useEffect(() => {
    const n = messages?.length ?? 0;
    if (n !== lastCount.current && scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: lastCount.current ? "smooth" : "auto" });
    lastCount.current = n;
  }, [messages]);

  function open(p: string) {
    setPhone(p);
    setMessages(null);
    lastCount.current = 0;
    const url = new URL(window.location.href);
    url.searchParams.set("phone", p);
    window.history.replaceState(window.history.state, "", url);
  }

  async function reply(body: { messageId: string; buttonIndex?: number; text?: string }) {
    setPressing(body.messageId + (body.buttonIndex ?? "t"));
    try {
      await api("/api/dev/whatsapp/reply", { method: "POST", body });
      if (phone) await loadChat(phone);
      setTimeout(() => phone && loadChat(phone), 900);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't send the reply.", "error");
    } finally {
      setPressing(null);
    }
  }

  const current = conversations?.find((c) => c.phone === phone) ?? null;
  const lastOutbound = [...(messages ?? [])].reverse().find((m) => m.direction === "OUTBOUND");

  return (
    <div className="flex min-h-dvh flex-col" dir="ltr" lang="en">
      <header className="border-b border-line bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" aria-label="INVTRA dashboard">
            <Logo markClassName="h-8" />
          </Link>
          <span className="hidden h-6 w-px bg-line sm:block" />
          <p className="hidden items-center gap-2 text-[13px] font-medium text-ink-soft sm:flex">
            <Smartphone className="size-4 text-bronze-600" />
            WhatsApp simulator
          </p>
          <Link href="/dashboard" className="ms-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition hover:text-ink">
            <ArrowLeft className="size-3.5" />
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="border-b border-ochre/20 bg-ochre-soft">
        <p className="mx-auto flex max-w-7xl items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-soft sm:px-6 lg:px-8">
          <FlaskConical className="size-4 shrink-0 text-ochre" />
          <span>
            <strong className="font-medium text-ink">Development simulator</strong> — no real WhatsApp messages are sent. Numbers ending in 9999 are rejected as invalid;
            ending in 0000 fail as “not on WhatsApp”.
          </span>
        </p>
      </div>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:px-8 lg:py-8">
        {/* Conversations */}
        <aside className={cn("min-w-0", phone && "hidden lg:block")}>
          <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
            <div className="border-b border-line px-5 py-4">
              <h1 className="font-display text-2xl text-ink">Guests&apos; phones</h1>
              <p className="mt-0.5 text-[13px] text-ink-faint">Everyone INVTRA has messaged for your events.</p>
            </div>
            {conversations === null ? (
              <div className="flex justify-center py-12 text-ink-faint">
                <Spinner />
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-ink-faint">
                <MessageCircle className="mx-auto mb-3 size-6 text-bronze-400" />
                No messages yet. Send invitations or a test from your event&apos;s Review step, then come back here.
              </div>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
                {conversations.map((c) => (
                  <li key={c.phone}>
                    <button
                      type="button"
                      onClick={() => open(c.phone)}
                      className={cn("flex w-full items-start gap-3 px-5 py-3.5 text-start transition hover:bg-ivory", c.phone === phone && "bg-bronze-50/70")}
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sand font-display text-[15px] text-bronze-700">
                        {[...c.name][0]?.toUpperCase() ?? "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink" dir="auto">
                            {c.name}
                          </span>
                          <span className="shrink-0 text-[11px] text-ink-faint">{time(c.lastAt)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-faint tabular-nums">{formatPhone(c.phone)}</span>
                        <span className="mt-1 flex items-center gap-1.5">
                          <span className="truncate text-xs text-ink-soft" dir="auto">
                            {c.event}
                          </span>
                          {c.isTest ? <Badge tone="bronze">Test</Badge> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Phone */}
        <section className={cn("min-w-0", !phone && "hidden lg:block")} aria-label="Phone">
          {!phone ? (
            <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-paper/50 px-6 text-center">
              <Smartphone className="size-8 text-bronze-400" />
              <p className="mt-4 font-display text-2xl text-ink">Choose a guest</p>
              <p className="mt-1 max-w-sm text-sm text-ink-faint">See exactly what arrives on their phone, and tap Accept or Decline as they would.</p>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-md">
              <button type="button" onClick={() => setPhone(null)} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-faint hover:text-ink lg:hidden">
                <ArrowLeft className="size-3.5" />
                All conversations
              </button>
              <div className="rounded-[2.6rem] border border-ink/10 bg-ink p-2.5 shadow-lift">
                <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-white/15" aria-hidden />
                <ChatFrame
                  title="INVTRA Invitations"
                  subtitle={current ? `To ${current.name} · ${formatPhone(current.phone)}` : formatPhone(phone)}
                  className="rounded-[2rem] border-0 shadow-none"
                  bodyClassName="h-[min(68vh,40rem)] overflow-y-auto overscroll-contain"
                  bodyRef={scroller}
                >
                    {messages === null ? (
                      <div className="flex justify-center py-12 text-[#667781]">
                        <Spinner />
                      </div>
                    ) : messages.length === 0 ? (
                      <ChatNote>No messages for this number yet.</ChatNote>
                    ) : (
                      messages.map((m, i) => {
                        const showDay = i === 0 || day(messages[i - 1].createdAt) !== day(m.createdAt);
                        const outbound = m.direction === "OUTBOUND";
                        return (
                          <div key={m.id} className="space-y-2.5">
                            {showDay ? <ChatNote>{day(m.createdAt)}</ChatNote> : null}
                            <Bubble
                              side={outbound ? "in" : "out"}
                              header={
                                m.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- dev-only, arbitrary media URL
                                  <img src={m.imageUrl} alt="Invitation image" className="block w-full rounded-lg" loading="lazy" />
                                ) : undefined
                              }
                              body={m.body || (outbound ? "" : "(reply)")}
                              footer={m.footer}
                              time={time(m.createdAt)}
                              status={outbound ? <Ticks status={m.status} /> : null}
                              error={m.status === "FAILED" ? `Not delivered${m.errorCode ? ` (${m.errorCode})` : ""}: ${m.errorMessage ?? "unknown error"}` : null}
                              buttons={m.buttons.map((b, bi) =>
                                b.type === "URL"
                                  ? { text: b.text, url: b.url ?? "#" }
                                  : {
                                      text: pressing === m.id + bi ? "…" : b.text,
                                      disabled: Boolean(pressing) || m.status === "FAILED",
                                      onClick: () => reply({ messageId: m.id, buttonIndex: bi }),
                                    },
                              )}
                            />
                          </div>
                        );
                      })
                    )}
                </ChatFrame>
                <form
                  className="mt-2.5 flex items-center gap-2 px-1 pb-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!text.trim() || !lastOutbound) return;
                    reply({ messageId: lastOutbound.id, text: text.trim() });
                    setText("");
                  }}
                >
                  <label htmlFor="sim-text" className="sr-only">
                    Reply as the guest
                  </label>
                  <input
                    id="sim-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={!lastOutbound}
                    placeholder={lastOutbound ? "Reply as the guest…" : "Nothing to reply to yet"}
                    className="h-11 min-w-0 flex-1 rounded-full bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#25d366]/50 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || !lastOutbound || Boolean(pressing)}
                    aria-label="Send reply"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-[#0b141a] transition hover:brightness-105 disabled:opacity-40"
                  >
                    <SendHorizontal className="size-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
