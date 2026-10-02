"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Baby, Briefcase, Cake, ChevronDown, Flower2, Gem, Gift, GraduationCap, Heart, HeartHandshake, MoonStar, PartyPopper, Sparkles } from "lucide-react";
import type { ZodIssue } from "zod";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import { fmt } from "@/lib/i18n/config";
import { COMMON_TIME_ZONES, zoneOffsetMs } from "@/lib/time";
import { getTheme, isThemeKey } from "@/lib/themes/registry";
import { CardPreview } from "@/components/invitation/card-preview";
import { eventInputSchema, type EventInput } from "@/lib/validation/event";
import { cn } from "@/lib/utils";
import { errorMessage, plural, themeName } from "./i18n";
import { ScheduleEditor, type ScheduleRow } from "./schedule-editor";

type Lang = "EN" | "AR" | "BILINGUAL";
type EventType = EventInput["type"];

const EVENT_TYPES: { value: EventType; icon: React.ReactNode }[] = [
  { value: "WEDDING", icon: <Heart /> },
  { value: "ENGAGEMENT", icon: <Gem /> },
  { value: "HENNA", icon: <Flower2 /> },
  { value: "NEWBORN", icon: <Baby /> },
  { value: "BABY_SHOWER", icon: <Gift /> },
  { value: "AQIQAH", icon: <Sparkles /> },
  { value: "BIRTHDAY", icon: <Cake /> },
  { value: "GRADUATION", icon: <GraduationCap /> },
  { value: "ANNIVERSARY", icon: <HeartHandshake /> },
  { value: "RAMADAN", icon: <MoonStar /> },
  { value: "CORPORATE", icon: <Briefcase /> },
  { value: "OTHER", icon: <PartyPopper /> },
];

const TZ_OPTIONS = COMMON_TIME_ZONES.map((tz) => {
  const city = tz === "UTC" ? "UTC" : tz.split("/").pop()!.replace(/_/g, " ");
  if (tz === "UTC") return { value: tz, label: "UTC" };
  const mins = Math.round(zoneOffsetMs(new Date(), tz) / 60000);
  const sign = mins >= 0 ? "+" : "−";
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return { value: tz, label: `${city} (GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""})` };
});

const TEXT_KEYS = [
  "title",
  "titleAr",
  "hostNames",
  "hostNamesAr",
  "date",
  "time",
  "endTime",
  "timezone",
  "venueName",
  "venueNameAr",
  "address",
  "addressAr",
  "mapsUrl",
  "dressCode",
  "dressCodeAr",
  "notes",
  "notesAr",
  "parkingInfo",
  "accommodationInfo",
  "specialInstructions",
  "contactName",
  "contactPhone",
  "contactEmail",
  "rsvpDeadline",
] as const;
type TextKey = (typeof TEXT_KEYS)[number];

type FormState = Record<TextKey, string> & {
  type: EventType;
  language: Lang;
  allowWebRsvp: boolean;
  schedule: ScheduleRow[];
};

const MORE_KEYS: TextKey[] = [
  "dressCode",
  "dressCodeAr",
  "notes",
  "notesAr",
  "parkingInfo",
  "accommodationInfo",
  "specialInstructions",
  "contactName",
  "contactPhone",
  "contactEmail",
];

function fromInput(input?: EventInput | null): FormState {
  const s = {} as Record<TextKey, string>;
  for (const k of TEXT_KEYS) s[k] = ((input?.[k as keyof EventInput] as string | null | undefined) ?? "").toString();
  if (!input) s.time = "19:00";
  const language = (input?.language ?? "EN") as Lang;
  if (language === "AR") {
    // Arabic-only events edit the Arabic fields; fall back to the primary values.
    s.titleAr ||= s.title;
    s.hostNamesAr ||= s.hostNames;
    s.venueNameAr ||= s.venueName;
    s.addressAr ||= s.address;
    s.dressCodeAr ||= s.dressCode;
    s.notesAr ||= s.notes;
  }
  return {
    ...s,
    type: input?.type ?? "WEDDING",
    language,
    allowWebRsvp: input?.allowWebRsvp ?? true,
    schedule: (input?.schedule ?? []).map((r, i) => ({
      key: `init-${i}`,
      time: r.time,
      title: r.title ?? "",
      titleAr: r.titleAr ?? (language === "AR" ? r.title : "") ?? "",
      description: r.description ?? "",
    })),
  };
}

