"use client";

import { useEffect } from "react";

/**
 * Installs /sw.js, which shows a branded "we're updating" page (and retries by itself)
 * if a visitor opens a page while a new version is being deployed.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
