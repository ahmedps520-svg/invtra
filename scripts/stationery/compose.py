"""Compose a design's stationery artwork from a recipe (JSON).
Paper (procedural grain + fibres + vignette), optional washes, gold-foil frames, then painted flower layers:
each layer occludes what's beneath it inside its silhouette and is printed (multiplied) onto the paper,
so watercolour stays translucent but flowers never double-expose.
usage: compose.py <recipe.json> <cutdir> <out.jpg> [--guides out_guides.jpg]"""
import json, sys, math, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument("recipe"); ap.add_argument("cutdir"); ap.add_argument("out")
ap.add_argument("--guides", default=None)
ap.add_argument("--thumb", default=None, help="also write a 360 x 450 thumbnail here")
a = ap.parse_args()
R = json.load(open(a.recipe))
W, H = R.get("size", [1080, 1350])
rng = np.random.default_rng(R.get("seed", 7))

def hex2rgb(h):
    h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255

# ── Paper ─────────────────────────────────────────────────────────────────────
pp = R.get("paper", {})
top, bottom = hex2rgb(pp.get("color", "#F7F1E6")), hex2rgb(pp.get("color2", pp.get("color", "#F7F1E6")))
t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
paper = top * (1 - t) + bottom * t
paper = np.broadcast_to(paper, (H, W, 3)).copy()
def noise(scale, amp):
    n = rng.standard_normal((H // scale + 2, W // scale + 2)).astype(np.float32)
    n = np.asarray(Image.fromarray(n).resize((W, H), Image.BICUBIC))
    return n * amp
fib = noise(40, 1) + noise(9, 0.6)
fib = ndi.gaussian_filter(fib, 2)
fib = fib / (np.abs(fib).max() + 1e-6)
grain = ndi.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), 0.6)
grain /= grain.std() + 1e-6
paper *= (1 + pp.get("mottle", 0.018) * fib[..., None] + pp.get("grain", 0.012) * grain[..., None])
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
paper *= (1 - pp.get("vignette", 0.05) * np.clip(r - 0.55, 0, 1)[..., None] ** 1.6)
paper = np.clip(paper, 0, 1)
base_paper = paper.copy()

# ── Washes: soft watercolour blooms behind the flowers ─────────────────────────
for w in R.get("washes", []):
    c = hex2rgb(w["color"]); rad = w["r"]
    d = np.sqrt(((xx - w["cx"]) / (rad * w.get("sx", 1))) ** 2 + ((yy - w["cy"]) / (rad * w.get("sy", 1))) ** 2)
    edge = noise(18, 0.35) + noise(5, 0.12)
    m = np.clip(1 - (d + edge * 0.6), 0, 1) ** w.get("soft", 1.4) * w.get("opacity", 0.25)
    if w.get("mode") == "glow":  # light on dark paper (screen)
        paper[:] = 1 - (1 - paper) * (1 - m[..., None] * c)
        base_paper[:] = 1 - (1 - base_paper) * (1 - m[..., None] * c)
    else:
        tint = 1 - m[..., None] * (1 - c)
        paper *= tint
        base_paper *= tint

out = paper.copy()

# ── Frames (gold foil or ink), supersampled ───────────────────────────────────
def foil(kind, color):
    if kind == "gold":
        g = np.stack([np.interp((xx + yy * 0.6) / (W + H * 0.6) * 6 % 2, [0, 0.5, 1, 1.5, 2], [v0, v1, v2, v1, v0]) for v0, v1, v2 in
                      zip(hex2rgb("#A9874E"), hex2rgb("#E3CC92"), hex2rgb("#C7A465"))], -1)
        return g.astype(np.float32)
    return np.broadcast_to(hex2rgb(color), (H, W, 3))

