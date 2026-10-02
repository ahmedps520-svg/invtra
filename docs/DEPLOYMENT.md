# Deploying invtra.store

INVTRA needs three things at runtime: the **web app**, at least one **queue worker**, and
**PostgreSQL**. Files go to S3-compatible object storage.

## Recommended topology

| Component | Suggestion |
| --- | --- |
| Web | Node 20+ container (Fly.io, Render, Railway, AWS ECS/App Runner, a VPS…) running `npm start`, behind HTTPS |
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
