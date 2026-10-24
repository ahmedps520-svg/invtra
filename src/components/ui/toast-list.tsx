"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastItem } from "./toast";

/** The toasts themselves, loaded the first time one is shown so pages don't ship the animation library up front. */
export function ToastList({ items }: { items: ToastItem[] }) {
  return (
    <AnimatePresence>
      {items.map((t) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-3 rounded-full border px-5 py-3 text-sm shadow-lift backdrop-blur",
            t.kind === "error" ? "border-rosewood/30 bg-rosewood-soft/95 text-rosewood" : "border-line bg-ink/95 text-ivory",
          )}
        >
          {t.kind === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 text-bronze-300" />
          ) : t.kind === "error" ? (
            <AlertCircle className="size-4 shrink-0" />
          ) : (
            <Info className="size-4 shrink-0 text-bronze-300" />
          )}
          <span>{t.message}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
