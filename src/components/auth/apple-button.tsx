/**
 * "Continue with Apple" (Apple's human interface guidelines: black button, the Apple logo
 * and the standard title). A plain link to the start route — works without JavaScript.
 */
export function AppleSignInButton({ href, label, or, error }: { href: string; label: string; or: string; error?: string | null }) {
  return (
    <div>
      {error ? (
        <p role="alert" className="mb-4 rounded-xl border border-rosewood/20 bg-rosewood-soft px-4 py-3 text-[13.5px] text-rosewood">
          {error}
        </p>
      ) : null}
      <a
        href={href}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-[16px] font-medium text-white transition hover:bg-[#1d1d1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        data-testid="apple-signin"
      >
        <svg viewBox="0 0 17 20" aria-hidden="true" className="h-[18px] w-auto fill-current">
          <path d="M14.07 10.62c-.02-2.13 1.74-3.15 1.82-3.2-.99-1.45-2.53-1.65-3.08-1.67-1.31-.13-2.56.77-3.22.77-.67 0-1.69-.75-2.78-.73-1.43.02-2.75.83-3.48 2.11-1.49 2.58-.38 6.39 1.07 8.48.71 1.02 1.55 2.17 2.65 2.13 1.07-.04 1.47-.69 2.76-.69 1.29 0 1.65.69 2.77.67 1.15-.02 1.87-1.04 2.57-2.07.81-1.18 1.14-2.33 1.16-2.39-.03-.01-2.22-.85-2.24-3.38M11.97 4.38c.59-.71.98-1.7.87-2.69-.85.03-1.88.57-2.49 1.28-.55.63-1.03 1.64-.9 2.61.95.07 1.92-.48 2.52-1.2" />
        </svg>
        {label}
      </a>
      <div className="my-6 flex items-center gap-4 text-[12px] uppercase tracking-[0.16em] text-ink-faint" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {or}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
