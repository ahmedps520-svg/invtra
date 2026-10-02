"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { InvitationDesign } from "@/lib/design/schema";
import { normalizeDesign } from "@/lib/design/schema";
import { getTheme, isThemeKey } from "@/lib/themes/registry";
import { copyFor } from "@/lib/invitation-copy";
import { fmt } from "@/lib/i18n/config";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import type { InvitationVM } from "./types";
import { InvitationProvider, Label, Reveal, Txt, themeVars, useInvitation, useNumber } from "./primitives";
import { Hero } from "./hero";
import { Countdown } from "./countdown";
import { Block, Closing, Contact, Details, Info, Schedule } from "./sections";
import { Gallery } from "./gallery";
import { EntryPass, Rsvp } from "./rsvp";
import { MusicToggle } from "./music";
import { HostBar } from "./host-bar";
import s from "./invitation.module.css";

type Status = "PENDING" | "ACCEPTED" | "DECLINED";

/**
 * The guest-facing invitation website. Used for real guests (/i/[token]), the host's
 * door check-in view, the editor's live preview (/preview/[eventId]) and public
 * design demos (/designs/[key]).
 */
export function InvitationExperience({ vm: initial, via, checkin }: { vm: InvitationVM; via?: "qr" | "link"; checkin?: boolean }) {
  const [vm, setVm] = useState(initial);
  useEffect(() => setVm(initial), [initial]);

  // Live preview: the design editor posts draft designs into this iframe.
  useEffect(() => {
    if (initial.mode !== "preview") return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; themeKey?: string; design?: InvitationDesign; imageMode?: "GENERATED" | "CUSTOM" };
      if (data?.type !== "invtra:preview") return;
      setVm((cur) => {
        const themeKey = isThemeKey(data.themeKey) ? data.themeKey : cur.themeKey;
        const design = data.design ? normalizeDesign(getTheme(themeKey).defaults, data.design) : cur.design;
        const t = design.texts;
        return {
          ...cur,
          themeKey,
          design,
          imageMode: data.imageMode ?? cur.imageMode,
          // Wording is edited live in the editor — recompute it here rather than waiting for a reload.
          copy: {
            en: copyFor(cur.event.type, "en", { eyebrow: t.eyebrow, intro: t.intro, closing: t.closing }),
            ar: copyFor(cur.event.type, "ar", { eyebrow: t.eyebrowAr, intro: t.introAr, closing: t.closingAr }),
          },
        };
      });
    };
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "invtra:preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [initial.mode]);

  // Record a view once the page is actually seen in a browser (link previews don't run JS).
  useEffect(() => {
    if (initial.mode !== "guest" || !initial.token) return;
    const key = `invtra:viewed:${initial.token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable — still record */
    }
    void fetch(`/api/i/${initial.token}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: via === "qr" ? "QR" : "LINK" }),
      keepalive: true,
    }).catch(() => undefined);
  }, [initial.mode, initial.token, via]);

  const style = useMemo(() => themeVars(vm.design), [vm.design]);
  const dir = vm.lang === "ar" ? "rtl" : "ltr";

  return (
    <InvitationProvider vm={vm}>
      <div className={s.root} style={style} dir={dir} lang={vm.lang === "ar" ? "ar" : "en"}>
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}"}</style>
        </noscript>
        {vm.event.backgroundUrl ? (
          <div className="pointer-events-none fixed inset-0" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vm.event.backgroundUrl} alt="" className="size-full object-cover" />
            <div className="absolute inset-0" style={{ background: "var(--inv-bg)", opacity: vm.design.background.overlay }} />
          </div>
        ) : null}
        <div className="relative">
          <Body checkin={checkin} />
        </div>
      </div>
    </InvitationProvider>
  );
}

