import Papa from "papaparse";
import ExcelJS from "exceljs";
import { Prisma, type Guest } from "@prisma/client";
import { db } from "@/server/db";
import { badRequest, conflict } from "@/server/http";
import { recordActivity } from "@/server/activity";
import { normalizePhone } from "@/lib/phone";
import { formatNumericDateTime } from "@/lib/format";
import { MAX_GUESTS_PER_EVENT, guestCapacity } from "@/lib/plans";
import { guestInputSchema, type GuestInput } from "@/lib/validation/guest";
import { invitationUrl } from "@/server/invitations";
import { cancelPendingJobs } from "@/server/queue/queue";
import { countryForTimezone } from "@/lib/timezone-country";
import { parseSectionValue, SECTION_LABELS, type SectionKey } from "@/lib/sections";

export { TIMEZONE_COUNTRY } from "@/lib/timezone-country";
export const defaultCountryFor = countryForTimezone;

async function assertCapacity(eventId: string, adding: number) {
  const [count, event] = await Promise.all([
    db.guest.count({ where: { eventId, isTest: false } }),
    db.event.findUnique({ where: { id: eventId }, select: { plan: true, guestLimit: true } }),
  ]);
  const cap = event ? guestCapacity(event) : MAX_GUESTS_PER_EVENT;
  if (count + adding > cap) {
    throw badRequest("too_many_guests", `An event can have at most ${cap} guests.`);
  }
}

export async function addGuest(eventId: string, input: GuestInput, defaultCountry: string): Promise<Guest> {
  const phone = normalizePhone(input.phone, defaultCountry);
  if (!phone.ok) throw badRequest("invalid_phone", "Enter a valid WhatsApp number with country code.", { phone: "Enter a valid number, e.g. +966 50 123 4567" });
  await assertCapacity(eventId, 1);
  try {
    return await db.guest.create({
      data: {
        eventId,
        name: input.name,
        phone: phone.e164,
        groupName: input.groupName,
        allowedCount: input.allowedCount,
        locale: input.locale ?? null,
        notes: input.notes,
        section: input.section ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw conflict("duplicate_phone", "A guest with this phone number is already on the list.");
    }
    throw e;
  }
}

export async function editGuest(guest: Guest, input: GuestInput, defaultCountry: string): Promise<Guest> {
  const phone = normalizePhone(input.phone, defaultCountry);
  if (!phone.ok) throw badRequest("invalid_phone", "Enter a valid WhatsApp number with country code.", { phone: "Enter a valid number, e.g. +966 50 123 4567" });
  const phoneChanged = phone.e164 !== guest.phone;
  try {
    return await db.guest.update({
      where: { id: guest.id },
      data: {
        name: input.name,
        phone: phone.e164,
        groupName: input.groupName,
        allowedCount: input.allowedCount,
        attendingCount: guest.attendingCount ? Math.min(guest.attendingCount, input.allowedCount) : guest.attendingCount,
        locale: input.locale ?? null,
        notes: input.notes,
        ...(input.section !== undefined ? { section: input.section } : {}),
        // A corrected number gets a clean slate so it can be (re)sent.
        ...(phoneChanged && guest.rsvpStatus === "PENDING"
          ? { deliveryStatus: "NOT_SENT", deliveryError: null, deliveryErrorCode: null, status: "PENDING", requestSentAt: null }
          : {}),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw conflict("duplicate_phone", "A guest with this phone number is already on the list.");
    }
    throw e;
  }
}

/** Deleting a guest revokes their invitation link and QR immediately. */
export async function deleteGuests(eventId: string, ids: string[]) {
  for (const id of ids) {
    await db.job.updateMany({
      where: { eventId, status: "PENDING", payload: { path: ["guestId"], equals: id } },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
  }
  const r = await db.guest.deleteMany({ where: { eventId, id: { in: ids } } });
  return r.count;
}

// ── Import ──────────────────────────────────────────────────────────────────

export type ImportRow = {
  row: number;
  name: string;
  phone: string;
  rawPhone: string;
  groupName: string | null;
  allowedCount: number;
  section: SectionKey | null;
  error: string | null;
  duplicate: "file" | "existing" | null;
};

const HEADERS: Record<"name" | "phone" | "group" | "count" | "section", RegExp> = {
  name: /^(name|full ?name|guest|guest ?name|invitee|الاسم|اسم|اسم الضيف|الضيف)$/i,
  phone: /^(phone|phone ?number|mobile|whatsapp|whats ?app|number|tel|telephone|رقم|الرقم|الجوال|جوال|الهاتف|هاتف|واتساب|رقم الواتساب)$/i,
  group: /^(group|family|family ?name|group ?name|household|table|العائلة|الأسرة|المجموعة|العائله)$/i,
  count: /^(guests|count|allowed|party|party ?size|number of guests|seats|pax|admits|عدد|العدد|عدد الضيوف|عدد المدعوين)$/i,
  section: /^(section|side|hall|gender|men ?\/ ?women|القسم|قسم|الجنس|رجال ?\/ ?نساء)$/i,
};

function mapColumns(header: string[]): { name: number; phone: number; group: number; count: number; section: number } | null {
  const idx = (re: RegExp) => header.findIndex((h) => re.test(String(h ?? "").trim()));
  const name = idx(HEADERS.name);
  const phone = idx(HEADERS.phone);
  if (name === -1 || phone === -1) return null;
  return { name, phone, group: idx(HEADERS.group), count: idx(HEADERS.count), section: idx(HEADERS.section) };
}

async function readRows(file: { name: string; data: Buffer }): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.data as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as unknown[]).slice(1).map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object") {
          const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
          if (o.richText) return o.richText.map((r) => r.text).join("");
          if (o.text) return String(o.text);
          if (o.result !== undefined) return String(o.result);
        }
        return String(v);
      });
      rows.push(values);
    });
    return rows;
  }
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = file.data.toString("utf8").replace(/^﻿/, "");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    return parsed.data;
  }
  throw badRequest("unsupported_file", "Upload a .csv or .xlsx file.");
}

