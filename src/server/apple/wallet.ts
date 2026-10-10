import { readFileSync } from "node:fs";
import path from "node:path";
import type { Event, Guest, Invitation } from "@prisma/client";
import { PKPass } from "passkit-generator";
import sharp from "sharp";
import { appUrl, env } from "@/server/env";
import { hmac, safeEqual } from "@/server/security/tokens";
import { eventDesign } from "@/server/events/design";
import { eventForGuest, sectionInfo } from "@/server/events/sections";
import { eventQrText, invitationUrl } from "@/server/invitations";
import { mapsLinks } from "@/server/invitations/view-model";
import { eventIsActive } from "@/server/rsvp";
import { utcToZoned, zoneOffsetMs } from "@/lib/time";
import { walletConfig, type WalletConfig } from "./config";

/**
 * Apple Wallet pass for a guest's entry (an event ticket): the same QR as their invitation,
 * the event, date and time (in the event's time zone), venue, section and how many people.
 * Labels and texts are in English with Arabic translations (shown on Arabic iPhones).
 * Passes register for updates (webServiceURL), so a new time or place, a check-in or a
 * cancelled invitation reaches the Wallet by itself.
 */

type PassInvitation = Invitation & { guest: Guest; event: Event };

/** Shared secret the iPhone sends back when asking for updates to this pass. */
export function walletAuthToken(serial: string) {
  return hmac(`wallet:${serial}`).slice(0, 40);
}

export function checkWalletAuth(header: string | null, serial: string) {
  const token = header?.match(/^ApplePass\s+(.+)$/)?.[1]?.trim();
  return Boolean(token) && safeEqual(token!, walletAuthToken(serial));
}

/** When the pass content last changed (for Last-Modified / passesUpdatedSince). */
export function passLastModified(inv: Pick<Invitation, "walletUpdatedAt" | "createdAt">) {
  return inv.walletUpdatedAt ?? inv.createdAt;
}

let images: Promise<Record<string, Buffer>> | null = null;
function passImages() {
  images ??= (async () => {
    const src = readFileSync(path.join(process.cwd(), "src", "app", "apple-icon.png"));
    const png = (size: number) => sharp(src).resize(size, size).png().toBuffer();
    const [i1, i2, i3, l1, l2, l3] = await Promise.all([png(29), png(58), png(87), png(50), png(100), png(150)]);
    return { "icon.png": i1, "icon@2x.png": i2, "icon@3x.png": i3, "logo.png": l1, "logo@2x.png": l2, "logo@3x.png": l3 };
  })();
  return images;
}

/** "#1e1a16" → "rgb(30, 26, 22)" (the colour format Wallet wants). */
function rgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isFinite(n) ? `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})` : "rgb(30, 26, 22)";
}

/** A moment as an ISO date with the event's UTC offset, so Wallet shows the event's local time. */
function isoInZone(d: Date, tz: string) {
  const z = utcToZoned(d, tz);
  const mins = Math.round(zoneOffsetMs(d, tz) / 60000);
  const sign = mins >= 0 ? "+" : "-";
  const off = `${sign}${String(Math.floor(Math.abs(mins) / 60)).padStart(2, "0")}:${String(Math.abs(mins) % 60).padStart(2, "0")}`;
  return `${z.date}T${z.time}:00${off}`;
}

/** .strings escaping (the library writes keys and values as given). */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n");

const AR_LABELS: Record<string, string> = {
  Date: "التاريخ",
  Event: "المناسبة",
  Guest: "الضيف",
  Guests: "العدد",
  Time: "الوقت",
  Venue: "المكان",
  Section: "القسم",
  Address: "العنوان",
  Directions: "الاتجاهات",
  Entrance: "الدخول",
  Hosts: "أصحاب الدعوة",
  "Your invitation": "دعوتك",
  Status: "الحالة",
  "Checked in": "تم تسجيل الدخول",
  "Invitation cancelled": "أُلغيت الدعوة",
  "Please show this QR code at the entrance.": "يرجى إبراز رمز QR عند الدخول.",
  "Sent with INVTRA · invtra.store": "أُرسلت عبر إنفترا · invtra.store",
  "New time: %@": "الموعد الجديد: %@",
  "New venue: %@": "المكان الجديد: %@",
  "Welcome! %@": "أهلًا وسهلًا! %@",
};

