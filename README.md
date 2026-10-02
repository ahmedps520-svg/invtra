# INVTRA · إنفترا

**Your Invitation. Reimagined.** — premium digital invitations for weddings, engagements,
birthdays, corporate events and graduations, delivered to every guest through the official
WhatsApp Business Platform, each with their own personal invitation and QR code.

> Create → Personalize → Send → Accept → Receive → Scan → Celebrate

## What it does

1. A customer signs up at **invtra.store**, creates an event (names, date, venue, maps link,
   dress code, programme, contact…) in English, Arabic or both.
2. They pick one of seven themes (Minimal, Luxury, Romantic, Modern, Traditional, Arabic,
   Bilingual) and customise it in a live editor — or upload their own finished invitation.
3. They add guests (or import CSV/Excel) with WhatsApp numbers, review and confirm.
4. INVTRA's worker sends every guest an approved WhatsApp template with
   **ACCEPT INVITATION / DECLINE** buttons.
5. **Accept** → the guest instantly receives their personalised invitation image with a
   unique QR code and a **View Invitation** button opening their own invitation website
   (`invtra.store/i/8F3K92QXHT`). **Decline** → a polite thank-you, nothing else.
6. The host watches responses live (accepted, declined, pending, views, QR scans) and can
   check guests in at the door by scanning their QR.

## Highlights

- **Official WhatsApp Cloud API**, signed webhooks, de-duplicated, retrying background queue
  (Postgres `SKIP LOCKED`), throughput throttling, plain-language failure reasons.
- **Invitation image renderer**: one SVG builder used for the live editor preview and, via
  resvg, for the PNG sent on WhatsApp — Arabic shaping and RTL handled correctly.
- **Styled, logo-centred QR codes** that are verified to decode in tests for every theme.
- **Bilingual product** (English + العربية with real RTL) — site, dashboard, invitation
  pages and WhatsApp templates.
- **Security**: scrypt password hashing, hashed DB sessions, CSP with nonces, CSRF origin
  checks, Postgres-backed rate limiting, signed media URLs, owner-scoped queries,
  unguessable invitation tokens, no credentials in the browser.
- **Admin dashboard** for staff: customers, events, guests, WhatsApp messages & failures,
  payments, themes, templates (submit to / sync with Meta), errors, QR scans, audit log.
- **Payments** behind a provider interface: mock (dev), manual bank transfer, Stripe Checkout.

## Quick start (development)

Requirements: Node 20.9+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env                # defaults use the mock WhatsApp & payment providers
# set APP_SECRET (≥32 chars) and ADMIN_PASSWORD in .env
npx prisma migrate dev              # create the schema
npm run db:seed                     # themes, WhatsApp templates, admin user
SEED_DEMO=true npm run db:seed      # optional: demo@invtra.store / demo-password-2026
npm run dev                         # http://localhost:3000 (queue worker runs inline)
```

Then: sign up → create an event → design → add guests → review (choose a plan; the mock
checkout completes instantly) → send → open **/dev/whatsapp** to see each guest's phone and
press Accept/Decline. Mock numbers ending in `9999` are rejected as invalid and `0000` fail
as "not on WhatsApp".

## Configuration

Every variable is documented in [`.env.example`](.env.example). For production you need:

| Purpose | Variables |
| --- | --- |
| Core | `DATABASE_URL`, `APP_URL`, `APP_SECRET` |
| WhatsApp Cloud API | `WHATSAPP_PROVIDER=cloud`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (+ `WHATSAPP_APP_ID` to submit image templates) |
| Storage | `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (+ `S3_ENDPOINT` for R2 etc.) |
| Email | `EMAIL_PROVIDER=smtp`, `SMTP_URL`, `EMAIL_FROM` |
| Payments | `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — or `manual` + `PAYMENT_MANUAL_INSTRUCTIONS` |

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | production build / server |
| `npm run worker` | queue worker (run ≥1 in production) |
| `npm test` | unit + end-to-end pipeline tests (uses `TEST_DATABASE_URL`) |
| `npm run typecheck`, `npm run lint` | static checks |
| `npm run db:migrate` / `db:deploy` / `db:seed` | database |
| `node scripts/screenshot.mjs <path> <out.png> [--mobile] [--ar]` | visual QA |
| `npx tsx scripts/render-samples.ts` | render every theme's invitation image |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [WhatsApp Business Platform setup](docs/WHATSAPP.md)
- [Edge-case rules](docs/EDGE_CASES.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Engineering conventions](docs/CONVENTIONS.md)

## Tech

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Prisma 6 · PostgreSQL ·
resvg · sharp · qrcode · libphonenumber · zod · Vitest · Playwright.
