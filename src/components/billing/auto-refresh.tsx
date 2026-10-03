"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the page every few seconds (e.g. while a payment is being confirmed). */
export function AutoRefresh({ seconds = 4, max = 15 }: { seconds?: number; max?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (++n > max) return clearInterval(t);
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, max]);
  return null;
}