/** The .pkpass for a guest, or null when Wallet isn't set up. */
export async function buildWalletPass(inv: PassInvitation, cfg?: WalletConfig | null): Promise<Buffer | null> {
  const config = cfg === undefined ? await walletConfig() : cfg;
  if (!config) return null;
  const { guest, event } = inv;
  const view = eventForGuest(event, guest);
  const section = sectionInfo(event, guest);
  const palette = eventDesign(event).palette;
  const qrText = eventQrText(event, inv.token);
  const tz = event.timezone;
  const ar: Record<string, string> = { ...AR_LABELS };
  const tr = (en: string | null | undefined, arText: string | null | undefined) => {
    const base = (en || arText || "").trim();
    if (arText && arText.trim() && arText.trim() !== base) ar[base] = arText.trim();
    return base;
  };

  const voided = guest.rsvpStatus !== "ACCEPTED" || inv.status !== "ACTIVE" || !eventIsActive(event);
  const people = guest.checkedInCount ?? guest.attendingCount ?? guest.allowedCount;
  const end = view.endsAt ?? new Date(view.startsAt.getTime() + 6 * 3600_000);
  const https = env().APP_URL.startsWith("https://");

  const pass = new PKPass(
    {
      ...(await passImages()),
      "pass.json": Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          passTypeIdentifier: config.passTypeId,
          teamIdentifier: config.teamId,
          organizationName: "INVTRA",
          description: `Invitation — ${event.title}`,
          logoText: "INVTRA",
          backgroundColor: rgb(palette.background),
          foregroundColor: rgb(palette.text),
          labelColor: rgb(palette.accent),
          eventTicket: {},
        }),
      ),
    },
    { wwdr: config.wwdrPem, signerCert: config.certPem, signerKey: config.keyPem },
    {
      serialNumber: inv.id,
      sharingProhibited: true,
      voided,
      // Wallet only talks to HTTPS servers (not a local development server).
      ...(https ? { webServiceURL: appUrl("/api/wallet"), authenticationToken: walletAuthToken(inv.id) } : {}),
    },
  );

  const title = tr(event.title, event.titleAr);
  pass.headerFields.push({ key: "date", label: "Date", value: isoInZone(view.startsAt, tz), dateStyle: "PKDateStyleMedium", ignoresTimeZone: true, changeMessage: "New time: %@" });
  pass.primaryFields.push({ key: "event", label: "Event", value: title });
  pass.secondaryFields.push({ key: "guest", label: "Guest", value: guest.name }, { key: "people", label: "Guests", value: String(people), textAlignment: "PKTextAlignmentRight" });
  pass.auxiliaryFields.push({ key: "time", label: "Time", value: isoInZone(view.startsAt, tz), timeStyle: "PKDateStyleShort", ignoresTimeZone: true, changeMessage: "New time: %@" });
  // Custom events can leave out the venue, the address or the hosts.
  if (view.venueName.trim() || view.venueNameAr?.trim()) pass.auxiliaryFields.push({ key: "venue", label: "Venue", value: tr(view.venueName, view.venueNameAr), changeMessage: "New venue: %@" });
  if (section) pass.auxiliaryFields.push({ key: "section", label: "Section", value: tr(section.label.en, section.label.ar) });
  if (guest.checkedInAt) pass.headerFields.unshift({ key: "status", label: "Status", value: tr("Checked in", AR_LABELS["Checked in"]), changeMessage: "Welcome! %@" });
  if (voided) pass.headerFields.unshift({ key: "status", label: "Status", value: tr("Invitation cancelled", AR_LABELS["Invitation cancelled"]) });

  const back = pass.backFields;
  if (qrText) back.push({ key: "note", value: tr("Please show this QR code at the entrance.", AR_LABELS["Please show this QR code at the entrance."]) });
  if (view.address.trim() || view.addressAr?.trim()) back.push({ key: "address", label: "Address", value: tr(view.address, view.addressAr) });
  const maps = mapsLinks(view);
  if (maps.hasLocation) back.push({ key: "map", label: "Directions", value: maps.mapsUrl, dataDetectorTypes: ["PKDataDetectorTypeLink"] });
  if (section && (section.note || section.noteAr)) back.push({ key: "entrance", label: "Entrance", value: tr(section.note ?? section.noteAr, section.noteAr) });
  if (event.hostNames.trim() || event.hostNamesAr?.trim()) back.push({ key: "hosts", label: "Hosts", value: tr(event.hostNames, event.hostNamesAr) });
  back.push({ key: "invitation", label: "Your invitation", value: invitationUrl(inv.token), dataDetectorTypes: ["PKDataDetectorTypeLink"] });
  back.push({ key: "brand", value: tr("Sent with INVTRA · invtra.store", AR_LABELS["Sent with INVTRA · invtra.store"]) });

  // The same code as the card: none when the event's card has no QR.
  if (qrText) pass.setBarcodes({ format: "PKBarcodeFormatQR", message: qrText, messageEncoding: "iso-8859-1" });
  pass.setRelevantDate(view.startsAt);
  pass.setExpirationDate(new Date(end.getTime() + 24 * 3600_000));
  if (view.latitude != null && view.longitude != null) pass.setLocations({ latitude: view.latitude, longitude: view.longitude, relevantText: title });

  pass.localize("ar", Object.fromEntries(Object.entries(ar).map(([k, v]) => [esc(k), esc(v)])));
  return pass.getAsBuffer();
}

/** A sample pass (sample event, sample guest) for Admin → Apple, to try on an iPhone. */
export async function sampleWalletPass(): Promise<Buffer | null> {
  const config = await walletConfig();
  if (!config) return null;
  const { sampleEvent } = await import("@/server/invitations/sample");
  const event = sampleEvent("luxury", "BILINGUAL");
  const now = new Date();
  const guest = {
    id: "sample-guest",
    eventId: event.id,
    name: "Khalid Al Hashimi",
    phone: "+966500000000",
    groupName: null,
    allowedCount: 2,
    attendingCount: 2,
    locale: null,
    notes: null,
    isTest: true,
    section: null,
    status: "ACCEPTED",
    rsvpStatus: "ACCEPTED",
    rsvpAt: now,
    rsvpSource: "WEB",
    deliveryStatus: "NOT_SENT",
    deliveryError: null,
    deliveryErrorCode: null,
    requestSentAt: null,
    manualSentAt: null,
    invitationSentAt: null,
    invitationSentVersion: null,
    lastInboundAt: null,
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    scanCount: 0,
    firstScannedAt: null,
    lastScannedAt: null,
    checkedInAt: null,
    checkedInCount: null,
    reminderSentAt: null,
    nudgedAt: null,
    nudgeCount: 0,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  } satisfies Guest;
  const invitation = {
    id: "sample-pass",
    eventId: event.id,
    guestId: guest.id,
    token: "SAMPLE2345",
    status: "ACTIVE",
    imageKey: null,
    imageVersion: null,
    waMediaId: null,
    waMediaVersion: null,
    waMediaExpiresAt: null,
    walletUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
  } satisfies Invitation;
  return buildWalletPass({ ...invitation, guest, event }, config);
}
