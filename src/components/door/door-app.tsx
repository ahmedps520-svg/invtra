"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Camera, CameraOff, Check, ChevronRight, Loader2, Minus, Plus, ScanLine, Search, Undo2, X } from "lucide-react";
import { useI18n } from "@/components/i18n/provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { LogoMark } from "@/components/brand/logo";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { SECTION_LABELS, type SectionKey } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { DoorGuest, DoorSummary } from "@/server/door/service";

type Entrance = "ALL" | SectionKey;
type Sheet =
  | { kind: "guest"; guest: DoorGuest; fromScan: boolean; justCheckedIn?: boolean }
  | { kind: "error"; reason: "unknown" | "other_event" | "revoked" | "error"; fromScan: boolean }
  | null;
type CameraState = "off" | "starting" | "on" | "denied" | "unavailable";

const DOOR_COOKIE = "invtra_door";
const MEN = "#6f9fd0";
const WOMEN = "#d98aab";

async function call<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

/** The staff member's chosen entrance (all guests, or one section), remembered on this phone. */
function useEntrance(token: string): [Entrance, (e: Entrance) => void] {
  const key = `invtra:door:${token}:entrance`;
  const subscribe = useCallback(
    (cb: () => void) => {
      const on = (e: StorageEvent) => e.key === key && cb();
      window.addEventListener("storage", on);
      window.addEventListener("invtra:entrance", cb);
      return () => {
        window.removeEventListener("storage", on);
        window.removeEventListener("invtra:entrance", cb);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? "ALL";
      } catch {
        return "ALL";
      }
    },
    () => "ALL",
  );
  const set = (e: Entrance) => {
    try {
      localStorage.setItem(key, e);
    } catch {
      /* private mode — the choice lasts until reload */
    }
    window.dispatchEvent(new Event("invtra:entrance"));
  };
  return [(value === "MEN" || value === "WOMEN" ? value : "ALL") as Entrance, set];
}

