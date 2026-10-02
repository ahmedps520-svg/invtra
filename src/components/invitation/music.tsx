"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInvitation } from "./primitives";
import s from "./invitation.module.css";

/** Background music the guest starts themselves — never autoplays. */
export function MusicToggle({ src }: { src: string }) {
  const { d, vm } = useInvitation();
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onEnd = () => setPlaying(false);
    a.addEventListener("pause", onEnd);
    return () => a.removeEventListener("pause", onEnd);
  }, []);
  const toggle = async () => {
    const a = ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        a.volume = 0.6;
        await a.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };
  const label = playing ? d.music.pause : d.music.play;
  return (
    <>
      <audio ref={ref} src={src} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={label}
        className={cn(
          "fixed bottom-5 end-5 z-40 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-lg backdrop-blur transition",
          vm.mode === "host" && "bottom-24",
        )}
        style={{ background: "color-mix(in srgb, var(--inv-surface) 85%, transparent)", color: "var(--inv-text)", border: "1px solid var(--inv-line)" }}
      >
        {playing ? (
          <>
            <span className={cn(s.bars, "flex h-3 items-end")} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <Pause className="size-4" />
          </>
        ) : (
          <Music2 className="size-4" />
        )}
        <span className="hidden sm:inline">{label}</span>
      </button>
    </>
  );
}
