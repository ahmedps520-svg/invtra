"use client";

import { useState } from "react";
import { Calendar, CalendarPlus, Clock, DoorOpen, ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getTheme } from "@/lib/themes/registry";
import { cn } from "@/lib/utils";
import { Divider, Label, Reveal, SectionHeading, Txt, useInvitation } from "./primitives";
import s from "./invitation.module.css";

/** Wraps a section according to the theme's section style (lines / cards / panels). */
export function Block({ children, id, className }: { children: React.ReactNode; id?: string; className?: string }) {
  const { vm } = useInvitation();
  const style = getTheme(vm.themeKey).page.sectionStyle;
  if (style === "cards") {
    return (
      <div id={id} className={cn("px-4 py-6 sm:px-6", className)}>
        <div className={cn(s.card, "mx-auto max-w-2xl px-6 py-12 sm:px-12")}>{children}</div>
      </div>
    );
  }
  if (style === "panels") {
    return (
      <div id={id} className={cn(s.panel, "my-10 px-6 py-16", className)}>
        <div className="mx-auto max-w-2xl">{children}</div>
      </div>
    );
  }
  return (
    <div id={id} className={cn("px-6 py-14", className)}>
      <div className="mx-auto max-w-2xl">{children}</div>
      <Divider className="mt-14 opacity-70" />
    </div>
  );
}

export function Details({ status }: { status?: "PENDING" | "ACCEPTED" | "DECLINED" }) {
  const { vm, d } = useInvitation();
  const section = vm.section;
  const [showMap, setShowMap] = useState(false);
  const e = vm.event;
  const item = (icon: React.ReactNode, label: (x: typeof d) => string, en: string, ar?: string | null) => (
    <Reveal className="flex flex-col items-center text-center">
      <span className={cn("mb-3 flex size-11 items-center justify-center rounded-full border", s.accent)} style={{ borderColor: "var(--inv-line)" }}>
        {icon}
      </span>
      <Label pick={label} className={cn(s.eyebrow, "mb-2 block !text-[0.62rem]")} />
      <Txt en={en} ar={ar} as="p" className="text-lg leading-snug" />
    </Reveal>
  );
  return (
    <section>
      <SectionHeading label={(x) => x.details.title} />
      <div className="grid gap-10 sm:grid-cols-3 sm:gap-6">
        {item(<Calendar className="size-4" />, (x) => x.details.date, e.date.en, e.date.ar)}
        {item(<Clock className="size-4" />, (x) => x.details.time, e.time.en, e.time.ar)}
        {item(<MapPin className="size-4" />, (x) => x.details.venue, e.venueName, e.venueNameAr)}
      </div>
      <Reveal className="mt-10 text-center">
        <Txt en={e.address} ar={e.addressAr} as="p" className={cn(s.muted, "text-sm")} />
        {section && (section.note || section.noteAr) ? (
          <p className="mx-auto mt-4 flex max-w-md items-start justify-center gap-2 text-sm">
            <DoorOpen className={cn("mt-0.5 size-4 shrink-0", s.accent)} aria-hidden="true" />
            <Txt en={section.note ?? section.noteAr} ar={section.noteAr ?? section.note} />
          </p>
        ) : null}
        {vm.design.sections.map ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href={e.mapsUrl} target="_blank" rel="noopener noreferrer" className={cn(s.button, s.primary)}>
              <MapPin className="size-4" />
              {d.details.openMaps}
              <ExternalLink className="size-3.5 opacity-70" />
            </a>
            <button type="button" className={cn(s.button, s.ghost)} onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
              {showMap ? d.details.hideMap : d.details.showMap}
            </button>
          </div>
        ) : null}
        {e.googleCalendarUrl && vm.token && !e.past && status !== "DECLINED" ? <AddToCalendar google={e.googleCalendarUrl} ics={`/i/${vm.token}/calendar`} /> : null}
        {showMap ? (
          <div className="mt-6 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--inv-line)" }}>
            <iframe
              title={e.venueName}
              src={e.mapsEmbedUrl}
              className="h-72 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        ) : null}
      </Reveal>
    </section>
  );
}

/** Apple Calendar (.ics, also Outlook) and Google Calendar, at the guest's own section time and place. */
function AddToCalendar({ google, ics }: { google: string; ics: string }) {
  const { d } = useInvitation();
  return (
    <div className="mt-8">
      <Label pick={(x) => x.calendar.title} className={cn(s.eyebrow, "mb-3 block !text-[0.62rem]")} />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href={ics} className={cn(s.button, s.ghost)} data-testid="calendar-apple">
          <CalendarPlus className="size-4" />
          {d.calendar.apple}
        </a>
        <a href={google} target="_blank" rel="noopener noreferrer" className={cn(s.button, s.ghost)} data-testid="calendar-google">
          <CalendarPlus className="size-4" />
          {d.calendar.google}
          <ExternalLink className="size-3.5 opacity-70" />
        </a>
      </div>
    </div>
  );
}

