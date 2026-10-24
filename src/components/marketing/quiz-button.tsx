"use client";

import type { ReactNode } from "react";

export const QUIZ_EVENT = "invtra:quiz";

/** Opens the "Find your invitation" quiz (mounted once per page by <Quiz />). */
export function QuizButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      onClick={() => window.dispatchEvent(new CustomEvent(QUIZ_EVENT))}
    >
      {children}
    </button>
  );
}
