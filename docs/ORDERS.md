# Orders: the event wizard, payment verification and delivery

## What customers do

`/dashboard/events/new` walks them through six steps:

1. **Product**: Digital invitation, Custom event design or Invitation image only (Photo only).
2. **Details**: only what the product needs (Photo only skips sections, programme and replies).
3. **Design**: one of INVTRA's designs, a **custom design request** (a brief plus up to 5 reference
   images; nobody is forced to pick a template), or their **own upload**.
4. **Features** (not for Photo only): QR codes (add / skip / decide later; never required), WhatsApp
   invitations, how email delivery works, and an explicit opt-in for order updates on WhatsApp. For a
   Digital invitation this is also where the package (Standard 100 / Premium 500 guests) is chosen.
5. **Review**: a summary, the price and a protected preview (see below).
6. **Payment**: the amount, the bank details from Admin → Payments, an optional receipt (image or PDF)
   and transfer reference, then **Submit order**. Submitting never marks an order paid: it becomes
   *Pending payment verification*.

The customer's order page (`/dashboard/orders/<id>`) shows the timeline, what staff need, how to pay,
and the files once approved. The bell in the dashboard shows in-app notifications.

## Order stages

`DRAFT → SUBMITTED → PENDING_VERIFICATION ⇄ INFO_REQUIRED` → staff decide:
`REJECTED` (with a reason; the customer can fix it and resubmit) or
`APPROVED → [IN_PRODUCTION for custom designs] → READY → DELIVERED`.

`Order.status` stays the money side (PENDING until approved, then PAID). Every change is written to
`OrderHistory` (who, when, note) and staff decisions also to the audit log.

## What staff do (Admin → Payments → an order)

- **Approve payment**: only after checking the bank account. The dialog requires ticking "I've checked
  the bank account". An uploaded receipt is evidence only. Approving twice, or two admins at once, has
  no further effect (row lock + stage check).
- **Reject payment** with a reason, or **Request more information**. Both email the customer and show in
  the app.
- **Custom designs**: after approval the order is *In production*. Upload the final file(s) (PNG, JPG,
  WEBP or PDF, up to 40 MB, stored as uploaded), then **Mark ready & deliver**. A custom design for a
  digital invitation also becomes the event's invitation image; sending waits until then.
- **Retry delivery** re-sends only the channels that failed or were skipped.
- **Product prices** (custom design, guests included, Photo only, custom design request) are set on the
  same page. Defaults: 999, 149 and 300 SAR, with 500 guests.

## Delivery (queue jobs, idempotent)

`order.fulfil` renders the final full-resolution image (2160 px wide for INVTRA designs) or moves a
custom design to production. `order.deliver` then sends each channel once (one `OrderDelivery` row per
channel):

- **Email**: confirmation with signed download links (`/d/<file>`, 14 days; checked again on every
  download, so a refund stops them) and the receipt link. The order is *Delivered* once this succeeds;
  if it fails the job retries and staff see the error.
- **WhatsApp**: only when INVTRA's number is connected and Meta allows sending, the customer opted in,
  hasn't replied STOP, and an approved `ORDER_UPDATE` template exists. Otherwise it's recorded as
  *Skipped* with the reason; a failure is recorded as *Failed*, never as sent.
- **In-app**: a notification (deduplicated).

## Protected previews

Until an order for the event is approved (`Event.purchasedAt`, or a plan), the design only leaves the
server as a 540 px JPEG, quality 55, stamped "PREVIEW ONLY · LOW RESOLUTION" across the card
(`/api/events/<id>/preview`). This applies in the editor (drafts are rendered on the server), on the
review step and dashboard, on guest image and link-preview routes, on payment links, in reminder
emails and in test messages. The full card (`/api/events/<id>/card`) answers 403. Final files are
served only by routes that check the user and the order stage; there are no public URLs.
