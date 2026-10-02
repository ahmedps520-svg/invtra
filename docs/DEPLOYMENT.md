# Deploying invtra.store

## Go live on invtra.store with Render (~10 minutes)

The repository contains a Render Blueprint (`render.yaml`) and a `Dockerfile`, so Render
creates everything for you: the web service (Docker), a PostgreSQL database, a 5 GB
persistent disk for uploads and rendered invitations, and the `invtra.store` domains.

1. **Push** — the code is on GitHub (`ahmedps520-svg/invtra`).
2. **Create the Blueprint** — render.com → *New* → *Blueprint* → connect GitHub → choose the
   `invtra` repository and the branch (`claude/beautiful-cray-wtskxa`, or `main` once merged)
   → Render reads `render.yaml`.
3. **Fill the two prompted values** — `ADMIN_EMAIL` (your email) and `ADMIN_PASSWORD`
   (a strong password; this is your staff login for `/admin`). Everything else is preset;
   `APP_SECRET` and the webhook secrets are generated automatically.
4. **Apply** — Render builds the Docker image, creates the database, and starts the app.
   On every start the container applies migrations, seeds themes/templates/admin
   (idempotent) and serves on Render's `$PORT`. Health check: `/api/health`.
   Your app is immediately reachable at `https://invtra.onrender.com`.
5. **Point your domain** — the Blueprint already added `invtra.store` and `www.invtra.store`
   to the web service. In the Render Dashboard open the **invtra** web service (not the
   database or the Blueprint page) → **Settings** → scroll to **Custom Domains** (add them
   with **+ Add Custom Domain** if they aren't listed). Create these records at your
   domain registrar:
   - `@` (root) → **A** record → `216.24.57.1`
   - `www` → **CNAME** → `invtra.onrender.com`

   Remove any other A/AAAA records for `@`. Render verifies the domain and issues HTTPS
   certificates automatically (usually within minutes of DNS propagating).

Costs on Render: the web service uses the paid `0.5c-512mb` instance (a paid instance is needed
for the persistent disk) and Postgres `0.1c-256mb` — both can be resized later.

Every push to the deployed branch redeploys automatically (`autoDeploy: true`).

**Preview mode.** The Blueprint starts with `WHATSAPP_PROVIDER=mock`,
`PAYMENT_PROVIDER=mock` and `ALLOW_MOCK_IN_PRODUCTION=true`, so you can explore everything
— landing page, designs, dashboard, and the full guest journey via `/dev/whatsapp` — without
sending real WhatsApp messages or taking payments. A demo account is seeded
(`demo@invtra.store` / `demo-password-2026`). **Before inviting real customers:**
1. connect WhatsApp ([WHATSAPP.md](WHATSAPP.md)): set `WHATSAPP_PROVIDER=cloud` and the
   `WHATSAPP_*` credentials (replace the generated `WHATSAPP_APP_SECRET` with your Meta App
   Secret), then point Meta's webhook to `https://invtra.store/api/webhooks/whatsapp`;
2. set `PAYMENT_PROVIDER=stripe` (+ keys) or `manual` (+ `PAYMENT_MANUAL_INSTRUCTIONS`);
3. configure email (`EMAIL_PROVIDER=smtp`, `SMTP_URL`);
4. delete `ALLOW_MOCK_IN_PRODUCTION` and `SEED_DEMO` (and remove the demo account in /admin).

For higher volume, switch storage to Cloudflare R2/S3 (`STORAGE_DRIVER=s3`), set
`INLINE_WORKER=false` and add a Render *Background Worker* from the same repo with start
command `npm run worker`.

---

INVTRA needs three things at runtime: the **web app**, at least one **queue worker**, and
**PostgreSQL**. Files go to S3-compatible object storage.

## Recommended topology

| Component | Suggestion |
| --- | --- |
| Web | Node 20+ container (Render — see above —, Fly.io, Railway, AWS ECS/App Runner, a VPS…) running `npm run start:prod`, behind HTTPS |
| Worker | Same image, command `npm run worker` (scale horizontally; workers coordinate through the database) |
| Database | Managed PostgreSQL 14+ (Neon, Supabase, RDS, Crunchy…) with daily backups |
| Storage | Cloudflare R2 or AWS S3 — **private** bucket |
| Email | Any SMTP provider (Postmark, SES, Resend SMTP…) |

> Serverless hosts (e.g. Vercel) can run the web app, but the worker must run elsewhere as a
> long-lived process; set `INLINE_WORKER=false` on the web app.

## Steps

```bash
# 1. Configure: copy .env.example → production secrets (see the REQUIRED markers)
#    APP_URL=https://invtra.store  NODE_ENV=production  WHATSAPP_PROVIDER=cloud  STORAGE_DRIVER=s3 …

# 2. Build
npm ci
npm run build                 # prisma generate + next build

# 3. Database
npm run db:deploy             # apply migrations
npm run db:seed               # themes, WhatsApp templates, first admin (ADMIN_EMAIL/ADMIN_PASSWORD)

# 4. Run
npm start                     # web (port 3000)
npm run worker                # worker(s)
```

With Docker: `docker compose up --build` (see `docker-compose.yml`) runs Postgres, the web
app and a worker; adapt it for your platform.

## After the first deploy

1. Configure the WhatsApp webhook and get the templates approved — see [WHATSAPP.md](WHATSAPP.md).
2. Payments: set `PAYMENT_PROVIDER=stripe` (+ keys, webhook to
   `https://invtra.store/api/webhooks/payments/stripe`, event `checkout.session.completed`)
   or `manual` with `PAYMENT_MANUAL_INSTRUCTIONS`.
3. Sign in as the admin and review **Admin → Templates** (all approved?) and **Admin → Overview**
   (queue healthy?).
4. Send yourself a test from an event's Review step.

## Production checklist

- [ ] `APP_SECRET` is ≥ 32 random characters and never reused across environments
- [ ] `NODE_ENV=production` (mock WhatsApp / payment providers are refused)
- [ ] HTTPS everywhere (HSTS is sent automatically in production)
- [ ] Object storage bucket is private
- [ ] Database backups enabled; connection uses TLS
- [ ] At least one worker running; Admin → Overview shows no stuck jobs
- [ ] WhatsApp templates approved; webhook verified; App Secret set
- [ ] SMTP configured so password-reset emails arrive
- [ ] Logs shipped from stdout (errors are also kept in Admin → System errors)
