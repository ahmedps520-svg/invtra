"""Procedural ornament as RGBA cut-outs (same format as the painted cut-outs): gold foil with a soft
emboss, or soft watercolour (clouds). Each function returns a PIL RGBA image; `save_all()` writes
the library to artdata/cut/g-*.png.
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

S = 3  # supersampling
rng = np.random.default_rng(11)

def _foil(mask, tone="gold"):
    """mask: float 0..1 (H, W) at final size → RGBA foil with emboss and grain."""
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    pal = {"gold": ("#9E7B41", "#E6CF94", "#C29E5C"), "silver": ("#8E949C", "#E9ECEF", "#B4BAC2"), "rose": ("#A8735E", "#EBC3AE", "#C8927C")}[tone]
    c = [np.array([int(p[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255 for p in pal]
    t = ((xx * 0.8 + yy) / (w * 0.8 + h) * 5) % 2
    base = np.where((t < 1)[..., None], c[0] * (1 - t[..., None]) + c[1] * t[..., None], c[1] * (2 - t[..., None]) + c[2] * (t[..., None] - 1))
    soft = ndi.gaussian_filter(mask, 1.6)
    gy, gx = np.gradient(soft)
    shade = (-gx - gy) * 6
    grain = ndi.gaussian_filter(rng.standard_normal((h, w)).astype(np.float32), 0.7) * 0.035
    col = np.clip(base * (1 + 0.35 * shade[..., None] + grain[..., None]), 0, 1)
    rgba = np.dstack([col, np.clip(mask, 0, 1)])
    return Image.fromarray((rgba * 255).round().astype(np.uint8), "RGBA")

def _canvas(w, h):
    m = Image.new("L", (w * S, h * S), 0)
    return m, ImageDraw.Draw(m)

def _finish(m, w, h, tone="gold"):
    a = np.asarray(m.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    return _foil(a, tone)

def crescent(size=300, tone="gold", angle=-25):
    w = h = size
    m, d = _canvas(w, h)
    r = size * S * 0.46; cx = cy = size * S / 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    a = math.radians(angle); off = r * 0.42
    r2 = r * 0.86
    d.ellipse([cx + off * math.cos(a) - r2, cy + off * math.sin(a) - r2, cx + off * math.cos(a) + r2, cy + off * math.sin(a) + r2], fill=0)
    return _finish(m, w, h, tone)

def star_points(cx, cy, r, n=8, inner=0.55, rot=0):
    pts = []
    for i in range(n * 2):
        a = math.pi / n * i - math.pi / 2 + rot
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts

def star(size=120, n=8, inner=0.55, tone="gold"):
    m, d = _canvas(size, size)
    c = size * S / 2
    d.polygon(star_points(c, c, c * 0.96, n, inner), fill=255)
    return _finish(m, size, size, tone)

def sparkle(size=80, tone="gold"):
    m, d = _canvas(size, size)
    c = size * S / 2
    d.polygon(star_points(c, c, c * 0.96, 4, 0.22), fill=255)
    return _finish(m, size, size, tone)

def starfield(w=1080, h=420, count=26, seed=3, tone="gold"):
    r = np.random.default_rng(seed)
    m, d = _canvas(w, h)
    for _ in range(count):
        x, y = r.uniform(0.04, 0.96) * w * S, r.uniform(0.05, 0.95) * h * S
        s = r.choice([7, 9, 12, 16, 22]) * S
        kind = r.random()
        if kind < 0.45:
            d.polygon(star_points(x, y, s, 4, 0.25), fill=255)
        elif kind < 0.75:
            d.polygon(star_points(x, y, s * 0.8, 8, 0.55), fill=255)
        else:
            d.ellipse([x - s * 0.25, y - s * 0.25, x + s * 0.25, y + s * 0.25], fill=255)
    return _finish(m, w, h, tone)

def _khatam_tile(d, x, y, s, lw):
    """One 8-point star (two squares) in a cell of size s, outlined."""
    c = (x + s / 2, y + s / 2); r = s * 0.42
    sq1 = [(c[0] - r, c[1] - r), (c[0] + r, c[1] - r), (c[0] + r, c[1] + r), (c[0] - r, c[1] + r)]
    rr = r * math.sqrt(2)
    sq2 = [(c[0], c[1] - rr), (c[0] + rr, c[1]), (c[0], c[1] + rr), (c[0] - rr, c[1])]
    d.polygon(star_points(c[0], c[1], rr, 8, 0.77, rot=math.pi / 8), outline=255, width=lw)
    d.line([(x, y), (x + s, y + s)], fill=0, width=1)

def geometric_band(w=1080, h=90, cell=None, lw=2.2, tone="gold"):
    """A band of interlaced 8-point stars and crosses (khatam), with rules above and below."""
    cell = cell or h * 0.78
    m, d = _canvas(w, h)
    L = max(1, round(lw * S)); cs = cell * S
    y0 = (h * S - cs) / 2
    n = int(w * S // cs) + 2
    x0 = (w * S - n * cs) / 2
    for i in range(n):
        cx = x0 + i * cs + cs / 2; cy = y0 + cs / 2
        d.polygon(star_points(cx, cy, cs * 0.5, 8, 0.72, rot=math.pi / 8), outline=255, width=L)
        d.polygon(star_points(cx, cy, cs * 0.24, 8, 0.72, rot=math.pi / 8), fill=255)
        if i < n - 1:
            mx = cx + cs / 2
            d.polygon([(mx, cy - cs * 0.22), (mx + cs * 0.12, cy), (mx, cy + cs * 0.22), (mx - cs * 0.12, cy)], outline=255, width=L)
    d.line([(0, L), (w * S, L)], fill=255, width=L); d.line([(0, h * S - L), (w * S, h * S - L)], fill=255, width=L)
    return _finish(m, w, h, tone)

def pattern_field(w=1080, h=1350, cell=120, lw=1.4, tone="gold"):
    """Full tessellation of 8-point stars (for a faint background)."""
    m, d = _canvas(w, h)
    L = max(1, round(lw * S)); cs = cell * S
    for yi in range(-1, int(h * S // cs) + 2):
        for xi in range(-1, int(w * S // cs) + 2):
            cx = xi * cs + (cs / 2 if yi % 2 else 0); cy = yi * cs * 0.87
            d.polygon(star_points(cx, cy, cs * 0.46, 8, 0.72, rot=math.pi / 8), outline=255, width=L)
    return _finish(m, w, h, tone)

def arch_frame(w=1080, h=1350, inset=70, top=60, lw=2.4, double=True, tone="gold"):
    """A pointed (Islamic) arch running down to the bottom edge, with a small finial."""
    m, d = _canvas(w, h)
    L = max(1, round(lw * S))
    def arch(ins, tp, width):
        x0, x1 = ins * S, (w - ins) * S
        B = x1 - x0; r = B * 0.62
        spring = tp * S + B * 0.55
        cl, cr = x0 + r, x1 - r
        apex_x = (x0 + x1) / 2
        a = math.acos((apex_x - cl) / r)
        left = [(cl + r * math.cos(t), spring - r * math.sin(t)) for t in np.linspace(math.pi, a, 60)]
        right = [(cr + r * math.cos(t), spring - r * math.sin(t)) for t in np.linspace(math.pi - a, 0, 60)]
        bottom = (h - ins) * S
        path = [(x0, bottom), (x0, spring)] + left + right + [(x1, spring), (x1, bottom), (x0, bottom)]
        d.line(path, fill=255, width=width, joint="curve")
        return left[-1]
    apex = arch(inset, top, L)
    if double:
        arch(inset + 12, top + 12, max(1, L // 2))
    ax, ay = apex
    d.polygon(star_points(ax, ay - 22 * S, 16 * S, 8, 0.55), fill=255)
    return _finish(m, w, h, tone)

def lantern(height=420, style=0, glow=True, tone="gold", chain=0):
    """A Ramadan fanous: chain and ring, domed cap, faceted body with lit panes, pointed base."""
    w = int(height * 0.42); hh = height + chain
    m, d = _canvas(w, hh)
    glowm, gd = _canvas(w, hh)
    cx = w * S / 2; top = chain * S; H = height * S; W = w * S
    L = max(2, round(3.2 * S))
    if chain:
        d.line([(cx, 0), (cx, top + H * 0.04)], fill=255, width=max(1, round(1.6 * S)))
    d.ellipse([cx - W * 0.07, top, cx + W * 0.07, top + W * 0.14], outline=255, width=L)
    cap_top, cap_bot = top + H * 0.07, top + H * 0.24
    if style % 3 == 0:  # dome
        d.chord([cx - W * 0.36, cap_top, cx + W * 0.36, cap_bot + (cap_bot - cap_top)], 180, 360, fill=255)
    elif style % 3 == 1:  # onion
        d.polygon([(cx, cap_top), (cx + W * 0.16, cap_top + (cap_bot - cap_top) * 0.45), (cx + W * 0.36, cap_bot), (cx - W * 0.36, cap_bot), (cx - W * 0.16, cap_top + (cap_bot - cap_top) * 0.45)], fill=255)
    else:  # pyramid
        d.polygon([(cx, cap_top), (cx + W * 0.38, cap_bot), (cx - W * 0.38, cap_bot)], fill=255)
    d.rectangle([cx - W * 0.42, cap_bot, cx + W * 0.42, cap_bot + H * 0.025], fill=255)
    b0, b1 = cap_bot + H * 0.025, top + H * 0.74
    bw = W * (0.44 if style % 2 == 0 else 0.4)
    body = [(cx - bw, b0), (cx + bw, b0), (cx + bw * 0.86, b1), (cx - bw * 0.86, b1)]
    d.polygon(body, outline=255, width=L)
    gd.polygon(body, fill=255)
    panes = 3
    for i in range(1, panes):
        x = cx - bw + 2 * bw * i / panes
        d.line([(x, b0), (cx + (x - cx) * 0.86, b1)], fill=255, width=max(1, L // 2))
    # filigree: arches and small stars in each pane
    for i in range(panes):
        px0 = cx - bw + 2 * bw * i / panes; px1 = cx - bw + 2 * bw * (i + 1) / panes
        pcx = (px0 + px1) / 2; pw = (px1 - px0) * 0.36
        ay0 = b0 + (b1 - b0) * 0.18
        d.arc([pcx - pw, ay0, pcx + pw, ay0 + pw * 2], 180, 360, fill=255, width=max(1, L // 2))
        d.polygon(star_points(pcx, b0 + (b1 - b0) * 0.62, pw * 0.5, 8, 0.55), fill=255)
    d.rectangle([cx - bw * 0.9, b1, cx + bw * 0.9, b1 + H * 0.025], fill=255)
    base_bot = top + H * 0.9
    d.polygon([(cx - bw * 0.7, b1 + H * 0.025), (cx + bw * 0.7, b1 + H * 0.025), (cx + W * 0.06, base_bot), (cx - W * 0.06, base_bot)], fill=255)
    d.ellipse([cx - W * 0.05, base_bot - W * 0.02, cx + W * 0.05, top + H * 0.98], fill=255)
    img = _finish(m, w, hh, tone)
    if glow:
        # Lit glass: brightest in the middle of the body, fading to the frame.
        g = np.asarray(glowm.resize((w, hh), Image.LANCZOS)).astype(np.float32) / 255
        yy, xx = np.mgrid[0:hh, 0:w].astype(np.float32)
        gy = (b0 + b1) / 2 / S
        radial = np.clip(1 - np.sqrt(((xx - w / 2) / (w * 0.42)) ** 2 + ((yy - gy) / ((b1 - b0) / S * 0.62)) ** 2), 0, 1)
        g = ndi.gaussian_filter(g, 2) * (0.16 + 0.5 * radial)
        warm = np.zeros((hh, w, 4), np.float32); warm[..., 0], warm[..., 1], warm[..., 2] = 1.0, 0.9, 0.62; warm[..., 3] = g
        a = np.asarray(img).astype(np.float32) / 255
        out_a = a[..., 3] + warm[..., 3] * (1 - a[..., 3])
        out_c = (a[..., :3] * a[..., 3:4] + warm[..., :3] * warm[..., 3:4] * (1 - a[..., 3:4])) / np.maximum(out_a[..., None], 1e-4)
        img = Image.fromarray((np.dstack([out_c, out_a]) * 255).round().astype(np.uint8), "RGBA")
    return img

def skyline(w=1080, h=230, tone="gold", seed=1):
    """Domes and minarets as a flat foil silhouette."""
    r = np.random.default_rng(seed)
    m, d = _canvas(w, h)
    base = h * S
    d.rectangle([0, base - 18 * S, w * S, base], fill=255)
    def dome(cx, rw, rh, y):
        d.chord([cx - rw, y - rh, cx + rw, y + rh], 180, 360, fill=255)
        d.rectangle([cx - rw, y, cx + rw, base], fill=255)
        d.polygon([(cx, y - rh - 34 * S), (cx + 4 * S, y - rh), (cx - 4 * S, y - rh)], fill=255)
        d.ellipse([cx - 6 * S, y - rh - 46 * S, cx + 6 * S, y - rh - 34 * S], fill=255)
    def minaret(cx, mh):
        bw = 14 * S
        d.rectangle([cx - bw, base - mh, cx + bw, base], fill=255)
        d.rectangle([cx - bw * 1.6, base - mh * 0.72, cx + bw * 1.6, base - mh * 0.72 + 8 * S], fill=255)
        d.polygon([(cx - bw, base - mh), (cx + bw, base - mh), (cx, base - mh - 50 * S)], fill=255)
    W = w * S
    dome(W * 0.5, 120 * S, 110 * S, base - 70 * S)
    for side in (-1, 1):
        dome(W * 0.5 + side * 210 * S, 62 * S, 58 * S, base - 48 * S)
        minaret(W * 0.5 + side * 330 * S, 200 * S)
        dome(W * 0.5 + side * 430 * S, 40 * S, 36 * S, base - 36 * S)
    return _finish(m, w, h, tone)

def cloud(w=420, h=200, color=(1.0, 1.0, 1.0), seed=2, opacity=0.92):
    """A soft watercolour cloud (normal blend)."""
    r = np.random.default_rng(seed)
    m = Image.new("L", (w * S, h * S), 0); d = ImageDraw.Draw(m)
    n = 6
    for i in range(n):
        cx = (0.16 + 0.68 * i / (n - 1)) * w * S
        rr = (0.22 + 0.16 * math.sin(math.pi * i / (n - 1)) + r.uniform(-0.03, 0.03)) * h * S * 1.15
        cy = h * S * 0.68 - rr * 0.55
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=255)
    d.rectangle([w * S * 0.12, h * S * 0.55, w * S * 0.88, h * S * 0.8], fill=255)
    a = np.asarray(m.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    noise = ndi.gaussian_filter(r.standard_normal((h, w)).astype(np.float32), 6)
    a = np.clip(ndi.gaussian_filter(a, 4) + noise * 0.15, 0, 1) * opacity
    shade = np.clip(1 - (np.mgrid[0:h, 0:w][0] / h) * 0.12, 0, 1)
    col = np.dstack([np.full((h, w), c, np.float32) * shade for c in color])
    return Image.fromarray((np.dstack([col, a]) * 255).round().astype(np.uint8), "RGBA")

def dots(w=1080, h=300, count=40, seed=5, tone="gold"):
    r = np.random.default_rng(seed)
    m, d = _canvas(w, h)
    for _ in range(count):
        x, y = r.uniform(0, w) * S, r.uniform(0, h) * S; s = r.choice([3, 4, 5, 7]) * S
        d.ellipse([x - s, y - s, x + s, y + s], fill=255)
    return _finish(m, w, h, tone)

def save_all(outdir="artdata/cut"):
    os.makedirs(outdir, exist_ok=True)
    items = {}
    for tone in ("gold", "silver", "rose"):
        t = "" if tone == "gold" else f"-{tone}"
        items[f"g-crescent{t}"] = crescent(340, tone)
        items[f"g-crescent-r{t}"] = crescent(340, tone, angle=205)
        items[f"g-star8{t}"] = star(140, 8, 0.55, tone)
        items[f"g-sparkle{t}"] = sparkle(90, tone)
        items[f"g-stars{t}"] = starfield(1000, 380, 26, 3, tone)
        items[f"g-stars2{t}"] = starfield(1000, 380, 18, 9, tone)
        items[f"g-dots{t}"] = dots(1000, 300, 40, 5, tone)
    for tone in ("gold", "silver"):
        t = "" if tone == "gold" else f"-{tone}"
        items[f"g-band{t}"] = geometric_band(1080, 86, tone=tone)
        items[f"g-band-thin{t}"] = geometric_band(1080, 56, lw=1.8, tone=tone)
        items[f"g-pattern{t}"] = pattern_field(1080, 1350, 120, 1.2, tone)
        items[f"g-arch{t}"] = arch_frame(1080, 1350, 72, 70, tone=tone)
        items[f"g-skyline{t}"] = skyline(1080, 230, tone)
        for s in range(3):
            items[f"g-lantern{s}{t}"] = lantern(420, s, True, tone)
            items[f"g-lantern{s}-plain{t}"] = lantern(420, s, False, tone)
    items["g-cloud"] = cloud(440, 210, (1, 1, 1), 2)
    items["g-cloud2"] = cloud(360, 170, (1, 1, 1), 7)
    items["g-cloud-blue"] = cloud(440, 210, (0.86, 0.91, 0.97), 4, 0.8)
    items["g-cloud-pink"] = cloud(440, 210, (0.98, 0.9, 0.92), 6, 0.8)
    for k, im in items.items():
        im.save(f"{outdir}/{k}.png")
    return list(items)

if __name__ == "__main__":
    names = save_all()
    print(len(names), "ornaments")
