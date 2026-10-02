# Deploying invtra.store

## Go live on invtra.store in ~10 minutes (Railway)

The repository ships a `Dockerfile` and `railway.json`, so it deploys as-is.

1. **Create the project** — railway.com → *New Project* → *Deploy from GitHub repo* →
   `ahmedps520-svg/invtra`, branch `claude/beautiful-cray-wtskxa` (or `main` once merged).
2. **Add a database** — in the project: *Create* → *Database* → *PostgreSQL*.
3. **Add a volume** to the web service (uploaded photos & rendered invitations):
   *Settings → Volumes* → mount path `/app/storage`.
4. **Variables** on the web service (*Variables → Raw editor*):

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   APP_URL=https://invtra.store
   APP_SECRET=<run: openssl rand -base64 48>
   INLINE_WORKER=true
   STORAGE_DRIVER=local
   LOCAL_STORAGE_DIR=/app/storage
   ADMIN_EMAIL=you@yourmail.com
   ADMIN_PASSWORD=<a strong password>
   WHATSAPP_APP_SECRET=<any random string for now>
   # Preview mode until WhatsApp (Meta) and payments are connected:
   WHATSAPP_PROVIDER=mock
   PAYMENT_PROVIDER=mock
   ALLOW_MOCK_IN_PRODUCTION=true
   SEED_DEMO=true
   ```

   The container runs `npm run start:prod`: applies migrations, seeds themes/templates/admin
   (idempotent) and starts on `$PORT`. Health check: `/api/health`.
5. **Domain** — web service → *Settings → Networking → Custom domain* → add `invtra.store`
   and `www.invtra.store`. Railway shows a CNAME target for each. At your domain registrar:
   - `www` → **CNAME** → the target Railway shows
   - `@` (root) → **ALIAS / ANAME / CNAME-flattening** → the same target (if your registrar
     can't do this for the root, move DNS to Cloudflare (free) which supports it)

   HTTPS certificates are issued automatically once DNS resolves.

**Preview mode** (`ALLOW_MOCK_IN_PRODUCTION=true`) lets you see and click through everything
— designs, dashboard, the whole guest flow via `/dev/whatsapp` — but sends no real WhatsApp
messages and takes no real payments. Before inviting real customers: connect WhatsApp
([WHATSAPP.md](WHATSAPP.md)) with `WHATSAPP_PROVIDER=cloud`, set `PAYMENT_PROVIDER=stripe` or
`manual`, configure SMTP, and **remove `ALLOW_MOCK_IN_PRODUCTION`**. For more traffic, set
`INLINE_WORKER=false` and add a second service from the same repo with start command
`npm run worker` (same variables + volume), or switch storage to R2/S3.

---

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