/** Form values → API payload. Arabic-only events mirror the Arabic text into the primary fields. */
function toPayload(f: FormState, tz: string) {
  const ar = f.language === "AR";
  const t = (v: string) => v.trim();
  const opt = (v: string) => t(v) || null;
  const mirror = (primary: string, arabic: string) => (ar ? t(arabic) || t(primary) : t(primary));
  return {
    type: f.type,
    language: f.language,
    title: mirror(f.title, f.titleAr),
    titleAr: opt(f.titleAr),
    hostNames: mirror(f.hostNames, f.hostNamesAr),
    hostNamesAr: opt(f.hostNamesAr),
    date: f.date,
    time: f.time,
    endTime: f.endTime || "",
    timezone: f.timezone || tz,
    venueName: mirror(f.venueName, f.venueNameAr),
    venueNameAr: opt(f.venueNameAr),
    address: mirror(f.address, f.addressAr),
    addressAr: opt(f.addressAr),
    mapsUrl: opt(f.mapsUrl),
    dressCode: ar ? opt(f.dressCodeAr) ?? opt(f.dressCode) : opt(f.dressCode),
    dressCodeAr: opt(f.dressCodeAr),
    notes: ar ? opt(f.notesAr) ?? opt(f.notes) : opt(f.notes),
    notesAr: opt(f.notesAr),
    parkingInfo: opt(f.parkingInfo),
    accommodationInfo: opt(f.accommodationInfo),
    specialInstructions: opt(f.specialInstructions),
    contactName: opt(f.contactName),
    contactPhone: opt(f.contactPhone),
    contactEmail: opt(f.contactEmail),
    rsvpDeadline: f.rsvpDeadline || "",
    allowWebRsvp: f.allowWebRsvp,
    schedule: f.schedule.map((r) => ({
      time: r.time,
      title: ar ? t(r.titleAr) || t(r.title) : t(r.title),
      titleAr: opt(r.titleAr),
      description: opt(r.description),
    })),
  };
}

const subscribeNoop = () => () => {};
function useBrowserTimeZone(): string | null {
  return useSyncExternalStore(
    subscribeNoop,
    () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return COMMON_TIME_ZONES.includes(tz) ? tz : "Asia/Dubai";
      } catch {
        return "Asia/Dubai";
      }
    },
    () => null,
  );
}

