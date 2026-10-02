"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MenuItem = {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/** Small popover menu (row actions etc.). */
export function Menu({
  trigger,
  items,
  align = "end",
  label = "Actions",
}: {
  trigger: ReactNode;
  items: (MenuItem | "divider")[];
  align?: "start" | "end";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-1.5 text-ink-faint transition hover:bg-sand hover:text-ink"
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "absolute z-50 mt-1 min-w-48 overflow-hidden rounded-xl border border-line bg-paper py-1 shadow-lift",
              align === "end" ? "end-0" : "start-0",
            )}
          >
            {items.map((it, i) =>
              it === "divider" ? (
                <div key={i} className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  disabled={it.disabled}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3.5 py-2 text-start text-sm transition disabled:opacity-40",
                    it.danger ? "text-rosewood hover:bg-rosewood-soft" : "text-ink-soft hover:bg-sand hover:text-ink",
                  )}
                >
                  {it.icon ? <span className="size-4 shrink-0 [&>svg]:size-4">{it.icon}</span> : null}
                  {it.label}
                </button>
              ),
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
