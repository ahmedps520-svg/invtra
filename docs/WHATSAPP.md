# WhatsApp Business Platform setup

INVTRA uses Meta's official **WhatsApp Business Platform (Cloud API)** — no WhatsApp Web
automation, QR-login tricks or unofficial gateways. All credentials stay on the server.

## How the conversation works

```
Customer confirms "Send invitations"
        ↓  (queued, sent by the worker — never from the browser)
Template message  ──►  Guest's WhatsApp
  [header: invitation design]          Dear Khalid, you are warmly invited…
  [ACCEPT INVITATION] [DECLINE]        quick-reply payload = INVTRA|ACCEPT|<token>
        ↓ guest taps a button → webhook (signed)
ACCEPT  → status ACCEPTED → personalised image (unique QR) + VIEW INVITATION button
DECLINE → status DECLINED → "Thank you for letting us know." (nothing else)
```

The tap opens WhatsApp's 24-hour customer-service window, so the invitation image is sent
as an interactive **CTA URL** message (image header + "View Invitation" button) without a
template. Outside that window (e.g. "send update" weeks later) the approved
`invtra_invitation_update` template is used.

## 1. Meta setup (one time)

1. Create a **Meta Business** account and a **Meta App** (type *Business*) at
   developers.facebook.com, add the **WhatsApp** product.
2. In **WhatsApp Manager** add and verify INVTRA's sender phone number and display name
   (e.g. "INVTRA"). Note the **Phone number ID** and **WhatsApp Business Account ID**.
3. Create a **System User** (Business Settings → Users → System users), give it the app and
   the WABA with `whatsapp_business_messaging` + `whatsapp_business_management`, and generate a
   **permanent access token**.
4. App → Settings → Basic: copy the **App Secret** (and App ID).
5. Set the environment:

```
WHATSAPP_PROVIDER=cloud
WHATSAPP_ACCESS_TOKEN=…        # system user token
WHATSAPP_PHONE_NUMBER_ID=…
WHATSAPP_BUSINESS_ACCOUNT_ID=…
WHATSAPP_APP_SECRET=…          # verifies webhook signatures
WHATSAPP_VERIFY_TOKEN=…        # any random string
WHATSAPP_APP_ID=…              # only for submitting IMAGE-header templates from the admin
```

## 2. Webhook

In the Meta App → WhatsApp → Configuration:

- **Callback URL:** `https://invtra.store/api/webhooks/whatsapp`
- **Verify token:** the value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the **messages** field (delivers incoming button replies *and* outgoing
  message statuses: sent / delivered / read / failed).

Every POST is authenticated with `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with the
App Secret) before it is parsed; invalid signatures get 401. Deliveries are de-duplicated, so
Meta's retries are safe.

## 3. Message templates

Business-initiated messages must use templates approved by Meta, so customers choose from
INVTRA's approved templates and fill variables — they cannot send arbitrary text.
The standard set lives in `src/server/whatsapp/catalog.ts` and is loaded by `npm run db:seed`:

| Key | Meta name | Language | Purpose |
| --- | --- | --- | --- |
| formal_wedding_en | invtra_formal_wedding | en | Invitation (Accept / Decline) |
| elegant_en | invtra_elegant_invite | en | Invitation |
| formal_wedding_ar | invtra_formal_wedding_ar | ar | Invitation |
| elegant_ar | invtra_elegant_invite_ar | ar | Invitation |
| bilingual | invtra_bilingual_invite | ar | Invitation (Arabic + English) |
| newborn_visit_en | invtra_newborn_visit | en | Invitation — new baby / hospital visit, aqiqah |
| newborn_visit_ar | invtra_newborn_visit_ar | ar | Invitation — new baby / hospital visit, aqiqah |
| celebration_en | invtra_celebration_invite | en | Invitation — baby showers, birthdays, graduations, anniversaries |
| celebration_ar | invtra_celebration_invite_ar | ar | Invitation — baby showers, birthdays, graduations, anniversaries |
| update_en | invtra_invitation_update | en | Update (URL button `/i/{{1}}`) |
| update_ar | invtra_invitation_update_ar | ar | Update |

All are **Utility** templates with an **image header** (the event's invitation design without
any QR) and, for invitations, two **quick-reply** buttons. Variables are mapped by name
(`guest_name`, `host_names`, `event_date`, …) onto `{{1}}`, `{{2}}`… — see
`src/lib/whatsapp/templates.ts`.

Getting them approved — either:

- **From INVTRA:** Admin → Templates → *Submit to Meta* (uses the Graph API; image headers
  need `WHATSAPP_APP_ID` for the sample upload), then *Sync status* until they show
  **Approved**; or
- **In WhatsApp Manager:** create templates with exactly the same name, language, body,
  header type and buttons, then press *Sync status* in Admin → Templates.

Each template lists the occasions it was written for (`eventTypes`): customers only see the
templates that fit their event, and when they haven't chosen one the most specific match is
used (e.g. a newborn visit gets "New baby visit", not the wedding text).

Only `APPROVED` + active templates are offered to customers and used for sending. If a
template is paused or disabled by Meta, the running batch is cancelled and the error is shown
in Admin → System errors.

Customer-editable wording is limited to event-level variables (how the hosts' names, event
name and venue read), which keeps every message inside the approved template.

## 4. Throughput & reliability

- Sending runs in the background queue (`npm run worker`), throttled per worker by
  `WHATSAPP_MAX_MPS` (default 20/s; Cloud API default throughput is 80/s per number).
- Retryable errors (rate limits, 5xx) back off exponentially; per-recipient errors mark that
  guest *Failed* with a plain-language reason; systemic errors stop the batch.
- Uploaded media ids are cached for 25 days (WhatsApp keeps them 30).

## Development without WhatsApp

`WHATSAPP_PROVIDER=mock` sends nothing. Open **/dev/whatsapp** (signed in) to see every
guest's phone, tap Accept/Decline and watch the dashboard update — replies go through the
real, signature-checked webhook handler, and delivery receipts are simulated the same way.

Test numbers: `…9999` → rejected as invalid · `…0000` → "not on WhatsApp" · anything else →
delivered and read.