/** "Men's section" / "قسم النساء" under the guest's name. */
export function SectionBadge({ className }: { className?: string }) {
  const { vm } = useInvitation();
  if (!vm.section) return null;
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-sm", className)} style={{ borderColor: "var(--inv-line)" }}>
      <span className="size-1.5 rounded-full" style={{ background: "var(--inv-accent)" }} aria-hidden="true" />
      <Txt en={vm.section.label.en} ar={vm.section.label.ar} inline />
    </span>
  );
}

export function Schedule() {
  const { vm } = useInvitation();
  if (!vm.event.schedule.length) return null;
  return (
    <section>
      <SectionHeading label={(x) => x.schedule.title} />
      <ol className="relative mx-auto max-w-md">
        <span className="absolute inset-y-2 start-[5.25rem] w-px" style={{ background: "var(--inv-line)" }} aria-hidden="true" />
        {vm.event.schedule.map((item, i) => (
          <Reveal key={i} delay={i * 0.08} className="relative flex gap-6 py-4">
            <Txt en={item.time.en} ar={item.time.ar} as="span" className={cn(s.accent, "w-[4.5rem] shrink-0 pt-0.5 text-end text-sm font-medium tabular-nums")} inline />
            <span className="absolute start-[5.25rem] top-6 size-2.5 -translate-x-1/2 rounded-full rtl:translate-x-1/2" style={{ background: "var(--inv-accent)", boxShadow: "0 0 0 4px var(--inv-bg)" }} aria-hidden="true" />
            <div className="ps-4">
              <Txt en={item.title} ar={item.titleAr} as="p" className={cn(s.display, "text-2xl")} />
              {item.description ? <p className={cn(s.muted, "mt-1 text-sm")}>{item.description}</p> : null}
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

export function Info() {
  const { vm } = useInvitation();
  const e = vm.event;
  const rows = [
    { key: "dress", label: (x: typeof vm.dict.en) => x.info.dressCode, en: e.dressCode, ar: e.dressCodeAr },
    { key: "parking", label: (x: typeof vm.dict.en) => x.info.parking, en: e.parkingInfo, ar: null },
    { key: "stay", label: (x: typeof vm.dict.en) => x.info.accommodation, en: e.accommodationInfo, ar: null },
    { key: "note", label: (x: typeof vm.dict.en) => x.info.instructions, en: e.specialInstructions, ar: null },
    { key: "hosts", label: (x: typeof vm.dict.en) => x.info.notes, en: e.notes, ar: e.notesAr },
  ].filter((r) => r.en || r.ar);
  if (!rows.length) return null;
  return (
    <section>
      <SectionHeading label={(x) => x.info.title} />
      <dl className="grid gap-8 sm:grid-cols-2">
        {rows.map((r, i) => (
          <Reveal key={r.key} delay={i * 0.06} className={cn("text-center sm:text-start", rows.length % 2 === 1 && i === rows.length - 1 && "sm:col-span-2 sm:text-center")}>
            <dt>
              <Label pick={r.label} className={cn(s.eyebrow, "!text-[0.62rem]")} />
            </dt>
            <dd className="mt-2 whitespace-pre-line leading-relaxed">
              <Txt en={r.en ?? r.ar} ar={r.ar ?? r.en} />
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}

export function Contact() {
  const { vm, d } = useInvitation();
  const e = vm.event;
  if (!e.contactPhone && !e.contactEmail) return null;
  const digits = e.contactPhone?.replace(/[^\d]/g, "");
  return (
    <section className="text-center">
      <SectionHeading label={(x) => x.contact.title} />
      {e.contactName ? <p className={cn(s.display, "text-2xl")}>{e.contactName}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {e.contactPhone ? (
          <>
            <a className={cn(s.button, s.ghost)} href={`tel:${e.contactPhone.replace(/\s+/g, "")}`}>
              <Phone className="size-4" />
              {d.contact.call}
            </a>
            <a className={cn(s.button, s.ghost)} href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" />
              {d.contact.whatsapp}
            </a>
          </>
        ) : null}
        {e.contactEmail ? (
          <a className={cn(s.button, s.ghost)} href={`mailto:${e.contactEmail}`}>
            <Mail className="size-4" />
            {d.contact.email}
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function Closing() {
  const { vm } = useInvitation();
  return (
    <Reveal className="px-6 py-20 text-center">
      <Txt en={vm.copy.en.closing} ar={vm.copy.ar.closing} as="p" className={cn(s.display, "mx-auto max-w-lg text-3xl italic leading-snug")} />
      <Txt en={vm.event.hostNames} ar={vm.event.hostNamesAr} as="p" className={cn(s.eyebrow, "mt-6 block")} inline />
    </Reveal>
  );
}