export function EventForm({
  mode,
  eventId,
  initial,
  themeKey,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initial?: EventInput | null;
  /** Design preselected on the marketing site (/dashboard/events/new?theme=…). */
  themeKey?: string | null;
}) {
  const { dict, locale } = useI18n();
  const d = dict.dashboard.form;
  const router = useRouter();
  const toast = useToast();
  const browserTz = useBrowserTimeZone();

  const [form, setForm] = useState<FormState>(() => {
    const f = fromInput(initial);
    // A design chosen on the marketing site suggests its language.
    if (!initial && themeKey && isThemeKey(themeKey)) f.language = getTheme(themeKey).recommendedLanguage;
    return f;
  });
  const [baseline, setBaseline] = useState(() => JSON.stringify(fromInput(initial)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(() => MORE_KEYS.some((k) => Boolean(fromInput(initial)[k])));
  const [stale, setStale] = useState(0);
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const tz = form.timezone || browserTz || "Asia/Dubai";
  const dirty = useMemo(() => JSON.stringify(form) !== baseline, [form, baseline]);
  const lang = form.language;
  const showAr = lang === "AR" || lang === "BILINGUAL";
  const bi = lang === "BILINGUAL";
  const arOnly = lang === "AR";

  useEffect(() => {
    if (!dirty || leaving) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, leaving]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  const localize = useCallback(
    (key: string, issue?: Pick<ZodIssue, "code" | "message">): string => {
      const e = d.errors;
      if (issue?.code === "too_big") return e.tooLong;
      if (key.startsWith("schedule.")) return key.endsWith(".time") ? e.scheduleTime : key.endsWith(".title") ? e.scheduleTitle : e.generic;
      const known: Record<string, string> = {
        title: e.title,
        hostNames: e.hostNames,
        venueName: e.venueName,
        address: e.address,
        date: e.date,
        time: e.time,
        endTime: e.endTime,
        timezone: e.timezone,
        mapsUrl: e.mapsUrl,
        contactEmail: e.contactEmail,
        rsvpDeadline: e.rsvpDeadline,
      };
      return known[key] ?? (locale === "en" && issue?.message ? issue.message : e.generic);
    },
    [d.errors, locale],
  );

  const err = (key: string) => errors[key] ?? undefined;
  // Arabic-only events show their primary-field errors on the Arabic inputs.
  const errAr = (arKey: string, primary: string) => errors[arKey] ?? (arOnly ? errors[primary] : undefined);

  function focusFirstError() {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = toPayload(form, tz);
    const parsed = eventInputSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!next[key]) next[key] = localize(key, issue);
      }
      setErrors(next);
      toast(d.errors.invalid, "error");
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await api<{ event: { id: string } }>("/api/events", {
          method: "POST",
          body: themeKey && isThemeKey(themeKey) ? { ...payload, themeKey } : payload,
        });
        setLeaving(true);
        router.push(`/dashboard/events/${res.event.id}/design`);
        return;
      }
      const res = await api<{ cardChanged: boolean; staleAccepted: number }>(`/api/events/${eventId}`, { method: "PATCH", body: payload });
      const saved = { ...form, timezone: payload.timezone };
      setForm(saved);
      setBaseline(JSON.stringify(saved));
      toast(d.saved);
      router.refresh();
      if (res.staleAccepted > 0) setStale(res.staleAccepted);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(error.fields)) next[k] = localize(k, { code: "custom", message: v });
        setErrors(next);
        toast(d.errors.invalid, "error");
        focusFirstError();
      } else {
        toast(errorMessage(error, dict), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function sendUpdate() {
    setSendingUpdate(true);
    try {
      const res = await api<{ count: number }>(`/api/events/${eventId}/send-update`, { method: "POST", body: {} });
      toast(plural(locale, d.update.sent, res.count));
      setStale(0);
      router.refresh();
    } catch (error) {
      toast(errorMessage(error, dict), "error");
    } finally {
      setSendingUpdate(false);
    }
  }

  const f = { ...d.fields, ...d.fields.byType[form.type] };
  const input = (key: TextKey, props: React.InputHTMLAttributes<HTMLInputElement> & { error?: string } = {}) => {
    const { error, ...rest } = props;
    const e = error ?? err(key);
    return (
      <Input
        id={`ev-${key}`}
        value={form[key]}
        onChange={(ev) => set(key, ev.target.value)}
        aria-invalid={Boolean(e)}
        aria-describedby={e ? `ev-${key}-error` : undefined}
        dir="auto"
        {...rest}
      />
    );
  };
  const arInput = (key: TextKey, primary: TextKey, placeholder: string) => (
    <Input
      id={`ev-${key}`}
      value={form[key]}
      onChange={(ev) => set(key, ev.target.value)}
      aria-invalid={Boolean(errAr(key, primary))}
      dir="rtl"
      lang="ar"
      placeholder={placeholder}
    />
  );

  /** Primary + Arabic pair, laid out by invitation language. */
  const pair = (
    primary: TextKey,
    arabic: TextKey,
    labels: { single: string; en: string; ar: string },
    ph: { en: string; ar: string },
    opts: { optional?: boolean; hint?: string } = {},
  ) => {
    const optional = opts.optional ? d.optional : undefined;
    if (arOnly)
      return (
        <Field id={`ev-${arabic}`} label={labels.single} optional={optional} error={errAr(arabic, primary)} hint={opts.hint}>
          {arInput(arabic, primary, ph.ar)}
        </Field>
      );
    if (!showAr)
      return (
        <Field id={`ev-${primary}`} label={labels.single} optional={optional} error={err(primary)} hint={opts.hint}>
          {input(primary, { placeholder: ph.en })}
        </Field>
      );
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`ev-${primary}`} label={labels.en} optional={optional} error={err(primary)} hint={opts.hint}>
          {input(primary, { placeholder: ph.en, dir: "ltr" })}
        </Field>
        <Field id={`ev-${arabic}`} label={labels.ar} optional={optional} error={err(arabic)}>
          {arInput(arabic, primary, ph.ar)}
        </Field>
      </div>
    );
  };

  return (
    <form onSubmit={submit} noValidate className="animate-fade-up">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow">{mode === "create" ? d.createEyebrow : d.editEyebrow}</p>
          <h2 className="mt-3 font-display text-3xl text-ink sm:text-4xl">{mode === "create" ? d.createTitle : d.editTitle}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{mode === "create" ? d.createIntro : d.editIntro}</p>
        </div>
        {mode === "create" && themeKey && isThemeKey(themeKey) ? (
          <div className="flex max-w-sm items-center gap-4 rounded-2xl border border-bronze-200 bg-bronze-50/70 p-3 pe-5">
            <CardPreview
              themeKey={themeKey}
              language={form.language}
              qrPlaceholder={false}
              guest={null}
              className="w-14 shrink-0 rounded-[2px] shadow-soft ring-1 ring-ink/5"
              title={themeName(dict, themeKey)}
            />
            <div className="min-w-0">
              <p className="font-display text-lg text-ink">{fmt(d.chosenDesign, { name: themeName(dict, themeKey) })}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">{d.chosenDesignHint}</p>
            </div>
          </div>
        ) : null}
      </div>

      <Card className="px-5 py-8 sm:px-10 sm:py-10">
        {/* The occasion */}
        <Section title={d.sections.occasion.title} description={d.sections.occasion.description}>
          <fieldset>
            <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">{f.type}</legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup">
              {EVENT_TYPES.map((t) => {
                const active = form.type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("type", t.value)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-start text-sm transition-all duration-300 ease-luxe [&>svg]:size-4 [&>svg]:shrink-0",
                      active
                        ? "border-bronze-400 bg-bronze-50 text-ink shadow-soft [&>svg]:text-bronze-600"
                        : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink [&>svg]:text-ink-faint",
                    )}
                  >
                    {t.icon}
                    {dict.common.eventTypes[t.value]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-[13px] font-medium text-ink-soft">{f.language}</legend>
            <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup">
              {(["EN", "AR", "BILINGUAL"] as Lang[]).map((l) => {
                const active = form.language === l;
                return (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("language", l)}
                    className={cn(
                      "relative flex flex-col items-start justify-start rounded-xl border px-4 py-3.5 text-start transition-all duration-300 ease-luxe",
                      active ? "border-bronze-400 bg-bronze-50 shadow-soft" : "border-line bg-paper hover:border-line-strong",
                    )}
                  >
                    <span className="block font-display text-lg text-ink">{f.languages[l].title}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-faint">{f.languages[l].body}</span>
                    <span
                      className={cn(
                        "absolute end-3 top-3 size-2 rounded-full transition",
                        active ? "bg-bronze-600" : "bg-transparent ring-1 ring-line-strong",
                      )}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-[13px] text-ink-faint">{f.languageHint}</p>
          </fieldset>

          {pair("title", "titleAr", { single: arOnly ? f.title : f.title, en: f.titleEn, ar: f.titleAr }, { en: f.titlePh, ar: f.titleArPh })}
          {pair(
            "hostNames",
            "hostNamesAr",
            { single: f.hostNames, en: f.hostNamesEn, ar: f.hostNamesAr },
            { en: f.hostNamesPh, ar: f.hostNamesArPh },
            { hint: f.hostNamesHint },
          )}
        </Section>

        {/* Date & time */}
        <Section title={d.sections.when.title} description={d.sections.when.description}>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="ev-date" label={f.date} error={err("date")}>
              {input("date", { type: "date", dir: "ltr" })}
            </Field>
            <Field id="ev-time" label={f.time} error={err("time")}>
              {input("time", { type: "time", dir: "ltr" })}
            </Field>
            <Field id="ev-endTime" label={f.endTime} optional={d.optional} error={err("endTime")}>
              {input("endTime", { type: "time", dir: "ltr" })}
            </Field>
          </div>
          <Field id="ev-timezone" label={f.timezone} hint={f.timezoneHint} error={err("timezone")}>
            <Select id="ev-timezone" value={tz} onChange={(e) => set("timezone", e.target.value)} dir="ltr">
              {TZ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        {/* Venue */}
        <Section title={d.sections.where.title} description={d.sections.where.description}>
          {pair("venueName", "venueNameAr", { single: f.venueName, en: f.venueNameEn, ar: f.venueNameAr }, { en: f.venuePh, ar: f.venueArPh })}
          {pair("address", "addressAr", { single: f.address, en: f.addressEn, ar: f.addressAr }, { en: f.addressPh, ar: f.addressArPh })}
          <Field id="ev-mapsUrl" label={f.mapsUrl} optional={d.optional} error={err("mapsUrl")}>
            {input("mapsUrl", { type: "url", inputMode: "url", dir: "ltr", placeholder: f.mapsUrlPh })}
          </Field>
          <details className="group -mt-2 text-[13px]">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-medium text-bronze-700 hover:text-bronze-900 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              {f.mapsHow}
            </summary>
            <p className="mt-2 max-w-lg rounded-xl bg-sand/70 px-4 py-3 leading-relaxed text-ink-soft">{f.mapsSteps}</p>
          </details>
        </Section>

        {/* Programme */}
        <Section title={d.sections.schedule.title} description={d.sections.schedule.description}>
          <ScheduleEditor
            rows={form.schedule}
            onChange={(rows) => set("schedule", rows)}
            language={lang}
            startTime={form.time}
            errors={errors}
          />
        </Section>

        {/* Replies */}
        <Section title={d.sections.replies.title} description={d.sections.replies.description}>
          <div className="rounded-2xl border border-line bg-ivory/50 px-4 py-4">
            <Switch id="ev-allowWebRsvp" checked={form.allowWebRsvp} onChange={(v) => set("allowWebRsvp", v)} label={f.allowWebRsvp} description={f.allowWebRsvpHint} />
          </div>
          <Field id="ev-rsvpDeadline" label={f.rsvpDeadline} optional={d.optional} hint={f.rsvpDeadlineHint} error={err("rsvpDeadline")}>
            {input("rsvpDeadline", { type: "date", dir: "ltr", className: "sm:max-w-xs" })}
          </Field>
        </Section>

        {/* More details (progressive disclosure) */}
        <Section title={d.sections.more.title} description={d.sections.more.description}>
          <button
            type="button"
            aria-expanded={showMore}
            aria-controls="ev-more"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:border-bronze-400"
          >
            <ChevronDown className={cn("size-4 transition-transform duration-300", showMore && "rotate-180")} />
            {showMore ? d.hideMore : d.showMore}
          </button>
          <AnimatePresence initial={false}>
            {showMore ? (
              <motion.div
                id="ev-more"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-5 pt-1">
                  {pair("dressCode", "dressCodeAr", { single: f.dressCode, en: f.dressCode, ar: f.dressCodeAr }, { en: f.dressCodePh, ar: f.dressCodeArPh }, { optional: true })}
                  {arOnly ? (
                    <Field id="ev-notesAr" label={f.notes} optional={d.optional} error={err("notesAr")}>
                      <Textarea id="ev-notesAr" dir="rtl" lang="ar" value={form.notesAr} placeholder={f.notesArPh} onChange={(e) => set("notesAr", e.target.value)} />
                    </Field>
                  ) : (
                    <div className={cn("grid gap-5", bi && "sm:grid-cols-2")}>
                      <Field id="ev-notes" label={f.notes} optional={d.optional} error={err("notes")}>
                        <Textarea id="ev-notes" dir="auto" value={form.notes} placeholder={f.notesPh} onChange={(e) => set("notes", e.target.value)} />
                      </Field>
                      {bi ? (
                        <Field id="ev-notesAr" label={f.notesAr} optional={d.optional} error={err("notesAr")}>
                          <Textarea id="ev-notesAr" dir="rtl" lang="ar" value={form.notesAr} placeholder={f.notesArPh} onChange={(e) => set("notesAr", e.target.value)} />
                        </Field>
                      ) : null}
                    </div>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="ev-parkingInfo" label={f.parkingInfo} optional={d.optional} error={err("parkingInfo")}>
                      {input("parkingInfo", { placeholder: f.parkingPh })}
                    </Field>
                    <Field id="ev-accommodationInfo" label={f.accommodationInfo} optional={d.optional} error={err("accommodationInfo")}>
                      {input("accommodationInfo", { placeholder: f.accommodationPh })}
                    </Field>
                  </div>
                  <Field id="ev-specialInstructions" label={f.specialInstructions} optional={d.optional} error={err("specialInstructions")}>
                    {input("specialInstructions", { placeholder: f.specialPh })}
                  </Field>
                  <fieldset className="rounded-2xl border border-line px-4 pb-4 pt-3">
                    <legend className="px-1.5 text-[13px] font-medium text-ink-soft">
                      {f.contact} <span className="font-normal text-ink-faint">{d.optional}</span>
                    </legend>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field id="ev-contactName" label={f.contactName} error={err("contactName")}>
                        {input("contactName", { placeholder: f.contactNamePh, autoComplete: "off" })}
                      </Field>
                      <Field id="ev-contactPhone" label={f.contactPhone} error={err("contactPhone")}>
                        {input("contactPhone", { type: "tel", dir: "ltr", placeholder: f.contactPhonePh, autoComplete: "off" })}
                      </Field>
                      <Field id="ev-contactEmail" label={f.contactEmail} error={err("contactEmail")}>
                        {input("contactEmail", { type: "email", dir: "ltr", placeholder: f.contactEmailPh, autoComplete: "off" })}
                      </Field>
                    </div>
                  </fieldset>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Section>
      </Card>

      <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t border-line bg-ivory/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          <AnimatePresence>
            {mode === "edit" && dirty ? (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[13px] text-ink-faint">
                <span className="size-1.5 rounded-full bg-ochre" />
                {d.unsaved}
              </motion.span>
            ) : null}
          </AnimatePresence>
          <Button type="submit" size="lg" loading={saving} disabled={mode === "edit" && !dirty}>
            {saving ? (mode === "create" ? d.creating : d.saving) : mode === "create" ? d.create : d.save}
          </Button>
        </div>
      </div>

      <Dialog
        open={stale > 0}
        onClose={() => setStale(0)}
        title={d.update.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStale(0)}>
              {d.update.later}
            </Button>
            <Button variant="accent" loading={sendingUpdate} onClick={sendUpdate}>
              {d.update.send}
            </Button>
          </>
        }
      >
        <p className="text-[15px] leading-relaxed text-ink-soft">{plural(locale, d.update.body, stale)}</p>
      </Dialog>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-9 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-14">
      <div>
        <h3 className="font-display text-2xl text-ink">{title}</h3>
        {description ? <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">{description}</p> : null}
      </div>
      <div className="min-w-0 space-y-6">{children}</div>
    </section>
  );
}
