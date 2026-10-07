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
2. connect payments — see **Payments (Apple Pay, Google Pay, mada)** below — or use `manual`
   (+ `PAYMENT_MANUAL_INSTRUCTIONS`) for bank transfers;
3. configure email (`EMAIL_PROVIDER=smtp`, `SMTP_URL`);
4. delete `ALLOW_MOCK_IN_PRODUCTION` and `SEED_DEMO` (and remove the demo account in /admin).

## No downtime during deploys

While Render deploys a new version it briefly stops the old one (a service with a disk can't
overlap the two), so a visitor could see Render's own "502 Bad Gateway".

- **Already handled for returning visitors:** INVTRA installs a small service worker
  (`public/sw.js`) that replaces that error with a branded "We're updating INVTRA — this page
  will open by itself in less than 30 seconds" page (English + Arabic), which reopens the page
  automatically as soon as the new version answers.
- **See it any time:** open `https://invtra.store/updating-test`. That address always answers
  503, like the server mid-deploy, so the real service-worker path runs. A first visit installs
  the worker and reloads once; the page then says it was a test instead of reloading.
- **To remove the downtime completely,** move files off the disk to Cloudflare R2, then delete
  the disk — Render then keeps the old version serving until the new one is ready:
  1. Cloudflare → **R2** → *Create bucket* `invtra` (keep it private) → *Manage R2 API Tokens*
     → *Create API token* with *Object Read & Write* on that bucket. Note the Access Key ID,
     Secret Access Key and the S3 endpoint `https://<account-id>.r2.cloudflarestorage.com`.
  2. Render → invtra → **Environment**: add `S3_BUCKET=invtra`, `S3_ACCESS_KEY_ID`,
     `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_REGION=auto` (leave `STORAGE_DRIVER=local`).
  3. Render → invtra → **Shell**: `npx tsx scripts/migrate-storage-to-s3.ts` (copies existing
     uploads and invitation images; safe to repeat).
  4. Set `STORAGE_DRIVER=s3` and save. Check an invitation image and an uploaded photo load.
  5. Remove the `disk:` block from `render.yaml` (and the disk in Render → Settings → Disks).
     From then on every deploy is zero-downtime.

## Payments (Apple Pay, Google Pay, mada)

Prices are in Saudi riyals (`PAYMENT_CURRENCY=SAR`): Standard 499 SAR, Premium 699 SAR
(`src/lib/plans.ts`). Checkout uses **Tap Payments** (tap.company), a Saudi-licensed gateway
whose hosted payment page shows Apple Pay, Google Pay, mada, Visa/Mastercard and STC Pay —
Apple Pay and Google Pay need no extra setup on the hosted page.

1. Open a Tap merchant account (business documents: Commercial Registration, owner ID,
   IBAN). Ask Tap to enable mada, Apple Pay and Google Pay on the account.
2. Tap dashboard → *goSell → API Credentials* → copy the **secret key** (`sk_live_…`; use
   `sk_test_…` first to try test cards).
3. Render → invtra → Environment: `PAYMENT_PROVIDER=tap`, `TAP_SECRET_KEY=sk_…`, and remove
   `ALLOW_MOCK_IN_PRODUCTION` once WhatsApp is connected too. Save — the service redeploys.
4. Nothing to configure for webhooks: every charge tells Tap to notify
   `https://invtra.store/api/webhooks/payments/tap`. INVTRA verifies the `hashstring`
   signature **and** re-fetches the charge from Tap before activating a plan, and also
   checks the charge when the customer returns from the payment page.
5. Fill in `LEGAL_ENTITY_NAME`, `LEGAL_CR_NUMBER`, `LEGAL_VAT_NUMBER`, `LEGAL_ADDRESS` so your
   business details appear in the footer and Terms (required for Saudi e-commerce, and
   payment gateways check for them along with the Terms and Refund Policy at
   `/terms#refunds`).

Refunds are issued in the Tap dashboard, then recorded in *Admin → Payments*.

### Custom events (staff-priced packages)

**Admin → Custom events → New custom event** walks staff through the host, occasion, date and
venue, then the package: unlimited guests (or a fixed number), your own price in
`PAYMENT_CURRENCY`, and what's included. INVTRA creates the host's account if needed and the
event; staff then design the invitation in the same editor customers use (any design, premium
included, or their own artwork, plus wording, colours and fonts), and finally send the secret
payment link (`/pay/<token>`, no sign-in needed) by email and — once the
`invtra_payment_request` template is approved — WhatsApp. The host pays on the same Tap
checkout (Apple Pay, Google Pay, mada, cards); the plan is activated and a numbered receipt
(`INVTRA-2026-0001`, sequential per year) is emailed and sent on WhatsApp. The payment page then
shows the printable receipt. Unpaid packages can be re-sent or withdrawn from the list.

Set `LEGAL_ENTITY_NAME`, `LEGAL_CR_NUMBER`, `LEGAL_VAT_NUMBER` and `LEGAL_ADDRESS` so they appear
on receipts. INVTRA's receipts are payment confirmations, not ZATCA e-invoices — a
VAT-registered business in Saudi Arabia still needs a ZATCA-compliant invoicing solution.

## Apple (Wallet passes, Sign in with Apple)

Set up from **Admin → Apple** with an Apple Developer Program membership — no command line or
environment variables. Keys are generated or uploaded there and stored encrypted with
`APP_SECRET` (changing `APP_SECRET` means setting Apple up again).

