"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, Film, Music2, RefreshCw, Share2, Volume2, VolumeX } from "lucide-react";
import { CardPreview } from "@/components/invitation/card-preview";
import { useI18n } from "@/components/i18n/provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import type { StatusVideo } from "@/server/video/status";
import { errorMessage } from "./i18n";
import { stepHref } from "./steps";

type PreviewProps = React.ComponentProps<typeof CardPreview>;

/**
 * "Video for your Status" on the event overview: the card animated as a 9:16 video. The host
 * makes it (it renders in the background in about a minute), then shares it straight to
 * WhatsApp from their phone or downloads it.
 */
export function StatusVideoCard({
  eventId,
  initial,
  hasPlan,
  hasMusic,
  filename,
  stage,
  preview,
}: {
  eventId: string;
  initial: StatusVideo;
  hasPlan: boolean;
  hasMusic: boolean;
  filename: string;
  /** The video's backdrop colours (centre, edge), so the poster looks like the video. */
  stage: [string, string];
  preview: PreviewProps;
}) {
  const { dict } = useI18n();
  const t = dict.dashboard.overview.video;
  const toast = useToast();
  const [video, setVideo] = useState<StatusVideo>(initial);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(true);
  const [canShare, setCanShare] = useState(false);
  const file = useRef<File | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const fileUrl = `/api/events/${eventId}/video/file`;

  // Poll while it renders.
  useEffect(() => {
    if (video.state !== "rendering") return;
    const timer = setInterval(async () => {
      try {
        const next = await api<StatusVideo>(`/api/events/${eventId}/video`);
        if (next.state === "ready") toast(t.ready);
        setVideo(next);
      } catch {
        // try again on the next tick
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [eventId, video.state, t.ready, toast]);

  // Phones can hand the file straight to WhatsApp. Fetch it ahead of time: iOS only allows
  // sharing right after a tap, with no download in between.
  useEffect(() => {
    if (video.state !== "ready") return;
    const probe = new File([], "video.mp4", { type: "video/mp4" });
    if (!navigator.canShare?.({ files: [probe] })) return;
    let cancelled = false;
    fetch(fileUrl)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (cancelled) return;
        file.current = new File([blob], filename, { type: "video/mp4" });
        setCanShare(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [video.state, video.url, fileUrl, filename]);

  async function make() {
    setBusy(true);
    try {
      setVideo(await api<StatusVideo>(`/api/events/${eventId}/video`, { method: "POST", body: {} }));
    } catch (e) {
      toast(errorMessage(e, dict), "error");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!file.current) return;
    try {
      await navigator.share({ files: [file.current] });
    } catch (e) {
      // Cancelled: nothing to do. Anything else: download it instead.
      if ((e as Error).name !== "AbortError") {
        const a = Object.assign(document.createElement("a"), { href: fileUrl, download: filename });
        a.click();
      }
    }
  }

  function toggleSound() {
    const el = player.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted) void el.play();
    setMuted(el.muted);
  }

  const rendering = video.state === "rendering";

  return (
    <Card className="overflow-hidden">
      <CardHeader title={t.title} description={t.body} />
      <div className="paper-grain flex justify-center bg-sand px-8 py-7">
        <div
          className="relative aspect-[9/16] w-full max-w-[216px] overflow-hidden rounded-[18px] shadow-lift ring-1 ring-ink/10"
          style={{ background: `radial-gradient(120% 75% at 50% 56%, ${stage[0]}, ${stage[1]})` }}
        >
          {video.state === "ready" ? (
            <>
              <video
                ref={player}
                key={video.url}
                src={video.url}
                poster={video.poster ?? undefined}
                className="absolute inset-0 size-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                aria-label={t.preview}
              />
              {hasMusic ? (
                <button
                  type="button"
                  onClick={toggleSound}
                  className="absolute bottom-2.5 end-2.5 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 [&>svg]:size-4"
                  aria-label={muted ? t.soundOn : t.soundOff}
                  aria-pressed={!muted}
                >
                  {muted ? <VolumeX /> : <Volume2 />}
                </button>
              ) : null}
            </>
          ) : (
            // A still of the video's first moments, until there's a video.
            <div aria-hidden="true">
              <p className="absolute inset-x-0 top-[12.5%] text-center font-display text-[15px] text-ivory/95 [text-shadow:0_1px_4px_rgb(0_0_0/0.35)]">
                {t.youreInvited}
              </p>
              <div className="absolute inset-x-[7.5%] top-[21.5%]">
                <CardPreview {...preview} guest={null} qrPlaceholder={false} className="w-full shadow-[0_10px_22px_rgb(0_0_0/0.45)]" />
              </div>
              {rendering ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/45 text-[12.5px] font-medium text-white backdrop-blur-[1.5px]">
                  <Spinner className="size-5" />
                  {t.making}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 px-6 py-5">
        {!hasPlan ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-soft">{t.locked}</p>
            <Link href={stepHref(eventId, "review")} className={buttonClasses("outline", "sm")}>
              {t.choosePlan}
            </Link>
          </div>
        ) : video.state === "ready" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {canShare ? (
                <Button size="sm" onClick={share} icon={<Share2 className="size-3.5" />}>
                  {t.share}
                </Button>
              ) : null}
              <a href={fileUrl} download={filename} className={buttonClasses(canShare ? "outline" : "primary", "sm")}>
                <Download className="size-3.5" />
                {t.download}
              </a>
            </div>
            <p className="text-[12.5px] leading-relaxed text-ink-faint">{t.howTo}</p>
          </>
        ) : rendering ? (
          <p className="text-[13px] leading-relaxed text-ink-soft" aria-live="polite">
            {t.makingHint}
          </p>
        ) : (
          <div className="space-y-3">
            {video.state === "failed" ? (
              <p className="text-[13px] text-rosewood" role="alert">
                {t.failed}
              </p>
            ) : video.outdated ? (
              <p className="text-[13px] text-ink-soft">{t.outdated}</p>
            ) : null}
            <Button
              size="sm"
              loading={busy}
              onClick={make}
              icon={video.state === "failed" || video.outdated ? <RefreshCw className="size-3.5" /> : <Film className="size-3.5" />}
            >
              {video.state === "failed" ? t.retry : video.outdated ? t.update : t.make}
            </Button>
          </div>
        )}

        {hasPlan ? (
          <p className="flex items-start gap-2 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-faint">
            <Music2 className="mt-0.5 size-3.5 shrink-0 text-bronze-600" aria-hidden="true" />
            <span>
              {hasMusic ? (
                t.withMusic
              ) : (
                <>
                  {t.noMusic}{" "}
                  <Link href={`${stepHref(eventId, "design")}#design-media`} className="font-medium text-bronze-700 hover:text-bronze-900">
                    {t.addMusic}
                  </Link>
                </>
              )}
            </span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
