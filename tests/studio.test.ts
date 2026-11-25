import { readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import jsQR from "jsqr";
import type { Event } from "@prisma/client";
import { db } from "@/server/db";
import { createCustomDraft } from "@/server/custom/service";
import { customEventInputSchema } from "@/lib/validation/event";
import { buildEventCardSvg } from "@/server/invitations/render";
import { fontFilesFor, renderSvgToPng } from "@/server/render/card";
import { inlineStudioAssets } from "@/server/render/studio-assets";
import { canUseStudio, guardCanvas } from "@/server/studio/access";
import { cardContent, eventDesign } from "@/server/events/design";
import { SAMPLE_GUEST, themeSampleContent } from "@/lib/card/sample";
import { getTheme } from "@/lib/themes/registry";
import { designSchema, type InvitationDesign } from "@/lib/design/schema";
import { EMPTY_CANVAS, canvasSchema, makeElement, parseCanvas, type CanvasDoc, type ImageElement, type ShapeElement, type TextElement } from "@/lib/canvas/schema";
import { fillFields, hasGuestField } from "@/lib/canvas/fields";
import { bounds, contains, resizeBox, snapAngle, snapRect, snapTargets, center } from "@/lib/canvas/geometry";
import {
  alignElements,
  distributeElements,
  duplicateElements,
  elementLabel,
  fitElement,
  groupElements,
  reorder,
  rotateElements,
  scaleElements,
  ungroupElements,
  withGroups,
  withPaper,
} from "@/lib/canvas/ops";
import { initialState, studioReducer } from "@/lib/canvas/history";
import { buildCanvasSvg, layoutText, type CanvasRenderContext } from "@/lib/canvas/render";
import { templateToCanvas, type TemplateJson } from "@/lib/canvas/templates";
import { canvasUploadKeys, isCanvasCard, keepUploads } from "@/lib/canvas/doc";
import { assetElement, qrElement, textElement } from "@/lib/canvas/factory";
import { getAsset, LIBRARY_ASSETS, searchAssets } from "@/lib/canvas/assets";

const run = randomBytes(4).toString("hex");
const content = themeSampleContent("peony");
const ctx: CanvasRenderContext = { content, guest: SAMPLE_GUEST.en, qrPlaceholder: true, language: "en", editor: true };

function text(over: Partial<TextElement> = {}): TextElement {
  return makeElement<TextElement>({ type: "text", id: `t${randomBytes(3).toString("hex")}`, x: 100, y: 100, w: 600, h: 60, text: "Hello", font: "cormorant", size: 40, color: "#222222", ...over });
}
function rect(over: Partial<ShapeElement> = {}): ShapeElement {
  return makeElement<ShapeElement>({ type: "shape", id: `s${randomBytes(3).toString("hex")}`, shape: "rect", x: 0, y: 0, w: 100, h: 100, ...over });
}
function doc(elements: CanvasDoc["elements"]): CanvasDoc {
  return { ...EMPTY_CANVAS, enabled: true, elements };
}
function template(key: string): TemplateJson {
  return JSON.parse(readFileSync(path.join(process.cwd(), "public", "studio", "templates", `${key}.json`), "utf8"));
}
async function decodeQr(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

describe("Studio documents", () => {
  it("keep the valid elements of a stored document and drop the rest", () => {
    const good = text();
    const parsed = parseCanvas({ enabled: true, elements: [good, { type: "text", id: "BAD ID" }, { type: "nope" }, good, rect()] });
    expect(parsed.enabled).toBe(true);
    expect(parsed.elements.map((e) => e.type)).toEqual(["text", "shape"]);
    expect(parseCanvas("rubbish")).toEqual(EMPTY_CANVAS);
  });

  it("are part of the design, empty and off by default", () => {
    const d = designSchema.parse(getTheme("peony").defaults);
    expect(d.canvas.enabled).toBe(false);
    expect(isCanvasCard(d)).toBe(false);
    expect(isCanvasCard({ canvas: doc([text()]) })).toBe(true);
  });

  it("list and filter the photos they use", () => {
    const photo = makeElement<ImageElement>({ type: "image", id: "img1", x: 0, y: 0, w: 10, h: 10, upload: "u/a/b/1.png" });
    const piece = assetElement(LIBRARY_ASSETS[0]);
    const d: CanvasDoc = { ...doc([photo, piece]), bg: { ...EMPTY_CANVAS.bg, image: { art: null, upload: "u/a/b/2.jpg", opacity: 1 } } };
    expect(canvasUploadKeys(d).sort()).toEqual(["u/a/b/1.png", "u/a/b/2.jpg"]);
    const kept = keepUploads(d, new Set(["u/a/b/2.jpg"]));
    expect(kept.elements).toEqual([piece]);
    expect(kept.bg.image?.upload).toBe("u/a/b/2.jpg");
  });
});

describe("smart fields", () => {
  it("fill in the event's details and the guest, in either language", () => {
    const v = { content, guest: { name: "Layla", allowedCount: 3 }, digits: "arab" as const };
    expect(fillFields("Dear {guest}", "en", v)).toBe("Dear Layla");
    expect(fillFields("{date}", "en", v)).toBe(content.date.en);
    expect(fillFields("{date.ar}", "en", v)).toBe(content.date.ar);
    expect(fillFields("{admits}", "en", v)).toContain("3");
    expect(fillFields("{admits}", "ar", v)).toContain("٣");
    expect(fillFields("{guest}", "en", { ...v, guest: null })).toBe("");
    expect(hasGuestField("For {guest.ar}")).toBe(true);
    expect(hasGuestField("{venue}")).toBe(false);
  });
});

describe("Studio geometry", () => {
  it("resizes a rotated box from a corner, keeping the opposite corner where it was", () => {
    const b0 = { x: 100, y: 100, w: 200, h: 100, rot: 30 };
    const before = bounds(b0);
    const nw = { x: 0, y: 0 };
    const b1 = resizeBox(b0, "se", { x: 600, y: 600 }, {});
    // The north-west corner (rotated) stays put.
    const corner = (b: typeof b0) => {
      const c = center(b);
      const a = (b.rot * Math.PI) / 180;
      const dx = -b.w / 2;
      const dy = -b.h / 2;
      return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
    };
    expect(corner(b1).x).toBeCloseTo(corner(b0).x, 6);
    expect(corner(b1).y).toBeCloseTo(corner(b0).y, 6);
    expect(b1.w).toBeGreaterThan(b0.w);
    expect(before.w).toBeGreaterThan(0);
    expect(nw).toBeDefined();
  });

  it("keeps the ratio on corners when asked, and never goes below the minimum", () => {
    const b0 = { x: 0, y: 0, w: 200, h: 100, rot: 0 };
    const b1 = resizeBox(b0, "se", { x: 600, y: 120 }, { keepRatio: true });
    expect(b1.w / b1.h).toBeCloseTo(2, 6);
    const b2 = resizeBox(b0, "e", { x: -500, y: 50 }, { minW: 10 });
    expect(b2.w).toBe(10);
    expect(b2.x).toBe(0);
  });

  it("snaps to the page and to other elements", () => {
    const targets = snapTargets({ w: 1080, h: 1350 }, [{ x: 300, y: 300, w: 100, h: 100 }]);
    const s = snapRect({ x: 537, y: 800, w: 6, h: 10 }, targets, 6);
    expect(s.dx).toBe(0);
    const s2 = snapRect({ x: 296, y: 900, w: 50, h: 50 }, targets, 6);
    expect(s2.dx).toBe(4);
    expect(s2.guides.x).toContain(300);
    expect(snapAngle(44, false)).toBe(45);
    expect(snapAngle(37, false)).toBe(37);
    expect(snapAngle(37, true)).toBe(30);
  });

  it("knows what's inside a rotated box", () => {
    const b = { x: 0, y: 0, w: 200, h: 20, rot: 90 };
    expect(contains(b, { x: 100, y: 10 })).toBe(true);
    expect(contains(b, { x: 100, y: 90 })).toBe(true);
    expect(contains(b, { x: 10, y: 10 })).toBe(false);
  });
});

describe("Studio operations", () => {
  it("bring forward past the next overlapping element, or all the way", () => {
    const a = rect({ id: "aaaa" });
    const b = rect({ id: "bbbb", x: 500 });
    const c = rect({ id: "cccc", x: 50 });
    const d = doc([a, b, c]);
    expect(reorder(d, ["aaaa"], "forward").elements.map((e) => e.id)).toEqual(["bbbb", "cccc", "aaaa"]);
    expect(reorder(d, ["cccc"], "back").elements.map((e) => e.id)).toEqual(["cccc", "aaaa", "bbbb"]);
    expect(reorder(d, ["aaaa"], "front").elements.map((e) => e.id)).toEqual(["bbbb", "cccc", "aaaa"]);
  });

  it("duplicate just above the originals with new ids, groups staying together", () => {
    const g = groupElements(doc([rect({ id: "aaaa" }), rect({ id: "bbbb" }), rect({ id: "cccc" })]), ["aaaa", "bbbb"]);
    const { doc: d, ids } = duplicateElements(g, ["aaaa", "bbbb"]);
    expect(d.elements).toHaveLength(5);
    expect(d.elements.slice(2, 4).map((e) => e.id)).toEqual(ids);
    const groups = new Set(d.elements.slice(2, 4).map((e) => e.group));
    expect(groups.size).toBe(1);
    expect(groups.has(g.elements[0].group)).toBe(false);
    expect(withGroups(d, [ids[0]]).sort()).toEqual([...ids].sort());
    expect(ungroupElements(d, ids).elements.slice(2, 4).every((e) => !e.group)).toBe(true);
  });

  it("align to the page or to each other, and space evenly", () => {
    const d = doc([rect({ id: "aaaa", x: 10 }), rect({ id: "bbbb", x: 300, w: 50 }), rect({ id: "cccc", x: 900 })]);
    const centred = alignElements(d, ["aaaa"], "hcenter");
    expect(centred.elements[0].x).toBe(490);
    const left = alignElements(d, ["aaaa", "bbbb", "cccc"], "left");
    expect(left.elements.map((e) => e.x)).toEqual([10, 10, 10]);
    const spaced = distributeElements(d, ["aaaa", "bbbb", "cccc"], "h");
    const r = spaced.elements.map((e) => [e.x, e.x + e.w]);
    expect(r[1][0] - r[0][1]).toBeCloseTo(r[2][0] - r[1][1], 6);
  });

  it("scale text sizes with the selection, and turn elements about a point", () => {
    const t = text({ id: "tttt", size: 40 });
    const scaled = scaleElements(doc([t]), ["tttt"], { x: 0, y: 0 }, 2, ctx);
    expect((scaled.elements[0] as TextElement).size).toBe(80);
    const turned = rotateElements(doc([rect({ id: "aaaa", x: 100, y: 0 })]), ["aaaa"], { x: 50, y: 50 }, 180);
    expect(turned.elements[0].x).toBeCloseTo(-100, 6);
    expect(Math.abs(turned.elements[0].rot)).toBe(180);
  });

  it("fit text to its lines, and keep text readable when the paper turns dark", () => {
    const t = text({ id: "tttt", text: "One\nTwo\nThree", h: 10 });
    const fitted = fitElement(t, ctx);
    expect(fitted.h).toBeCloseTo(layoutText(t, "One\nTwo\nThree").height, 6);
    const { doc: dark, recolored } = withPaper(doc([t, text({ id: "uuuu", color: "#F5F0E6" })]), "#1B2A41", null);
    expect(recolored).toBe(1);
    expect((dark.elements[0] as TextElement).color).toBe("#F3EADB");
    expect((dark.elements[1] as TextElement).color).toBe("#F5F0E6");
  });

  it("name layers after what they are", () => {
    expect(elementLabel(text({ text: "{venue.ar}" }))).toBe("Venue (Arabic)");
    expect(elementLabel(text({ text: "{guest}" }))).toBe("Guest's name");
    expect(elementLabel(assetElement(getAsset(LIBRARY_ASSETS[0].id)!))).toBe(LIBRARY_ASSETS[0].name.en);
    expect(searchAssets("rose").length).toBeGreaterThan(3);
  });
});

describe("Studio history", () => {
  it("undoes and redoes, merges quick repeats, and treats a gesture as one step", () => {
    const d0 = doc([rect({ id: "aaaa" })]);
    let s = initialState(d0);
    const d1 = { ...d0, elements: [rect({ id: "aaaa", x: 10 })] };
    s = studioReducer(s, { type: "commit", doc: d1, key: "x", at: 1000 });
    const d2 = { ...d0, elements: [rect({ id: "aaaa", x: 20 })] };
    s = studioReducer(s, { type: "commit", doc: d2, key: "x", at: 1500 });
    expect(s.past).toHaveLength(1);
    s = studioReducer(s, { type: "undo" });
    expect(s.doc).toBe(d0);
    s = studioReducer(s, { type: "redo" });
    expect(s.doc).toBe(d2);
    // A gesture: one checkpoint, then live moves.
    s = studioReducer(s, { type: "checkpoint" });
    for (let x = 21; x < 30; x++) s = studioReducer(s, { type: "live", doc: { ...d0, elements: [rect({ id: "aaaa", x })] } });
    expect(s.past).toHaveLength(2);
    s = studioReducer(s, { type: "undo" });
    expect(s.doc).toBe(d2);
    // Opening a document isn't a change to save; starting over from a template is.
    const v = s.version;
    expect(studioReducer(s, { type: "load", doc: d0 }).version).toBe(v);
    expect(studioReducer(s, { type: "load", doc: d0, history: true }).version).toBe(v + 1);
  });
});

describe("designs as Studio documents", () => {
  it("take every painted piece apart and keep the event's details as smart text", () => {
    for (const key of ["peony", "navy-lanterns"]) {
      const theme = getTheme(key);
      const d = templateToCanvas(template(key), { key, theme, design: theme.defaults, language: "BILINGUAL", content: themeSampleContent(key) });
      expect(d.enabled).toBe(true);
      expect(d.source).toBe(key);
      const types = d.elements.map((e) => e.type);
      expect(types.filter((t) => t === "image").length).toBeGreaterThan(3);
      expect(types).toContain("qr");
      const texts = d.elements.filter((e): e is TextElement => e.type === "text").map((e) => e.text).join("\n");
      expect(texts).toMatch(/\{date(\.(en|ar))?\}/);
      expect(texts).toMatch(/\{venue(\.(en|ar))?\}/);
      expect(texts).toMatch(/\{guest\}/);
      expect(canvasSchema.safeParse(d).success).toBe(true);
    }
  });

  it("draw guest-only text on guests' cards but not on the shared image", () => {
    const d = doc([text({ text: "Dear {guest}" }), text({ text: "{venue}" }), qrElement(getTheme("peony").defaults)]);
    const guest = buildCanvasSvg(d, { content, guest: { name: "Layla", allowedCount: 1 }, qrText: "https://invtra.store/i/ABC" });
    expect(guest).toContain("Dear Layla");
    expect(guest).toContain(content.venueName!);
    const teaser = buildCanvasSvg(d, { content, guest: null, qrText: null });
    expect(teaser).not.toContain("Dear");
    expect(teaser).toContain(content.venueName!);
    // No QR without a link (or a placeholder).
    expect(teaser.match(/<rect/g)?.length ?? 0).toBeLessThan(guest.match(/<rect/g)?.length ?? 0);
  });
});

describe("printing Studio designs", () => {
  let adminId = "";
  let hostId = "";
  let event: Event;

  beforeAll(async () => {
    const admin = await db.user.create({ data: { email: `studio-admin-${run}@example.test`, name: "Admin", passwordHash: "x", role: "ADMIN" } });
    adminId = admin.id;
    const input = customEventInputSchema.parse({
      type: "WEDDING",
      language: "EN",
      title: `Studio Wedding ${run}`,
      hostNames: "Sara & Omar",
      date: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
      time: "20:00",
      timezone: "Asia/Riyadh",
      venueName: "Grand Hall",
      address: "Riyadh",
    });
    const draft = await createCustomDraft(adminId, input);
    event = await db.event.findUniqueOrThrow({ where: { id: draft.id } });
    hostId = event.userId;
  });

  afterAll(async () => {
    await db.event.deleteMany({ where: { id: event?.id } });
    await db.user.deleteMany({ where: { id: { in: [adminId, hostId].filter(Boolean) } } });
  });

  it("print each guest's name and a QR code that scans to their invitation", async () => {
    const theme = getTheme("peony");
    const design = eventDesign(event);
    const canvas = templateToCanvas(template("peony"), { key: "peony", theme, design, language: "EN", content: cardContent(event, design) });
    const withCanvas = { ...event, design: { ...design, canvas } as unknown as Event["design"] };
    const link = `https://invtra.store/i/${randomBytes(6).toString("hex")}`;
    const svg = await buildEventCardSvg(withCanvas, { guest: { name: "Layla Hassan", allowedCount: 2 }, qrText: link });
    expect(svg).toContain("Layla Hassan");
    expect(svg).not.toMatch(/href="\/studio\//);
    const png = renderSvgToPng(svg);
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height]).toEqual([1080, 1350]);
    expect(await decodeQr(png)).toBe(link);
  });

  it("let only staff change a custom event's Studio design, with the event's own files", async () => {
    const saved = eventDesign(event);
    const piece = assetElement(LIBRARY_ASSETS[0]);
    const photo = makeElement<ImageElement>({ type: "image", id: "photo1", x: 0, y: 0, w: 100, h: 100, upload: `u/other/${run}.png` });
    const next: InvitationDesign = { ...saved, canvas: doc([piece, photo]) };
    expect(canUseStudio({ role: "ADMIN" }, event)).toBe(true);
    expect(canUseStudio({ role: "CUSTOMER" }, event)).toBe(false);
    expect(canUseStudio({ role: "ADMIN" }, { custom: false })).toBe(false);
    const asHost = await guardCanvas({ role: "CUSTOMER" }, event, next, saved);
    expect(asHost.canvas).toEqual(saved.canvas);
    const asStaff = await guardCanvas({ role: "ADMIN" }, event, next, saved);
    // The other event's file is dropped; the painted piece stays.
    expect(asStaff.canvas.elements.map((e) => e.id)).toEqual([piece.id]);
  });
});

describe("Studio server rendering", () => {
  it("inlines Studio pieces for the renderer", async () => {
    const id = LIBRARY_ASSETS[0].id;
    const svg = await inlineStudioAssets(`<svg><image href="/studio/a/${id}.webp?v=1"/><image href="/studio/paper.jpg?v=1"/></svg>`);
    expect(svg).toMatch(/href="data:image\/png;base64,/);
    expect(svg).toMatch(/href="data:image\/jpeg;base64,/);
  });

  it("loads only the fonts a card uses", () => {
    const files = fontFilesFor(`<svg><text font-family="'Great Vibes'">A</text><text font-family="'Cairo'">ب</text></svg>`).map((f) => path.basename(f));
    expect(files).toContain("great-vibes-400.ttf");
    expect(files).toContain("cairo-400.ttf");
    expect(files).toContain("jost-400.ttf");
    expect(files).not.toContain("pacifico-400.ttf");
    // Unknown typefaces fall back to everything.
    expect(fontFilesFor(`<svg><text font-family="Mystery Sans">A</text></svg>`).length).toBeGreaterThan(100);
  });

  it("new elements are valid documents", () => {
    const d = getTheme("peony").defaults;
    const els = [textElement({ text: "{guest}", preset: "title", design: d, lang: "ar" }), qrElement(d), assetElement(LIBRARY_ASSETS[5])];
    expect(canvasSchema.safeParse(doc(els)).success).toBe(true);
  });
});