- **Apple Wallet** — create a Pass Type ID (`pass.store.invtra.invitation`), press *Create the
  request* and download it, create a *Pass Type ID Certificate* with it in Apple Developer, and
  upload the `pass.cer` you get (a `.p12` from a Mac's Keychain works too). Accepted guests on
  iPhone, iPad and Mac then see *Add to Apple Wallet* on their entry pass. Saved passes register
  for updates (`/api/wallet/v1/…`), and INVTRA pushes a refresh through Apple when the time,
  venue or section changes, when a guest is checked in, or when an invitation is cancelled
  (the pass becomes void). The certificate lasts a year — renew it the same way.
  Apple asks websites to use its official *Add to Apple Wallet* badge: download the badges from
  developer.apple.com/wallet and save them as `public/badges/add-to-apple-wallet-en.svg` and
  `…-ar.svg`; until then a plain button is shown.
- **Sign in with Apple** — follow the steps on the page (App ID, Services ID with the return URL
  `https://invtra.store/api/auth/apple/callback`, a key), then enter the Team ID, Services ID and
  Key ID and upload the `.p8` file. *Continue with Apple* appears on the sign-in and sign-up
  pages. Accounts are matched by Apple ID, then by a verified email; hosts who signed up with
  Apple can add a password with *Forgot password*. Register `invtra.store` and
  `contact@invtra.store` for Apple's private email relay so emails reach "Hide My Email" users.
- **Apple Pay** needs nothing here: it is offered on Tap's payment page.

## VAT and starting fresh

**Admin → VAT** shows, per month in Riyadh time and to the halala: receipts, money collected,
refunds, the VAT owed and your income excluding VAT, plus quarter totals (what a Saudi VAT return
covers) and sales over the last 12 months against the registration thresholds (mandatory above
SAR 375,000, optional above SAR 187,500). Prices include VAT, so each receipt holds
`VAT_RATE`/(100 + `VAT_RATE`) of its amount as VAT (15/115 by default), rounded per receipt; a
refund takes its VAT off the month it is made. Click a month for every receipt line by line, or
download the month as CSV for your accountant.

On the 1st of each month the worker saves last month's statement and emails it to every admin
account and `ADMIN_EMAIL` (set `EMAIL_PROVIDER=smtp` and `SMTP_URL` so the email is actually
delivered). Once you're VAT-registered, set `LEGAL_VAT_NUMBER`: receipts then show the amount
before VAT and the VAT line.

**Admin → Payments → Start fresh** deletes every order, payment attempt, receipt number and VAT
statement — for clearing test payments before going live (type `DELETE ALL PAYMENTS` to confirm).
Events keep their plans; the audit log keeps a summary. Never use it after real customers have
paid.

## Door check-in for staff

On an event's overview the host can create a **door link** (`/door/<token>`) and send it to the
people at the entrance. They open it on their phone — no account — and scan guests' QR codes with
the in-page camera (or the phone's own camera app: QR scans from a phone that opened the door
link land on the door view), search by name or the last digits of a phone number, and check guests
in with the number of people arriving. With men's and women's sections, each phone can pick its
entrance and is warned about a guest from the other section. A new link revokes the old one, and
links stop working two days after the event. Camera access needs HTTPS (it is on invtra.store).

## Support chat on WhatsApp

Every page of the website shows a green "Chat with us" button (and the number in the footer)
that opens a WhatsApp chat with INVTRA support, with a greeting already typed. It uses
`SUPPORT_WHATSAPP` (digits with the country code, default `966557663974`); set it to an
empty value on Render to hide the button. It is an ordinary wa.me link: the visitor sends
the message from their own WhatsApp, and you answer from the WhatsApp Business app.

## Search engines (Google & Bing)

The site is built to be indexed: every marketing page has an English URL and an Arabic one
(`/ar/…`) linked with hreflang, a sitemap at `/sitemap.xml`, canonical URLs, structured data
(Organization, WebSite, Service, FAQ, breadcrumbs), 1200×630 share images (`/og/…`) and
landing pages per occasion (`/invitations/wedding`, `/invitations/newborn`, …).
`invtra.onrender.com` redirects to `invtra.store` so only one address gets indexed.

1. **Google Search Console** (search.google.com/search-console) → *Add property* → **Domain**
   → `invtra.store` → copy the `google-site-verification=…` TXT record → GoDaddy → DNS → *Add*
   → Type **TXT**, Name **@**, Value = that text → back in Search Console press *Verify*
   (DNS can take a few minutes). Then *Sitemaps* → submit `https://invtra.store/sitemap.xml`,
   and use *URL inspection* → *Request indexing* on the home page and `/ar`.
   (Alternative: the "HTML tag" method — put the `content` value in the Render env var
   `GOOGLE_SITE_VERIFICATION`.)

**Meta (Facebook) domain verification** — Business Settings → Brand safety → Domains → Add
invtra.store → choose *Meta-tag verification* → copy the `content` value into
`META_DOMAIN_VERIFICATION` on Render, wait for the redeploy, then press *Verify*.
2. **Bing Webmaster Tools** (bing.com/webmasters) → *Import from Google Search Console*
   (this also covers DuckDuckGo and Yahoo, and ChatGPT search uses Bing's index).
3. **Google Business Profile** (business.google.com) if you serve customers in a region —
   it makes "INVTRA" show as a brand panel.
4. Optional: set `SOCIAL_PROFILES` (comma-separated Instagram/TikTok/X/LinkedIn URLs) so
   Google connects your profiles to the site.

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