/** Parse + validate an uploaded guest list without saving anything (preview step). */
export async function previewImport(eventId: string, file: { name: string; data: Buffer }, defaultCountry: string) {
  const rows = await readRows(file);
  if (!rows.length) throw badRequest("empty_file", "The file is empty.");
  let cols = mapColumns(rows[0]);
  let body = rows.slice(1);
  let firstRowNumber = 2;
  if (!cols) {
    // No recognisable header → assume Name, Phone, Group, Guests.
    cols = { name: 0, phone: 1, group: 2, count: 3, section: 4 };
    body = rows;
    firstRowNumber = 1;
  }
  const event = await db.event.findUnique({ where: { id: eventId }, select: { plan: true, guestLimit: true } });
  const cap = Math.min(event ? guestCapacity(event) : MAX_GUESTS_PER_EVENT, 50_000);
  if (body.length > cap) throw badRequest("too_many_rows", `A file can contain at most ${cap} guests.`);

  const existing = new Set((await db.guest.findMany({ where: { eventId }, select: { phone: true } })).map((g) => g.phone));
  const seen = new Set<string>();
  const out: ImportRow[] = [];
  body.forEach((r, i) => {
    const name = String(r[cols!.name] ?? "").trim();
    const rawPhone = String(r[cols!.phone] ?? "").trim();
    if (!name && !rawPhone) return;
    const groupName = cols!.group >= 0 ? String(r[cols!.group] ?? "").trim() || null : null;
    const countRaw = cols!.count >= 0 ? Number(String(r[cols!.count] ?? "").replace(/[^\d]/g, "")) : 1;
    const allowedCount = Number.isFinite(countRaw) && countRaw >= 1 ? Math.min(countRaw, 50) : 1;
    const section = cols!.section >= 0 ? parseSectionValue(String(r[cols!.section] ?? "")) : null;
    const phone = normalizePhone(rawPhone, defaultCountry);
    let error: string | null = null;
    if (!name) error = "missing_name";
    else if (!phone.ok) error = phone.reason === "empty" ? "missing_phone" : "invalid_phone";
    let duplicate: ImportRow["duplicate"] = null;
    if (phone.ok) {
      if (existing.has(phone.e164)) duplicate = "existing";
      else if (seen.has(phone.e164)) duplicate = "file";
      seen.add(phone.e164);
    }
    out.push({ row: firstRowNumber + i, name, rawPhone, phone: phone.ok ? phone.e164 : rawPhone, groupName, allowedCount, section, error, duplicate });
  });
  return {
    rows: out,
    summary: {
      total: out.length,
      valid: out.filter((r) => !r.error && !r.duplicate).length,
      invalid: out.filter((r) => r.error).length,
      duplicates: out.filter((r) => !r.error && r.duplicate).length,
    },
  };
}

