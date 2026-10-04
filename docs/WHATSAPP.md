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

Checked against Meta's docs on 3 October 2026 (developers.facebook.com/documentation/business-messaging/whatsapp/).

### Which phone number sends

The sender number must be registered on the **Cloud API**. A number that is in use on the
**WhatsApp Business app** can't simply be added:

- **Coexistence** (same number on the app *and* the API) is only offered through Embedded
  Signup by Meta Solution Partners / Tech Providers — not to a business connecting its own app.
- **Moving the number**: delete the account in the WhatsApp Business app (Settings → Account →
  Delete account; back up chats first — the history is lost), wait a few minutes, then add the
  number in Meta. It then works only through the API; INVTRA has no inbox for typing replies.
- **Recommended:** keep the app number for talking to customers, and give INVTRA a second
  number (a new SIM or landline that can receive an SMS or call and is not on WhatsApp).

### Steps

1. **developers.facebook.com → Create app** → use case *Connect with customers through
   WhatsApp* → choose (or create) INVTRA's business portfolio.
2. App → **WhatsApp → API Setup** → *Add phone number*: display name "INVTRA", category, then the
   SMS/voice code. Note the **Phone number ID** and the **WhatsApp Business Account ID**
   (Meta now calls it the *Messaging account ID* — same number, same API).
3. **Register** the number for the Cloud API (only possible by API) with a 6-digit PIN you
   choose (it becomes the number's two-step verification PIN):

   ```
   curl -X POST "https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>/register" \
     -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","pin":"<6 digits>"}'
   ```
4. **Business Settings → Users → System users** → add a system user (Admin) → *Assign assets*:
   the app and the WhatsApp account (full control) → *Generate token* (never expires) with
   `business_management`, `whatsapp_business_messaging`, `whatsapp_business_management`.
5. App → **Settings → Basic**: copy the **App ID** and **App secret**.
6. **WhatsApp Manager → Payment settings**: add a payment method (SAR is supported). Without
   one, template sends fail (error 131042).
7. **Business verification** (Business Settings → Security Center, with the Commercial
   Registration): new portfolios can message **250** different people per 24 hours; verifying
   raises it to **2,000** at once (it also rises with good-quality volume), then 10K → 100K →
   unlimited automatically.
8. Set the environment on the server (Render → invtra → Environment):

```
WHATSAPP_PROVIDER=cloud
WHATSAPP_ACCESS_TOKEN=…        # system user token
WHATSAPP_PHONE_NUMBER_ID=…
WHATSAPP_BUSINESS_ACCOUNT_ID=…
WHATSAPP_APP_SECRET=…          # verifies webhook signatures
WHATSAPP_VERIFY_TOKEN=…        # any random string
WHATSAPP_APP_ID=…              # only for submitting IMAGE-header templates from the admin
```

### Cost (per delivered message, Saudi Arabia, from 1 October 2026)

| Category | SAR | USD |
| --- | --- | --- |
| Marketing | 0.2159 | 0.0576 |
| Utility | 0.0401 | 0.0107 |
| Service replies (after 1,000 free per month) | 0.0401 | 0.0107 |

INVTRA submits invitations as **Utility**, but Meta may approve them as **Marketing** (its own
Marketing example is an event invitation) — the category is decided by Meta at approval.

## 2. Webhook

In the Meta App → WhatsApp → Configuration (Use cases → Customize → Configuration):

- **Callback URL:** `https://invtra.store/api/webhooks/whatsapp`
- **Verify token:** the value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to the **messages** field (delivers incoming button replies *and* outgoing
  message statuses: sent / delivered / read / failed).
- If no events arrive, subscribe the app to the WhatsApp account once:
  `curl -X POST "https://graph.facebook.com/v23.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer <ACCESS_TOKEN>"`

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
| reminder_en | invtra_event_reminder | en | Day-before reminder to accepted guests (URL button `/i/{{1}}`) |
| reminder_ar | invtra_event_reminder_ar | ar | Day-before reminder |
| nudge_en | invtra_rsvp_reminder | en | Reply reminder to guests who haven't answered (Accept / Decline) |
| nudge_ar | invtra_rsvp_reminder_ar | ar | Reply reminder |
| payment_request_en | invtra_payment_request | en | Payment link for a custom package (URL button `/pay/{{1}}`) |
| payment_request_ar | invtra_payment_request_ar | ar | Payment link for a custom package |
| payment_receipt_en | invtra_payment_receipt | en | Receipt after a custom package is paid (URL button `/pay/{{1}}`) |
| payment_receipt_ar | invtra_payment_receipt_ar | ar | Receipt after a custom package is paid |

All are **Utility** templates. Invitation and update templates have an **image header** (the
event's invitation design without any QR) and, for invitations, two **quick-reply** buttons.
The reminder templates have no header: the day-before reminder has a URL button to the guest's
invitation, and the reply reminder has the same Accept / Decline buttons as the invitation
(the answer is recorded exactly like the first one). Submit all four from Admin → Templates.
The four payment templates go to the event **host**, not to guests: they have no header and a
single URL button that opens the host's payment page (which becomes the receipt once paid).
Until `invtra_payment_request` is approved, Admin → Custom events sends the link by email only
(and staff can copy it); a missing receipt template just means the receipt goes by email. Variables are mapped by name
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

## Sending from the host's own WhatsApp

Until INVTRA's number is live (or whenever a host prefers), the Send step has a second tab,
**From my own WhatsApp**. Each guest gets a `https://wa.me/<number>?text=…` link that opens the
host's WhatsApp on that chat with the invitation text and the guest's personal link typed in;
the host presses send themselves — nothing is automated, so no Meta setup is involved.

- Pressing it records `Guest.manualSentAt` and counts the guest as sent (so INVTRA's own sending
  never messages them again).
- Those guests reply on their invitation page — always allowed for them, even when the event
  only accepts replies through WhatsApp buttons. The link preview shows the invitation design.
- A paid plan is required, exactly as for sending through INVTRA.

## Reminders

- **Day before** — when *Remind guests the day before* is on (Event details → Replies, on by
  default), the worker checks every five minutes and sends `invtra_event_reminder` to guests who
  accepted through INVTRA, 24 hours before their start (their own section's time when the event
  has men's and women's sections). Each guest gets it once; changing the date resets it. Guests
  who accepted in the last day are skipped (they just got their invitation), and nothing is sent
  in a language whose reminder template isn't approved yet.
- **Reply reminders** — on the event overview the host can remind guests INVTRA invited who
  haven't answered for a day (`invtra_rsvp_reminder`, at most twice per guest, two days apart).
- **From the host's own WhatsApp** — the Reminders card also lists every accepted guest (and
  everyone who hasn't replied) with a wa.me button: the reminder, the map link and the guest's
  invitation are typed in, and the host presses send.

## Development without WhatsApp

`WHATSAPP_PROVIDER=mock` sends nothing. Open **/dev/whatsapp** (signed in) to see every
guest's phone, tap Accept/Decline and watch the dashboard update — replies go through the
real, signature-checked webhook handler, and delivery receipts are simulated the same way.

Test numbers: `…9999` → rejected as invalid · `…0000` → "not on WhatsApp" · anything else →
delivered and read.
