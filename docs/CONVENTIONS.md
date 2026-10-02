# INVTRA — engineering conventions

Read this before adding code. It describes how the codebase is organised and the
rules every page, route and component follows.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19.2). Bundled docs live in
  `node_modules/next/dist/docs/` — check them; several APIs differ from older versions:
  - `params` / `searchParams` / `cookies()` / `headers()` are **async** (`await props.params`).
  - Middleware is called **Proxy** (`src/proxy.ts`).
- **TypeScript** strict, path alias `@/*` → `src/*`.
- **Tailwind CSS v4** — tokens are defined with `@theme` in `src/app/globals.css` (no
  tailwind.config). Important modifier is a suffix: `px-0!`.
- **Framer Motion 12** (`framer-motion`) for subtle animation. **lucide-react** icons.
- **Prisma 6 + PostgreSQL**. Schema: `prisma/schema.prisma`.
- **zod 3** for validation.

## Directory layout

```
src/
  app/                 routes (pages + route handlers)
    api/               JSON API (route handlers)
    i/[token]/         guest invitation website
    Q/[token]/         QR scan redirect (upper-case on purpose — see src/lib/qr)
  components/
    ui/                design-system primitives (Button, Input, Field, Card, Dialog, Tabs, Menu, Badge, Toast…)
    brand/             Logo
    i18n/              I18nProvider/useI18n, LanguageSwitcher
    invitation/        guest-facing invitation components + CardPreview
    marketing/ dashboard/ admin/ editor/   feature components
  lib/                 isomorphic code (safe in client components): design schema, themes, card SVG
                       builder, QR, formatting, i18n dictionaries, validation schemas, plans
  server/              server-only code: db, env, auth, storage, whatsapp, queue, services
  worker/main.ts       standalone queue worker
```

**Never import `@/server/*` from a client component.** Client components talk to the
server through `/api/*` using `api()` from `@/lib/api-client`.

## Auth & authorisation

- Pages: `const user = await requireUser("/dashboard/...")` / `requireAdmin()` from `@/server/auth/guards`.
- Route handlers: wrap with `route("name", async (req, ctx) => {...})` from `@/server/http`, call
  `requireApiUser()` / `requireApiAdmin()`, load events with `getOwnedEvent(user, id)` (404 for
  anything the user doesn't own).
- Validate every body with zod via `parseJson(req, schema)`; throw `badRequest/notFound/...`.
  Errors are returned as `{ error: { code, message, fields? } }`.
- `src/proxy.ts` blocks cross-origin POST/PATCH/DELETE to `/api/*` (CSRF). `fetch` from our own
  pages sends the right `Origin` automatically.
- Rate-limit anything public or expensive with `enforceRateLimit(key, limit, windowSeconds)`.

## Internationalisation (English + Arabic, RTL)

- UI locale comes from the `invtra_locale` cookie (`getI18n()` on the server returns
  `{ locale, dir, dict }`). `<html lang dir>` is set in the root layout.
- Dictionaries: `src/lib/i18n/dictionaries/{en,ar}/<namespace>.ts`. The Arabic file is typed as
  `typeof en` so a missing key is a type error. **Add every user-facing string in both languages.**
  Interpolate with `fmt("Hello {name}", { name })` from `@/lib/i18n/config`.
- Server components: `const { dict, locale } = await getI18n()`.
- Client components: a layout must provide the namespaces:
  `<I18nProvider locale={locale} dict={pickNamespaces(locale, ["dashboard"])}>`, then
  `const { dict, locale, dir } = useI18n()`.
- **RTL**: use logical utilities only — `ms-/me-/ps-/pe-/start-/end-/text-start/text-end`,
  `rtl:`/`ltr:` variants for icons that point somewhere (e.g. `rtl:rotate-180` on arrows).
  Never letter-space Arabic (globals.css already resets tracking for `:lang(ar)`).
- Dates/numbers: `formatDate`, `formatTime`, `formatDateTime`, `formatRelative`,
  `formatNumber`, `formatMoney` from `@/lib/format`. Dashboard uses Latin digits.
- The admin area is English-only (internal staff tool).

## Visual language

INVTRA should feel like a high-end stationery brand, not a SaaS dashboard.

- Background `bg-ivory`, surfaces `bg-paper`, borders `border-line`, text `text-ink` /
  `text-ink-soft` / `text-ink-faint`, accent bronze (`bronze-50…900`, primary `bronze-600`).
- Status tones: `sage` (accepted), `rosewood` (declined/failed), `ochre` (pending/warning),
  `slate` (sent/info), each with a `-soft` background.
- Headings `font-display` (Cormorant Garamond / Amiri), body `font-sans` (Jost / IBM Plex Sans Arabic).
  Small uppercase labels use the `.eyebrow` class.
- Generous whitespace, rounded-2xl cards, hairline borders, soft shadows (`shadow-soft`,
  `shadow-lift`), pill buttons. Motion is subtle (fade/slide 8–16px, `ease-luxe`, ≤ 0.8s) and
  respects reduced motion.
- Use the primitives in `src/components/ui` before writing new ones.
- Mobile-first; everything must work at 360px wide.
- No "coming soon" buttons, no fake success states: every control does the real thing.

## Invitations, themes & cards

- Themes: `src/lib/themes/registry.ts` (`THEMES`, `getTheme`, `THEME_LIST`). Theme names and
  descriptions are in the `themes` dictionary.
- A design is `InvitationDesign` (`src/lib/design/schema.ts`), stored on `Event.design`.
- The invitation image is an SVG built by `buildCardSvg` (`src/lib/card/build.ts`), rendered
  live in the browser by `<CardPreview>` (`src/components/invitation/card-preview.tsx`) and
  rasterised by the server with resvg for WhatsApp. Same code → same result.
- Guest statuses: `GuestStatus` is derived (see `src/server/guests/status.ts`) — never set it
  directly; use `updateGuest()`.

## WhatsApp in development

`WHATSAPP_PROVIDER=mock` (default in `.env`) sends nothing. Open `/dev/whatsapp` to see each
guest's phone and press Accept/Decline. Test numbers: ending in `9999` → rejected as invalid;
ending in `0000` → "not on WhatsApp" delivery failure; anything else → delivered and read.

## Commands

```
npm run dev          # Next.js dev server (+ inline queue worker when INLINE_WORKER=true)
npm run worker       # standalone queue worker (production)
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run db:migrate   # create/apply a migration in development
npm run db:seed      # themes, WhatsApp templates, admin user (ADMIN_EMAIL / ADMIN_PASSWORD)
```
