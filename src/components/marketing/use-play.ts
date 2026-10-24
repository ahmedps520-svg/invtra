"use client";

import { useEffect, useRef, useState } from "react";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * True while the element is on screen (never under reduced motion). Also toggles the namespaced
 * `ivx-playing` class on it, which the CSS-only loops in marketing.css key off.
 */
export function usePlayOnScreen<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || reducedMotion()) return;
    const io = new IntersectionObserver(([e]) => setPlaying(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  useEffect(() => {
    ref.current?.classList.toggle("ivx-playing", playing);
  }, [playing]);
  return { ref, playing };
}

/**
 * Steps a demo through its scenes while it plays: scene i lasts durations[i], then it loops.
 * While not playing it rests on the final scene (`durations.length`), so it's never empty.
 */
export function useStoryline(playing: boolean, durations: number[], restartKey: string | number = ""): number {
  const last = durations.length;
  const key = durations.join(",");
  // Each play-through is a session; a step recorded in an older session doesn't count.
  const session = `${key}|${restartKey}`;
  const [state, setState] = useState({ session: "", step: 0 });
  useEffect(() => {
    if (!playing) return;
    const steps = key.split(",").map(Number);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i = i >= steps.length ? 0 : i + 1;
      setState({ session, step: i });
      timer = setTimeout(tick, i >= steps.length ? 3200 : steps[i]);
    };
    timer = setTimeout(tick, steps[0]);
    return () => {
      clearTimeout(timer);
      setState({ session: "", step: 0 });
    };
  }, [playing, key, session]);
  if (!playing) return last;
  return state.session === session ? state.step : 0;
}
