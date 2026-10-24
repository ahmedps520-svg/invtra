"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: number; kind: ToastKind; message: ReactNode };

const ToastList = dynamic(() => import("./toast-list").then((m) => m.ToastList), { ssr: false });

const ToastContext = createContext<{ toast: (message: ReactNode, kind?: ToastKind) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [shown, setShown] = useState(false);
  const toast = useCallback((message: ReactNode, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setShown(true);
    setItems((xs) => [...xs.slice(-3), { id, kind, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* The live region is always there so screen readers announce the first toast too. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[200] flex flex-col items-center gap-2 px-4">
        {shown ? <ToastList items={items} /> : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