/** Save confirmed rows. Invalid numbers and duplicates are skipped and reported. */
export async function importGuests(eventId: string, rows: GuestInput[], defaultCountry: string) {
  const existing = new Set((await db.guest.findMany({ where: { eventId }, select: { phone: true } })).map((g) => g.phone));
  const data: Prisma.GuestCreateManyInput[] = [];
  let invalid = 0;
  let duplicates = 0;
  for (const raw of rows) {
    const parsed = guestInputSchema.safeParse(raw);
    if (!parsed.success) {
      invalid++;
      continue;
    }
    const phone = normalizePhone(parsed.data.phone, defaultCountry);
    if (!phone.ok) {
      invalid++;
      continue;
    }
    if (existing.has(phone.e164)) {
      duplicates++;
      continue;
    }
    existing.add(phone.e164);
    data.push({
      eventId,
      name: parsed.data.name,
      phone: phone.e164,
      groupName: parsed.data.groupName,
      allowedCount: parsed.data.allowedCount,
      locale: parsed.data.locale ?? null,
      section: parsed.data.section ?? null,
    });
  }
  await assertCapacity(eventId, data.length);
  const created = await db.guest.createMany({ data, skipDuplicates: true });
  duplicates += data.length - created.count;
  if (created.count) await recordActivity(db, eventId, "guests.imported", { created: created.count, duplicates, invalid });
  return { created: created.count, duplicates, invalid };
}

// ── Export ──────────────────────────────────────────────────────────────────

export async function exportGuestsCsv(eventId: string): Promise<string> {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { timezone: true, sectionsEnabled: true } });
  const when = (d: Date) => formatNumericDateTime(d, event?.timezone ?? "Asia/Riyadh"); // dd/mm/yyyy HH:mm, event time
  const guests = await db.guest.findMany({
    where: { eventId, isTest: false },
    include: { invitation: { select: { token: true } } },
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
  });
  const csv = Papa.unparse({
    fields: [
      "Name",
      "Phone",
      "Group",
      "Guests allowed",
      ...(event?.sectionsEnabled ? ["Section"] : []),
      "Attending",
      "Status",
      "RSVP",
      "Delivery",
      "Delivery error",
      "Invitation link",
      "Views",
      "QR scans",
      "Checked in",
      "Last activity",
    ],
    data: guests.map((g) => [
      g.name,
      g.phone,
      g.groupName ?? "",
      g.allowedCount,
      ...(event?.sectionsEnabled ? [g.section ? SECTION_LABELS[g.section].en : ""] : []),
      g.attendingCount ?? "",
      g.status,
      g.rsvpStatus,
      g.deliveryStatus,
      g.deliveryError ?? "",
      g.invitation ? invitationUrl(g.invitation.token) : "",
      g.viewCount,
      g.scanCount,
      g.checkedInAt ? when(g.checkedInAt) : "",
      when(g.lastActivityAt),
    ]),
  });
  return "﻿" + csv; // BOM so Excel opens Arabic names correctly
}

export async function cancelGuestJobs(eventId: string) {
  await cancelPendingJobs({ eventId });
}