export function DoorApp({
  token,
  initial,
  event,
  lookup,
}: {
  token: string;
  initial: DoorSummary;
  event: { title: string; when: string; sectionsEnabled: boolean };
  /** An invitation code to open straight away (a QR scanned with the phone's own camera). */
  lookup: string | null;
}) {
  const { dict, locale } = useI18n();
  const t = dict.door;
  const api = `/api/door/${token}`;
  const [summary, setSummary] = useState(initial);
  const [entrance, setEntrance] = useEntrance(token);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DoorGuest[] | null>(null);
  const [camera, setCamera] = useState<CameraState>("off");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pausedRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const n = (v: number) => formatNumber(v, locale);
  const clock = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  // Phones that scan with their own camera app land on /Q/… — this cookie sends them back here.
  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${DOOR_COOKIE}=${token}; Path=/Q; Max-Age=${3 * 86_400}; SameSite=Lax${secure}`;
  }, [token]);

  const refresh = useCallback(async () => {
    try {
      setSummary(await call<DoorSummary>(api));
    } catch {
      /* keep the last numbers */
    }
  }, [api]);

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && refresh(), 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const open = useCallback((guest: DoorGuest, fromScan: boolean) => {
    pausedRef.current = true;
    setCount(guest.checkedInCount ?? guest.attendingCount ?? guest.allowedCount);
    setSheet({ kind: "guest", guest, fromScan });
  }, []);

  const scan = useCallback(
    async (code: string, fromScan: boolean) => {
      pausedRef.current = true;
      try {
        const r = await call<{ ok: true; guest: DoorGuest } | { ok: false; reason: "unknown" | "other_event" | "revoked" }>(api, { method: "POST", body: { scan: code } });
        if (r.ok) open(r.guest, fromScan);
        else setSheet({ kind: "error", reason: r.reason, fromScan });
        if (fromScan) navigator.vibrate?.(r.ok ? 60 : [40, 60, 40]);
      } catch {
        setSheet({ kind: "error", reason: "error", fromScan });
      }
    },
    [api, open],
  );

  // Opened from a QR scanned with the camera app (/Q/… → /door/…?g=CODE).
  const looked = useRef(false);
  useEffect(() => {
    if (!lookup || looked.current) return;
    looked.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("g");
    window.history.replaceState(window.history.state, "", url);
    void scan(lookup, false);
  }, [lookup, scan]);

  // ── Camera scanning ──────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera((c) => (c === "on" || c === "starting" ? "off" : c));
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera("unavailable");
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      pausedRef.current = false;
      setCamera("on");
    } catch (e) {
      stopCamera();
      setCamera(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "unavailable");
    }
  }

  useEffect(() => {
    if (camera !== "on") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    type Detector = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
    let detector: Detector | null = null;
    let jsqr: ((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;

    async function setup() {
      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      try {
        if (BD && (await BD.getSupportedFormats?.())?.includes("qr_code")) detector = new BD({ formats: ["qr_code"] });
      } catch {
        detector = null;
      }
      if (!detector) jsqr = (await import("jsqr")).default;
    }

    async function frame() {
      if (stopped) return;
      const video = videoRef.current;
      if (video && !pausedRef.current && video.readyState >= 2 && video.videoWidth) {
        try {
          let text: string | null = null;
          if (detector) {
            text = (await detector.detect(video))[0]?.rawValue ?? null;
          } else if (jsqr && ctx) {
            const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsqr(img.data, img.width, img.height)?.data ?? null;
          }
          const now = Date.now();
          // The same code held in front of the camera is read once.
          if (text && !(text === lastRef.current.code && now - lastRef.current.at < 4000)) {
            lastRef.current = { code: text, at: now };
            void scan(text, true);
          }
        } catch {
          /* a bad frame — try the next one */
        }
      }
      timer = setTimeout(frame, detector ? 150 : 220);
    }

    void setup().then(frame);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [camera, scan]);

  // Release the camera when the phone locks or the tab is hidden, and on leaving.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && stopCamera();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stopCamera();
    };
  }, [stopCamera]);

  // ── Search ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`${api}?q=${encodeURIComponent(text)}`, { signal: ctrl.signal, cache: "no-store" });
        if (res.ok) setResults(((await res.json()) as { results: DoorGuest[] }).results);
      } catch {
        /* typing on — the next search replaces it */
      }
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, api]);

  async function openById(id: string) {
    try {
      open((await call<{ guest: DoorGuest }>(`${api}?guest=${encodeURIComponent(id)}`)).guest, false);
    } catch {
      setSheet({ kind: "error", reason: "error", fromScan: false });
    }
  }

  // ── Check in ─────────────────────────────────────────────────────────────
  async function checkIn(guest: DoorGuest, undo = false) {
    setBusy(true);
    try {
      const r = await call<{ guest: DoorGuest }>(api, { method: "POST", body: undo ? { guestId: guest.id, undo: true } : { guestId: guest.id, count } });
      setSheet((s) => (s?.kind === "guest" ? { ...s, guest: r.guest, justCheckedIn: !undo } : s));
      setResults((list) => list?.map((g) => (g.id === r.guest.id ? r.guest : g)) ?? list);
      if (!undo) navigator.vibrate?.(80);
      void refresh();
    } catch {
      setSheet((s) => (s ? { kind: "error", reason: "error", fromScan: s.fromScan } : s));
    } finally {
      setBusy(false);
    }
  }

  const closeSheet = useCallback(() => {
    setSheet(null);
    lastRef.current = { code: lastRef.current.code, at: Date.now() };
    pausedRef.current = false;
  }, []);

  const tally = entrance !== "ALL" && summary.sections ? summary.sections[entrance] : summary.total;
  const pct = tally.expected ? Math.min(100, Math.round((tally.arrived / tally.expected) * 100)) : 0;

  return (
    <div className="min-h-dvh bg-[#14110e] pb-16 text-[#f5efe6]">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#14110e]/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMark className="h-7 shrink-0 text-[#c9a27a]" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-tight">{event.title}</p>
              <p className="truncate text-[12px] text-white/50">{event.when}</p>
            </div>
          </div>
          <LanguageSwitcher locale={locale} compact className="text-white/70 hover:bg-white/10 hover:text-white" />
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 pt-5">
        {/* Arrivals */}
        <section aria-live="polite" className="rounded-3xl border border-white/[0.08] bg-white/[0.04] px-5 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">{t.arrived}</p>
              <p className="mt-1 font-display text-4xl leading-none lining-nums tabular-nums" data-testid="door-arrived">
                {n(tally.arrived)}
                <span className="ms-2 align-middle font-sans text-[14px] text-white/50">{fmt(t.ofExpected, { n: n(tally.expected) })}</span>
              </p>
            </div>
            <p className="text-end text-[12.5px] text-white/50">{fmt(t.guestsArrived, { n: n(tally.arrivedGuests), total: n(tally.accepted) })}</p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#c9a27a] transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          {event.sectionsEnabled ? (
            <div className="mt-4">
              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/50">{t.entrance}</p>
              <div role="radiogroup" aria-label={t.entrance} className="grid grid-cols-3 gap-1.5 rounded-full bg-white/[0.06] p-1">
                {(["ALL", "MEN", "WOMEN"] as Entrance[]).map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={entrance === e}
                    onClick={() => setEntrance(e)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium transition",
                      entrance === e ? "bg-[#f5efe6] text-[#14110e]" : "text-white/60 hover:text-white",
                    )}
                  >
                    {e !== "ALL" ? <span className="size-1.5 rounded-full" style={{ background: e === "MEN" ? MEN : WOMEN }} aria-hidden="true" /> : null}
                    {e === "ALL" ? t.entranceAll : SECTION_LABELS[e][locale]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Camera */}
        <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-black">
          <div className={cn("relative aspect-square w-full", camera === "on" || camera === "starting" ? "block" : "hidden")}>
            <video ref={videoRef} className="size-full object-cover" playsInline muted aria-label={t.aim} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <div className="relative size-[62%]">
                {["start-0 top-0 border-s-[3px] border-t-[3px] rounded-ss-2xl", "end-0 top-0 border-e-[3px] border-t-[3px] rounded-se-2xl", "start-0 bottom-0 border-s-[3px] border-b-[3px] rounded-es-2xl", "end-0 bottom-0 border-e-[3px] border-b-[3px] rounded-ee-2xl"].map((c) => (
                  <span key={c} className={cn("absolute size-10 border-[#c9a27a]", c)} />
                ))}
                {camera === "on" ? <span className="absolute inset-x-3 top-1/2 h-px animate-pulse bg-[#c9a27a]/70" /> : null}
              </div>
            </div>
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10 text-center text-[13px] text-white/80">
              {camera === "starting" ? t.starting : t.aim}
            </p>
            <button
              type="button"
              onClick={stopCamera}
              className="absolute end-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12.5px] text-white/90 backdrop-blur hover:bg-black/80"
            >
              <CameraOff className="size-3.5" />
              {t.stop}
            </button>
          </div>
          {camera === "on" || camera === "starting" ? null : (
            <div className="flex flex-col items-center px-6 py-8 text-center">
              <button
                type="button"
                onClick={startCamera}
                className="flex h-14 w-full max-w-xs items-center justify-center gap-2.5 rounded-full bg-[#c9a27a] text-[16px] font-semibold text-[#14110e] shadow-[0_18px_40px_-16px_rgba(201,162,122,0.7)] transition hover:bg-[#d6b48f]"
                data-testid="door-scan"
              >
                <ScanLine className="size-5" />
                {t.scan}
              </button>
              {camera === "denied" || camera === "unavailable" ? (
                <p className="mt-4 flex max-w-sm items-start gap-2 text-start text-[13px] leading-relaxed text-[#f3c98b]">
                  <Camera className="mt-0.5 size-4 shrink-0" />
                  {camera === "denied" ? t.cameraDenied : t.cameraUnavailable}
                </p>
              ) : null}
            </div>
          )}
        </section>

        {/* Search */}
        <section>
          <label htmlFor="door-search" className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-white/50">
            {t.searchLabel}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input
              id="door-search"
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.trim().length < 2) setResults(null);
              }}
              placeholder={t.searchPh}
              autoComplete="off"
              dir="auto"
              className="h-12 w-full rounded-full border border-white/10 bg-white/[0.06] pe-4 ps-11 text-[15px] text-white placeholder:text-white/35 focus:border-[#c9a27a]/60 focus:outline-none"
            />
          </div>
          {results ? (
            results.length ? (
              <ul className="mt-2 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                {results.map((g) => (
                  <li key={g.id}>
                    <GuestRowButton g={g} onClick={() => open(g, false)} clock={clock} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-center text-[13px] text-white/45">{t.noResults}</p>
            )
          ) : null}
        </section>

        {/* Latest arrivals */}
        <section>
          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/50">{t.recent}</p>
          {summary.recent.length ? (
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              {summary.recent.map((g) => (
                <li key={g.id}>
                  <GuestRowButton g={g} onClick={() => openById(g.id)} clock={clock} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-[13px] text-white/40">{t.noArrivals}</p>
          )}
        </section>
      </main>

      {sheet ? (
        <ResultSheet
          sheet={sheet}
          entrance={entrance}
          count={count}
          setCount={setCount}
          busy={busy}
          onCheckIn={(g) => checkIn(g)}
          onUndo={(g) => checkIn(g, true)}
          onClose={closeSheet}
          clock={clock}
        />
      ) : null}
    </div>
  );
}

function SectionTag({ section }: { section: SectionKey }) {
  const { locale } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={{ background: `${section === "MEN" ? MEN : WOMEN}22`, color: section === "MEN" ? MEN : WOMEN }}>
      <span className="size-1.5 rounded-full" style={{ background: section === "MEN" ? MEN : WOMEN }} aria-hidden="true" />
      {SECTION_LABELS[section][locale]}
    </span>
  );
}

function GuestRowButton({ g, onClick, clock }: { g: DoorGuest; onClick: () => void; clock: (iso: string) => string }) {
  const { dict, locale } = useI18n();
  const t = dict.door;
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-white/[0.04]">
      <span
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", g.checkedInAt ? "bg-[#7fb38f]/20 text-[#9fd3ae]" : "bg-white/[0.06] text-white/40")}
        aria-hidden="true"
      >
        {g.checkedInAt ? <Check className="size-4" /> : <span className="text-[12px] tabular-nums">{formatNumber(g.attendingCount ?? g.allowedCount, locale)}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium" dir="auto">
          {g.name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-white/45">
          {g.section ? <span style={{ color: g.section === "MEN" ? MEN : WOMEN }}>{SECTION_LABELS[g.section][locale]}</span> : null}
          {g.groupName ? <span dir="auto">{g.groupName}</span> : null}
          {g.checkedInAt ? <span>{fmt(t.checkedInAt, { time: clock(g.checkedInAt), n: formatNumber(g.checkedInCount ?? 1, locale) })}</span> : <span>{t.status[g.rsvpStatus]}</span>}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-white/30 rtl:rotate-180" />
    </button>
  );
}

function ResultSheet({
  sheet,
  entrance,
  count,
  setCount,
  busy,
  onCheckIn,
  onUndo,
  onClose,
  clock,
}: {
  sheet: NonNullable<Sheet>;
  entrance: Entrance;
  count: number;
  setCount: (n: number) => void;
  busy: boolean;
  onCheckIn: (g: DoorGuest) => void;
  onUndo: (g: DoorGuest) => void;
  onClose: () => void;
  clock: (iso: string) => string;
}) {
  const { dict, locale } = useI18n();
  const t = dict.door;
  const n = (v: number) => formatNumber(v, locale);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // After a successful check-in from the camera, go back to scanning by itself.
  const auto = sheet.kind === "guest" && sheet.justCheckedIn && sheet.fromScan;
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(onClose, 1800);
    return () => clearTimeout(id);
  }, [auto, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="door-sheet-title">
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#1d1915] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-[2rem]">
        <div className="flex justify-end">
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.close} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        {sheet.kind === "error" ? (
          <div className="pb-2 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e07a6a]/15 text-[#f0a093]">
              <AlertTriangle className="size-8" />
            </span>
            <p id="door-sheet-title" className="mt-4 font-display text-2xl">
              {sheet.reason === "error" ? t.error : t[sheet.reason]}
            </p>
            <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-full bg-white/10 text-[15px] font-medium hover:bg-white/15">
              {t.next}
            </button>
          </div>
        ) : (
          <GuestSheet
            g={sheet.guest}
            entrance={entrance}
            count={count}
            setCount={setCount}
            busy={busy}
            justCheckedIn={Boolean(sheet.justCheckedIn)}
            onCheckIn={onCheckIn}
            onUndo={onUndo}
            onClose={onClose}
            clock={clock}
            n={n}
          />
        )}
      </div>
    </div>
  );
}

function GuestSheet({
  g,
  entrance,
  count,
  setCount,
  busy,
  justCheckedIn,
  onCheckIn,
  onUndo,
  onClose,
  clock,
  n,
}: {
  g: DoorGuest;
  entrance: Entrance;
  count: number;
  setCount: (n: number) => void;
  busy: boolean;
  justCheckedIn: boolean;
  onCheckIn: (g: DoorGuest) => void;
  onUndo: (g: DoorGuest) => void;
  onClose: () => void;
  clock: (iso: string) => string;
  n: (v: number) => string;
}) {
  const { dict, locale } = useI18n();
  const t = dict.door;
  const max = Math.max(g.allowedCount, g.attendingCount ?? 1, count);
  const wrongSection = entrance !== "ALL" && g.section && g.section !== entrance;
  const tone = g.rsvpStatus === "ACCEPTED" ? "text-[#9fd3ae] bg-[#7fb38f]/15" : g.rsvpStatus === "DECLINED" ? "text-[#f0a093] bg-[#e07a6a]/15" : "text-[#f3c98b] bg-[#e0a85a]/15";

  return (
    <div data-testid="door-guest">
      <div className="text-center">
        {justCheckedIn ? (
          <span className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-[#7fb38f]/20 text-[#9fd3ae]">
            <Check className="size-9" />
          </span>
        ) : null}
        <p id="door-sheet-title" className="font-display text-3xl leading-tight" dir="auto">
          {g.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[13px] text-white/55">
          {g.groupName ? <span dir="auto">{g.groupName}</span> : null}
          <span dir="ltr">•••• {g.phoneTail}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium", tone)}>{t.status[g.rsvpStatus]}</span>
          {g.section ? <SectionTag section={g.section} /> : null}
        </div>
        <p className="mt-3 text-[14px] text-white/70">
          {fmt(t.admits, { n: n(g.allowedCount) })}
          {g.rsvpStatus === "ACCEPTED" && g.attendingCount ? <span className="text-white/45"> · {fmt(t.confirmed, { n: n(g.attendingCount) })}</span> : null}
        </p>
      </div>

      {wrongSection || g.rsvpStatus !== "ACCEPTED" ? (
        <div className="mt-4 space-y-2">
          {wrongSection ? (
            <Warning>{fmt(t.wrongSection, { section: SECTION_LABELS[g.section!][locale] })}</Warning>
          ) : null}
          {g.rsvpStatus === "DECLINED" ? <Warning>{t.declinedWarning}</Warning> : g.rsvpStatus === "PENDING" ? <Warning>{t.pendingWarning}</Warning> : null}
        </div>
      ) : null}

      {g.checkedInAt ? (
        <div className="mt-5">
          <p className={cn("rounded-2xl px-4 py-3 text-center text-[14px] font-medium", justCheckedIn ? "bg-[#7fb38f]/15 text-[#9fd3ae]" : "bg-[#e0a85a]/15 text-[#f3c98b]")}>
            {justCheckedIn ? `${t.checkedIn} · ${n(g.checkedInCount ?? 1)}` : fmt(t.already, { time: clock(g.checkedInAt) })}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button type="button" disabled={busy} onClick={() => onUndo(g)} className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 text-[14px] text-white/80 hover:bg-white/10 disabled:opacity-50">
              <Undo2 className="size-4" />
              {t.undo}
            </button>
            <button type="button" onClick={onClose} className="h-12 rounded-full bg-[#f5efe6] text-[15px] font-semibold text-[#14110e] hover:bg-white">
              {t.next}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-2 text-center text-[11px] uppercase tracking-[0.18em] text-white/50">{t.arriving}</p>
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              aria-label={t.fewer}
              disabled={count <= 1}
              onClick={() => setCount(count - 1)}
              className="flex size-12 items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10 disabled:opacity-30"
            >
              <Minus className="size-5" />
            </button>
            <span className="w-14 text-center font-display text-4xl tabular-nums" aria-live="polite">
              {n(count)}
            </span>
            <button
              type="button"
              aria-label={t.more}
              disabled={count >= Math.min(50, max + 5)}
              onClick={() => setCount(count + 1)}
              className="flex size-12 items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10 disabled:opacity-30"
            >
              <Plus className="size-5" />
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onCheckIn(g)}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#7fb38f] text-[16px] font-semibold text-[#0f1a12] transition hover:bg-[#8fc39f] disabled:opacity-60"
            data-testid="door-checkin"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
            {fmt(t.checkInN, { n: n(count) })}
          </button>
        </div>
      )}
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-[#e0a85a]/12 px-4 py-2.5 text-[13.5px] text-[#f3c98b]">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Shown when a door link was replaced, turned off, or the event is over. */
export function DoorClosed() {
  const { dict, locale } = useI18n();
  const t = dict.door.closed;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#14110e] px-6 text-center text-[#f5efe6]">
      <LogoMark className="h-12 text-[#c9a27a]" />
      <h1 className="mt-8 font-display text-3xl">{t.title}</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/60">{t.body}</p>
      <LanguageSwitcher locale={locale} className="mt-8 text-white/60 hover:bg-white/10 hover:text-white" />
    </div>
  );
}