for fr in R.get("frames", []):
    S = 3
    m = Image.new("L", (W * S, H * S), 0); d = ImageDraw.Draw(m)
    ins, lw = fr["inset"] * S, max(1, round(fr.get("width", 1.5) * S))
    if fr["type"] == "rect":
        d.rectangle([ins, ins, W * S - ins, H * S - ins], outline=255, width=lw)
    elif fr["type"] == "round":
        d.rounded_rectangle([ins, ins, W * S - ins, H * S - ins], radius=fr.get("radius", 30) * S, outline=255, width=lw)
    elif fr["type"] == "arch":
        x0, x1, y1 = ins, W * S - ins, H * S - ins
        rr = (x1 - x0) / 2; ytop = fr.get("top", 60) * S
        d.arc([x0, ytop, x1, ytop + 2 * rr], 180, 360, fill=255, width=lw)
        d.line([x0, ytop + rr, x0, y1], fill=255, width=lw); d.line([x1, ytop + rr, x1, y1], fill=255, width=lw)
        d.line([x0, y1, x1, y1], fill=255, width=lw)
    elif fr["type"] == "oval":
        cx, cy, rx, ry = [v * S for v in (fr["cx"], fr["cy"], fr["rx"], fr["ry"])]
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=255, width=lw)
    mm = np.asarray(m.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255 * fr.get("opacity", 0.9)
    col = foil(fr.get("foil", "ink"), fr.get("color", "#B08D57"))
    out = out * (1 - mm[..., None]) + col * mm[..., None]
    base_paper = base_paper * (1 - mm[..., None]) + col * mm[..., None]

# ── Flower layers ─────────────────────────────────────────────────────────────
cache = {}
def load(name):
    if name not in cache:
        cache[name] = Image.open(f"{a.cutdir}/{name}.png").convert("RGBA")
    return cache[name]

for L in R.get("layers", []):
    im = load(L["src"])
    if L.get("crop"):
        x0, y0, x1, y1 = L["crop"]; w0, h0 = im.size
        im = im.crop((int(x0 * w0), int(y0 * h0), int(x1 * w0), int(y1 * h0)))
        # Fade the cut edges so a crop never shows as a hard line through the painting.
        ca = np.asarray(im).astype(np.float32)
        hh, ww = ca.shape[:2]; f = max(8, int(min(hh, ww) * 0.08))
        ramp = np.ones((hh, ww), np.float32)
        if x0 > 0: ramp[:, :f] *= np.linspace(0, 1, f)[None, :]
        if x1 < 1: ramp[:, -f:] *= np.linspace(1, 0, f)[None, :]
        if y0 > 0: ramp[:f, :] *= np.linspace(0, 1, f)[:, None]
        if y1 < 1: ramp[-f:, :] *= np.linspace(1, 0, f)[:, None]
        ca[..., 3] *= ramp
        im = Image.fromarray(ca.round().astype(np.uint8), "RGBA")
    if L.get("flip"): im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if L.get("flipv"): im = im.transpose(Image.FLIP_TOP_BOTTOM)
    scale = L["w"] / im.width if "w" in L else L["h"] / im.height
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    if L.get("rot"): im = im.rotate(L["rot"], resample=Image.BICUBIC, expand=True)
    arr = np.asarray(im).astype(np.float32) / 255
    al = arr[..., 3] * L.get("opacity", 1.0)
    col = arr[..., :3]
    if L.get("tint"):  # gentle recolour toward a hue (keeps value structure)
        tc = hex2rgb(L["tint"]); k = L.get("tint_amount", 0.35)
        lumi = col.mean(-1, keepdims=True); col = col * (1 - k) + (lumi * tc / max(tc.mean(), 1e-3)) * k
    if L.get("sat") is not None:
        lumi = col.mean(-1, keepdims=True); col = np.clip(lumi + (col - lumi) * L["sat"], 0, 1)
    if L.get("bright") is not None:
        col = np.clip(col * L["bright"], 0, 1)
    h, w = al.shape
    X0, Y0 = round(L["cx"] - w / 2), round(L["cy"] - h / 2)
    # Clip to canvas
    sx0, sy0 = max(0, -X0), max(0, -Y0)
    dx0, dy0 = max(0, X0), max(0, Y0)
    dx1, dy1 = min(W, X0 + w), min(H, Y0 + h)
    if dx1 <= dx0 or dy1 <= dy0: continue
    sl = (slice(dy0, dy1), slice(dx0, dx1)); ss = (slice(sy0, sy0 + dy1 - dy0), slice(sx0, sx0 + dx1 - dx0))
    la, lc = al[ss], col[ss]
    blend = L.get("blend", "multiply")
    if blend == "normal":  # foil and other opaque ornament
        out[sl] = out[sl] * (1 - la[..., None]) + lc * la[..., None]
        continue
    # Silhouette: everything the painting covers, holes filled (white petals occlude too).
    thr = 0.04 if blend == "multiply" else 0.1
    base_mask = ndi.binary_closing(la > thr, iterations=3)
    filled = ndi.binary_fill_holes(base_mask)
    # Fill only small holes (inside petals); larger gaps between leaves stay open.
    holes, nh = ndi.label(filled & ~base_mask)
    if nh:
        hs = ndi.sum(np.ones_like(holes), holes, index=np.arange(1, nh + 1))
        big = np.isin(holes, np.where(hs > (2500 if blend == "multiply" else 900))[0] + 1)
        filled &= ~big
    sil = filled
    sil = ndi.binary_erosion(sil, iterations=1 if blend == "multiply" else 2)
    sil = ndi.gaussian_filter(sil.astype(np.float32), 1.2 if blend == "multiply" else 0.9) * L.get("opacity", 1.0)
    if L.get("shadow"):
        sh = L["shadow"]
        s_img = np.zeros((H, W), np.float32); s_img[sl] = sil
        s_img = ndi.shift(s_img, (sh.get("dy", 6), sh.get("dx", 4)), order=1)
        s_img = ndi.gaussian_filter(s_img, sh.get("blur", 6)) * sh.get("opacity", 0.18)
        out *= (1 - s_img[..., None])
    printed = 1 - la[..., None] + la[..., None] * lc
    region = out[sl]
    if blend == "lift":  # the painting on its own white paper, laid on dark stock
        region = region * (1 - sil[..., None]) + printed * sil[..., None]
    else:
        region = region * (1 - sil[..., None]) + base_paper[sl] * sil[..., None]
        region = region * printed
    out[sl] = region

img = Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8), "RGB")
img.save(a.out, quality=R.get("quality", 84), optimize=True, progressive=True, subsampling="4:4:4" if R.get("chroma444") else "4:2:0")
if a.thumb:
    img.resize((360, 450), Image.LANCZOS).save(a.thumb, quality=78, optimize=True, progressive=True)
if a.guides:
    g = img.copy(); d = ImageDraw.Draw(g)
    c = R.get("content", {"x": 150, "w": 780, "top": 260})
    d.rectangle([c["x"], c["top"], c["x"] + c["w"], 880], outline=(255, 0, 0), width=3)
    d.rectangle([W / 2 - 200, 900, W / 2 + 200, H - R.get("bottomPad", 90)], outline=(0, 0, 255), width=3)
    g.save(a.guides, quality=80)
print(a.out, img.size)
