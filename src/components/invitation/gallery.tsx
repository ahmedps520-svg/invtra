"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeading, useInvitation } from "./primitives";

export function Gallery() {
  const { vm, d } = useInvitation();
  const images = vm.event.gallery;
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((delta: number) => setOpen((i) => (i === null ? null : (i + delta + images.length) % images.length)), [images.length]);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(vm.lang === "ar" ? -1 : 1);
      if (e.key === "ArrowLeft") step(vm.lang === "ar" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, step, vm.lang]);
  if (!images.length) return null;
  return (
    <section>
      <SectionHeading label={(x) => x.gallery.title} />
      <div className="columns-2 gap-3 sm:columns-3">
        {images.map((img, i) => (
          <Reveal key={img.url} delay={Math.min(i, 6) * 0.06} className="mb-3 break-inside-avoid">
            <button type="button" onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-2xl" aria-label={fmt(d.gallery.photo, { n: i + 1, total: images.length })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption ?? ""}
                loading="lazy"
                width={img.width || undefined}
                height={img.height || undefined}
                className="h-auto w-full transition duration-700 group-hover:scale-[1.03]"
              />
            </button>
          </Reveal>
        ))}
      </div>
      <AnimatePresence>
        {open !== null ? (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={fmt(d.gallery.photo, { n: open + 1, total: images.length })}
            onClick={close}
          >
            <motion.img
              key={images[open].url}
              src={images[open].url}
              alt={images[open].caption ?? ""}
              className="max-h-[86vh] max-w-full rounded-lg object-contain"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            />
            {images[open].caption ? <p className="absolute inset-x-0 bottom-6 text-center text-sm text-white/80">{images[open].caption}</p> : null}
            <button type="button" onClick={close} aria-label={d.gallery.close} className="absolute end-4 top-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20">
              <X className="size-5" />
            </button>
            {images.length > 1 ? (
              <>
                <button type="button" onClick={(e) => (e.stopPropagation(), step(-1))} aria-label={d.gallery.previous} className={cn("absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20")}>
                  <ChevronLeft className="size-5 rtl:rotate-180" />
                </button>
                <button type="button" onClick={(e) => (e.stopPropagation(), step(1))} aria-label={d.gallery.next} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20">
                  <ChevronRight className="size-5 rtl:rotate-180" />
                </button>
              </>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
