# Architecture

```
            ┌──────────────────────── Next.js 16 (web) ────────────────────────┐
 Browser ──►│ Pages (RSC)  · marketing, auth, dashboard, editor, admin, /i/[token] │
            │ /api/*       · JSON API (zod-validated, session auth, CSRF origin)    │
            │ /api/webhooks/whatsapp · signed Meta webhooks                         │
            │ /Q/[token]   · QR scan → record → redirect to /i/[token]              │
            └───────────────┬───────────────────────────────┬──────────────────┘
                            │ Prisma                        │ enqueue
                     ┌──────▼──────┐                 ┌──────▼──────┐
                     │ PostgreSQL  │◄────────────────│ Job table   │◄── worker(s): npm run worker
                     └─────────────┘   SKIP LOCKED   └─────────────┘     (or INLINE_WORKER)
                                                            │
                         WhatsApp Cloud API ◄───────────────┤ send templates / images
                         Object storage (S3/R2/local) ◄─────┘ rendered invitations, uploads
```

## Pipeline

```
Customer creates event ─► designs invitation ─► adds guests
        ↓
System creates a unique invitation (random 10-char token) per guest
        ↓
Customer confirms ─► SendBatch + one `invitation.request` job per guest
        ↓
Worker: render teaser image (once per design version) → upload media → send template
        ↓
Guest taps ACCEPT ─► webhook (HMAC verified, de-duplicated)
        ↓
RSVP state machine (row-locked) → ACCEPTED → `invitation.deliver` job (high priority)
        ↓
Worker: render personalised PNG with the guest's QR (cached per version) → upload →
        interactive message: image + "View Invitation" button
        ↓
Guest opens /i/<token> → view recorded (JS beacon, bots ignored)
        ↓
Guest's QR scanned → /Q/<TOKEN> → scan recorded → invitation page (host: check-in view)

Guest taps DECLINE ─► webhook ─► DECLINED ─► thank-you text only (no image, no QR)
```

## Key modules

| Area | Location | Notes |
| --- | --- | --- |
| Data model | `prisma/schema.prisma` | Users, Sessions, Events, Guests, Invitations, InvitationViews, QRScans, Rsvps, Activities, InvitationThemes, MessageTemplates, SendBatches, WhatsAppMessages, WebhookEvents, Jobs, Orders, Payments, RateLimitBuckets, ErrorLogs, AuditLogs |
| Config | `src/server/env.ts` | zod-validated; refuses mock providers in production |
| Auth | `src/server/auth/*` | scrypt hashes, random session tokens stored as SHA-256, httpOnly SameSite cookies, sliding 30-day expiry |
| Security | `src/proxy.ts`, `src/server/security/*` | CSP with per-request nonces, CSRF origin check, Postgres-backed rate limiting, signed media URLs |
| Themes | `src/lib/themes/registry.ts` | 16 themes = palette + fonts + card ornament + page hero/section style + suited occasions; illustrations (teddy, moons, lanterns…) in `src/lib/card/motifs.ts` |
| Invitation image | `src/lib/card/*`, `src/server/render/card.ts` | isomorphic SVG builder (live preview in browser) rasterised with resvg (HarfBuzz shaping → correct Arabic) |
| QR | `src/lib/qr/index.ts` | styled QR (rounded/dots/classic, centre logo, EC level H), contrast-enforced, upper-case alphanumeric URL |
| Guest page | `src/app/i/[token]`, `src/components/invitation/*` | themed, bilingual, RSVP, entry pass, host check-in |
| WhatsApp | `src/server/whatsapp/*` | provider interface (Cloud API + mock), template composition, error classification, webhook processing |
| Queue | `src/server/queue/*` | durable Postgres queue, retries/backoff, stale-lock recovery, maintenance (purges) |
| Sending | `src/server/sending/*` | readiness checks, batches, resend, update, test sends, progress |
| RSVP | `src/server/rsvp.ts` | single state machine for WhatsApp, web and edge cases |
| Payments | `src/server/payments/*` | provider interface: mock, manual (bank transfer), Stripe Checkout |
| Admin | `src/app/admin/*`, `src/app/api/admin/*` | staff tools, audited actions |
| i18n | `src/lib/i18n/*` | typed EN/AR dictionaries, cookie locale, RTL |

## Guest status

`Guest.status` is derived — never written directly — by `deriveGuestStatus()`
(`src/server/guests/status.ts`) from the RSVP and delivery fields:

`PENDING → MESSAGE_SENT → ACCEPTED → INVITATION_SENT → VIEWED → QR_SCANNED`, or `DECLINED`,
or `FAILED` (Accept/Decline message undeliverable).

## Privacy

- Guest data is only reachable by the event owner (every query is scoped by `userId`) and
  admins; invitation pages expose only that guest's own invitation via an unguessable token.
- Views and scans store no IP address or fingerprint (only a coarse mobile/desktop flag).
- Uploaded images are re-encoded (EXIF/GPS stripped); storage is private, served by expiring
  signed URLs.
- Deleted events are purged with their files after 30 days; customers can delete their account.