function Body({ checkin }: { checkin?: boolean }) {
  const { vm } = useInvitation();
  const num = useNumber();
  const [status, setStatus] = useState<Status>(vm.guest?.rsvpStatus ?? "PENDING");
  const [attending, setAttending] = useState<number | null>(vm.guest?.attendingCount ?? null);
  useEffect(() => {
    setStatus(vm.guest?.rsvpStatus ?? "PENDING");
    setAttending(vm.guest?.attendingCount ?? null);
  }, [vm.guest?.rsvpStatus, vm.guest?.attendingCount]);
  const sec = vm.design.sections;
  const g = vm.guest;

  return (
    <>
      {vm.mode === "host" && g ? <HostBar status={status} highlight={checkin} /> : null}
      {vm.mode === "demo" || vm.mode === "preview" ? <ModeBanner /> : null}
      <Hero />

      {g ? (
        <Reveal className="px-6 pb-4 pt-12 text-center">
          <Txt
            en={fmt(vm.dict.en.forGuest, { name: g.name })}
            ar={fmt(vm.dict.ar.forGuest, { name: g.name })}
            as="p"
            className={cn(s.display, "text-2xl sm:text-3xl")}
          />
          <Txt
            en={g.allowedCount > 1 ? fmt(vm.dict.en.admits, { n: g.allowedCount }) : vm.dict.en.admitsOne}
            ar={g.allowedCount > 1 ? fmt(vm.dict.ar.admits, { n: num(g.allowedCount) }) : vm.dict.ar.admitsOne}
            as="p"
            className={cn(s.eyebrow, "mt-3 block")}
            inline
          />
        </Reveal>
      ) : null}

      {vm.event.past ? (
        <Reveal className="px-6 py-10 text-center">
          <Label pick={(x) => x.passed} className={cn(s.muted, "mx-auto block max-w-md")} inline={false} />
        </Reveal>
      ) : null}

      {sec.countdown && !vm.event.past ? (
        <Block>
          <Countdown />
        </Block>
      ) : null}

      <Block>
        <Details />
      </Block>

      {sec.schedule && vm.event.schedule.length ? (
        <Block>
          <Schedule />
        </Block>
      ) : null}

      {sec.details ? <InfoBlock /> : null}

      {sec.gallery && vm.event.gallery.length ? (
        <div className="mx-auto max-w-4xl px-4 py-14">
          <Gallery />
        </div>
      ) : null}

      {sec.rsvp && g ? (
        <div className="px-4 py-14">
          <Rsvp
            status={status}
            attending={attending}
            onChange={(next, n) => {
              setStatus(next);
              setAttending(n);
            }}
          />
        </div>
      ) : null}

      {g ? (
        <div className="px-4 pb-16 pt-4">
          <EntryPass status={status} />
        </div>
      ) : null}

      {sec.contact && (vm.event.contactPhone || vm.event.contactEmail) ? (
        <Block>
          <Contact />
        </Block>
      ) : null}

      <Closing />

      <footer className="px-6 pb-16 text-center">
        {vm.design.card.showBranding ? (
          <a href="https://invtra.store" className={cn(s.muted, "inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] opacity-70 transition hover:opacity-100")}>
            <LogoMark className="h-5 text-current" />
            <Label pick={(x) => x.footer} />
          </a>
        ) : null}
      </footer>

      {sec.music && vm.event.musicUrl ? <MusicToggle src={vm.event.musicUrl} /> : null}
    </>
  );
}

function InfoBlock() {
  const { vm } = useInvitation();
  const e = vm.event;
  if (!e.dressCode && !e.dressCodeAr && !e.parkingInfo && !e.accommodationInfo && !e.specialInstructions && !e.notes && !e.notesAr) return null;
  return (
    <Block>
      <Info />
    </Block>
  );
}

function ModeBanner() {
  const { vm, d } = useInvitation();
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[#1e1a16]/90 px-4 py-2 text-center text-xs text-[#faf7f2] backdrop-blur">
      {vm.mode === "demo" ? (
        <Link href="/designs" className="text-white/60 hover:text-white">
          ← INVTRA
        </Link>
      ) : null}
      <span>{vm.mode === "demo" ? d.demo.banner : d.preview.banner}</span>
      {vm.mode === "demo" ? (
        <Link href="/signup?next=/dashboard/events/new" className="font-medium text-[#c9b092] underline underline-offset-4">
          {d.demo.use}
        </Link>
      ) : null}
    </div>
  );
}
