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
    pal = {"gold": ("#9E7B41", "#E6CF94", "#C29E5C"), "silver": ("#8E949C", "#E9ECEF", "#B4BAC2"), "rose": ("#A8735E", "#EBC3AE", "#C8927C"),
           "henna": ("#6B3520", "#9C5A34", "#7E4428")}[tone]
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

# ─────────────────────────── party, baby, graduation and henna ornament ───────────────────────────
BALLOON_COLORS = {
    "gold": ("#C9A55E", True), "silver": ("#C3C8CF", True), "rose": ("#D9A48E", True),
    "blush": ("#F2C4C4", False), "sky": ("#B9D3EC", False), "ivory": ("#F4EEDF", False), "sage": ("#C5D6BC", False),
    "lilac": ("#D3C4E6", False), "butter": ("#F3E1A0", False), "coral": ("#EE9C86", False), "red": ("#C8434A", False), "navy": ("#33456E", False),
}

def _rgba(col, a):
    return Image.fromarray((np.dstack([np.clip(col, 0, 1), np.clip(a, 0, 1)]) * 255).round().astype(np.uint8), "RGBA")

def balloon(size=260, color="gold", string=1.6, seed=0):
    """A shaded balloon (foil or satin latex) with its knot and a curling ribbon. Returns RGBA, string hanging below."""
    r = np.random.default_rng(seed)
    base, metal = BALLOON_COLORS[color]
    bw, bh = size, int(size * 1.18)
    H = int(bh + size * string)
    W = int(size * 1.3)
    cx, cy = W / 2, bh * 0.5
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32) + 0.5
    # egg shape: wider at the top
    ny = (yy - cy) / (bh * 0.5)
    rx = bw * 0.5 * (1 - 0.13 * np.clip(ny, 0, 1) ** 1.6)
    nx = (xx - cx) / rx
    d2 = nx ** 2 + ny ** 2
    inside = np.clip((1 - d2) * size * 0.25, 0, 1)
    nz = np.sqrt(np.clip(1 - d2, 0, 1))
    L = np.array([-0.45, -0.55, 0.7]); L /= np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    Hh = L + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
    spec = np.clip(nx * Hh[0] + ny * Hh[1] + nz * Hh[2], 0, 1) ** (60 if metal else 16)
    c = hx3(base)
    if metal:
        band = 0.5 + 0.5 * np.sin((nx * 2.2 + ny * 3.0) * math.pi * 0.9)
        shade = 0.42 + 0.55 * diff + 0.25 * band * nz
        col = c[None, None, :] * shade[..., None] + spec[..., None] * 0.95
    else:
        shade = 0.62 + 0.42 * diff
        rim = np.clip(1 - nz, 0, 1) ** 3 * 0.18  # translucent latex: lighter rim
        col = c[None, None, :] * shade[..., None] + spec[..., None] * 0.45 + rim[..., None]
    a = inside.copy()
    # knot
    kn = Image.new("L", (W * S, H * S), 0); kd = ImageDraw.Draw(kn)
    kx, ky = cx * S, bh * S
    kd.polygon([(kx - size * 0.05 * S, ky + size * 0.06 * S), (kx + size * 0.05 * S, ky + size * 0.06 * S), (kx, ky - size * 0.03 * S)], fill=255)
    # ribbon: a gentle S-curve with a curl
    pts = []
    L0 = size * string * 0.96
    ph = r.uniform(0, math.pi)
    for i in range(80):
        t = i / 79
        x = kx + math.sin(t * math.pi * 2.2 + ph) * size * 0.09 * S * (0.4 + t)
        y = ky + size * 0.05 * S + t * L0 * S
        pts.append((x, y))
    sd = Image.new("L", (W * S, H * S), 0); sdd = ImageDraw.Draw(sd)
    sdd.line(pts, fill=255, width=max(1, round(size * 0.012 * S)), joint="curve")
    kna = np.asarray(kn.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    sta = np.asarray(sd.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255 * 0.85
    knot_col = c * (0.75 if metal else 0.82)
    col = col * a[..., None] + knot_col[None, None, :] * kna[..., None] * (1 - a[..., None])
    a = np.maximum(a, kna)
    scol = hx3("#B59A66") if metal else c * 0.7 + 0.15
    col = col * (1 - sta[..., None] * (1 - a[..., None])) + scol[None, None, :] * sta[..., None] * (1 - a[..., None])
    a = np.maximum(a, sta)
    grain = ndi.gaussian_filter(r.standard_normal((H, W)).astype(np.float32), 0.8) * 0.02
    col = col + grain[..., None]
    return _rgba(col, a)

def hx3(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255

def balloon_bunch(colors=("gold", "blush", "ivory"), size=230, seed=1):
    """Three to five balloons whose ribbons gather to one point below."""
    r = np.random.default_rng(seed)
    n = len(colors)
    W, H = int(size * 2.6), int(size * 3.6)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gx, gy = W / 2, H * 0.97
    offs = [(-0.55, 0.28), (0.5, 0.22), (0.0, 0.02), (-0.1, 0.45), (0.62, 0.5)][:n]
    order = sorted(range(n), key=lambda i: offs[i][1])
    for i in order:
        ox, oy = offs[i]
        s = int(size * (0.92 + r.uniform(-0.06, 0.08)))
        b = balloon(s, colors[i], string=0.001, seed=seed * 10 + i)
        bx, by = gx + ox * size - b.width / 2, oy * size + 6
        canvas.alpha_composite(b, (int(bx), int(by)))
        # ribbon from the knot to the gathering point
        m = Image.new("L", (W * S, H * S), 0); d = ImageDraw.Draw(m)
        k = (gx + ox * size, by + s * 1.18 + s * 0.06)
        pts = [(k[0] + (gx - k[0]) * t + math.sin(t * math.pi * 2 + i) * 8 * (1 - t), k[1] + (gy - k[1]) * t) for t in np.linspace(0, 1, 60)]
        d.line([(x * S, y * S) for x, y in pts], fill=255, width=max(1, round(2.2 * S)), joint="curve")
        a = np.asarray(m.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255 * 0.8
        col = np.broadcast_to(hx3("#B9A27A"), (H, W, 3))
        canvas = Image.alpha_composite(_rgba(col, a), canvas)
    bow = ribbon_bow(int(size * 0.42), "gold" if "gold" in colors else "rose")
    canvas.alpha_composite(bow, (int(gx - bow.width / 2), int(gy - bow.height * 0.55)))
    return canvas

def confetti(w=1000, h=380, count=70, seed=4, palette=("gold",), density_top=True):
    """Scattered confetti: foil discs, paper squares and curling streamers."""
    r = np.random.default_rng(seed)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for i in range(count):
        tone = palette[i % len(palette)]
        foil_tone = tone if tone in ("gold", "silver", "rose") else None
        x, y = r.uniform(0.02, 0.98) * w, (r.uniform(0, 1) ** (1.6 if density_top else 1)) * h
        kind = r.random()
        s = int(r.choice([10, 13, 16, 20]))
        m, d = _canvas(s * 3, s * 3)
        c0 = s * 1.5 * S
        if kind < 0.45:
            d.ellipse([c0 - s * 0.5 * S, c0 - s * 0.5 * S, c0 + s * 0.5 * S, c0 + s * 0.5 * S], fill=255)
        elif kind < 0.8:
            ang = r.uniform(0, math.pi)
            pts = [(c0 + math.cos(ang + k * math.pi / 2) * s * 0.6 * S, c0 + math.sin(ang + k * math.pi / 2) * s * 0.35 * S) for k in range(4)]
            d.polygon(pts, fill=255)
        else:
            ph = r.uniform(0, 6)
            pts = [(c0 + (t - 0.5) * s * 2.6 * S, c0 + math.sin(t * 9 + ph) * s * 0.45 * S) for t in np.linspace(0, 1, 30)]
            d.line(pts, fill=255, width=max(1, round(s * 0.18 * S)), joint="curve")
        if foil_tone:
            piece = _finish(m, s * 3, s * 3, foil_tone)
        else:
            a = np.asarray(m.resize((s * 3, s * 3), Image.LANCZOS)).astype(np.float32) / 255
            col = np.broadcast_to(hx3(BALLOON_COLORS[tone][0]) * r.uniform(0.9, 1.02), (s * 3, s * 3, 3))
            piece = _rgba(col, a * 0.95)
        canvas.alpha_composite(piece, (int(x - s * 1.5), int(y - s * 1.5)))
    return canvas

def bunting(w=1080, h=230, flags=11, palette=("blush", "ivory", "sage", "butter", "sky"), sag=0.32, seed=3, foil=None):
    """A string of pennant flags across the top, sagging in the middle. Paper flags with soft folds, or foil."""
    r = np.random.default_rng(seed)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y0, depth = h * 0.06, h * sag
    curve = lambda x: y0 + depth * (1 - ((x / w) * 2 - 1) ** 2)
    m = Image.new("L", (w * S, h * S), 0); d = ImageDraw.Draw(m)
    d.line([(x * S, curve(x) * S) for x in np.linspace(-10, w + 10, 120)], fill=255, width=max(1, round(2 * S)), joint="curve")
    a = np.asarray(m.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255 * 0.85
    canvas.alpha_composite(_rgba(np.broadcast_to(hx3("#A89470"), (h, w, 3)), a))
    fw = w / flags
    for i in range(flags):
        x0, x1 = i * fw + fw * 0.1, (i + 1) * fw - fw * 0.1
        xm = (x0 + x1) / 2
        p = [(x0, curve(x0)), (x1, curve(x1)), (xm + r.uniform(-4, 4), (curve(xm) + fw * 0.95))]
        fm = Image.new("L", (w * S, h * S), 0); fd = ImageDraw.Draw(fm)
        fd.polygon([(px * S, py * S) for px, py in p], fill=255)
        fa = np.asarray(fm.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
        if foil:
            piece = _foil(fa, foil)
        else:
            tone = palette[i % len(palette)]
            c = hx3(BALLOON_COLORS[tone][0])
            yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
            fold = 1 - 0.08 * np.abs(np.sin((xx - xm) / fw * math.pi * 1.4)) - 0.06 * ((yy - curve(xm)) / (fw * 0.95))
            noise = ndi.gaussian_filter(r.standard_normal((h, w)).astype(np.float32), 1.2) * 0.025
            col = c[None, None, :] * (fold + noise)[..., None]
            piece = _rgba(col, fa)
        canvas.alpha_composite(piece)
    return canvas

def mortarboard(size=300, tone="gold"):
    """A graduation cap seen from the front, with its tassel."""
    w, h = size, int(size * 0.95)
    m, d = _canvas(w, h)
    W_, H_ = w * S, h * S
    top = [(W_ * 0.5, H_ * 0.08), (W_ * 0.98, H_ * 0.3), (W_ * 0.5, H_ * 0.52), (W_ * 0.02, H_ * 0.3)]
    d.polygon(top, fill=255)
    d.polygon([(W_ * 0.24, H_ * 0.43), (W_ * 0.76, H_ * 0.43), (W_ * 0.74, H_ * 0.7), (W_ * 0.5, H_ * 0.76), (W_ * 0.26, H_ * 0.7)], fill=255)
    # separate the skull cap from the board with a thin gap
    d.line([(W_ * 0.24, H_ * 0.43), (W_ * 0.5, H_ * 0.555), (W_ * 0.76, H_ * 0.43)], fill=0, width=round(size * 0.018 * S))
    d.ellipse([W_ * 0.47, H_ * 0.27, W_ * 0.53, H_ * 0.33], fill=0)
    d.ellipse([W_ * 0.48, H_ * 0.28, W_ * 0.52, H_ * 0.32], fill=255)
    cord = [(W_ * 0.5, H_ * 0.3), (W_ * 0.7, H_ * 0.36), (W_ * 0.86, H_ * 0.33)]
    d.line(cord, fill=255, width=round(size * 0.014 * S), joint="curve")
    d.line([(W_ * 0.86, H_ * 0.33), (W_ * 0.87, H_ * 0.62)], fill=255, width=round(size * 0.014 * S))
    d.polygon([(W_ * 0.84, H_ * 0.62), (W_ * 0.9, H_ * 0.62), (W_ * 0.93, H_ * 0.84), (W_ * 0.81, H_ * 0.84)], fill=255)
    return _finish(m, w, h, tone)

def laurel_wreath(size=420, tone="gold", gap=70, leaves=13, seed=2):
    """Two laurel branches curving up from a tied base, open at the top."""
    r = np.random.default_rng(seed)
    m, d = _canvas(size, size)
    c = size * S / 2; R = size * S * 0.4
    lw = max(1, round(size * 0.012 * S))
    for side in (-1, 1):
        a0, a1 = math.radians(98), math.radians(270 - gap / 2)
        pts = []
        for t in np.linspace(0, 1, 60):
            a = a0 + (a1 - a0) * t
            pts.append((c + side * R * math.cos(a), c + R * math.sin(a)))
        d.line(pts, fill=255, width=lw, joint="curve")
        for k in range(leaves):
            t = (k + 0.6) / leaves
            a = a0 + (a1 - a0) * t
            px, py = c + side * R * math.cos(a), c + R * math.sin(a)
            tang = math.atan2(math.cos(a), -side * math.sin(a))
            L = size * S * (0.1 - 0.03 * t); Wd = L * 0.34
            for out in (1, -1):
                ang = tang + out * 0.62 * side + (math.pi if side < 0 else 0)
                ang = math.atan2(math.sin(a) * 0 + math.sin(tang + out * 0.6), math.cos(tang + out * 0.6))
                lx, ly = px + math.cos(ang) * L * 0.55, py + math.sin(ang) * L * 0.55
                poly = []
                for u in np.linspace(0, 2 * math.pi, 24):
                    ex, ey = math.cos(u) * L * 0.55, math.sin(u) * Wd * 0.5
                    poly.append((lx + ex * math.cos(ang) - ey * math.sin(ang), ly + ex * math.sin(ang) + ey * math.cos(ang)))
                d.polygon(poly, fill=255)
            if k % 3 == 1:
                bx, by = px - side * R * 0.06 * math.cos(a), py - R * 0.06 * math.sin(a)
                d.ellipse([bx - lw * 2.4, by - lw * 2.4, bx + lw * 2.4, by + lw * 2.4], fill=255)
    # ribbon tie at the bottom
    d.ellipse([c - size * S * 0.02, c + R - size * S * 0.02, c + size * S * 0.02, c + R + size * S * 0.022], fill=255)
    for side in (-1, 1):
        d.polygon([(c, c + R + size * S * 0.005), (c + side * size * S * 0.055, c + R + size * S * 0.085), (c + side * size * S * 0.03, c + R + size * S * 0.095)], fill=255)
    return _finish(m, size, size, tone)

def ribbon_bow(size=160, tone="gold"):
    """A tied bow with two tails."""
    w, h = size, int(size * 0.9)
    m, d = _canvas(w, h)
    W_, H_ = w * S, h * S; cx, cy = W_ / 2, H_ * 0.38
    for side in (-1, 1):
        loop = [(cx, cy)]
        for u in np.linspace(-0.9, 0.9, 30):
            loop.append((cx + side * W_ * 0.44 * math.cos(u) ** 0.6, cy + H_ * 0.3 * math.sin(u)))
        d.polygon(loop, fill=255)
        d.polygon([(cx, cy), (cx + side * W_ * 0.12, cy + H_ * 0.08), (cx + side * W_ * 0.3, H_ * 0.96), (cx + side * W_ * 0.2, H_ * 0.9), (cx + side * W_ * 0.04, cy + H_ * 0.1)], fill=255)
        d.line([(cx + side * W_ * 0.05, cy - H_ * 0.12), (cx + side * W_ * 0.3, cy - H_ * 0.06)], fill=0, width=max(1, round(1.2 * S)))
    d.ellipse([cx - W_ * 0.08, cy - H_ * 0.1, cx + W_ * 0.08, cy + H_ * 0.1], fill=255)
    return _finish(m, w, h, tone)

def heart(size=90, tone="gold"):
    m, d = _canvas(size, size)
    s = size * S
    pts = [(s / 2 + 16 * math.sin(t) ** 3 * s / 36, s * 0.47 - (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) * s / 36) for t in np.linspace(0, 2 * math.pi, 100)]
    d.polygon(pts, fill=255)
    return _finish(m, size, size, tone)

def hearts(w=1000, h=360, count=16, seed=5, tone="rose", sizes=(18, 24, 30, 40)):
    r = np.random.default_rng(seed)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for _ in range(count):
        s = int(r.choice(sizes))
        hh = heart(s, tone).rotate(r.uniform(-25, 25), resample=Image.BICUBIC, expand=True)
        canvas.alpha_composite(hh, (int(r.uniform(0.02, 0.95) * w), int(r.uniform(0.02, 0.9) * h)))
    return canvas

def crown(size=220, tone="gold"):
    w, h = size, int(size * 0.72)
    m, d = _canvas(w, h)
    W_, H_ = w * S, h * S
    pts = [(W_ * 0.06, H_ * 0.88), (W_ * 0.02, H_ * 0.3), (W_ * 0.27, H_ * 0.58), (W_ * 0.5, H_ * 0.12), (W_ * 0.73, H_ * 0.58), (W_ * 0.98, H_ * 0.3), (W_ * 0.94, H_ * 0.88)]
    d.polygon(pts, fill=255)
    for x, y in ((0.02, 0.3), (0.5, 0.12), (0.98, 0.3)):
        rr = W_ * 0.045
        d.ellipse([W_ * x - rr, H_ * y - rr * 1.6, W_ * x + rr, H_ * y + rr * 0.4], fill=255)
    d.rectangle([W_ * 0.06, H_ * 0.76, W_ * 0.94, H_ * 0.8], fill=0)
    for x in (0.25, 0.5, 0.75):
        rr = W_ * 0.035
        d.ellipse([W_ * x - rr, H_ * 0.68 - rr, W_ * x + rr, H_ * 0.68 + rr], fill=0)
        d.ellipse([W_ * x - rr * 0.6, H_ * 0.68 - rr * 0.6, W_ * x + rr * 0.6, H_ * 0.68 + rr * 0.6], fill=255)
    return _finish(m, w, h, tone)

def _petal(d, cx, cy, ang, L, Wd, fill=255, outline=None, width=1):
    poly = []
    for u in np.linspace(0, 1, 22):
        rr = math.sin(u * math.pi) ** 0.8 * Wd * (1 - u * 0.35)
        poly.append((u * L, rr))
    poly += [(u, -v) for u, v in reversed(poly)]
    pts = [(cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang)) for x, y in poly]
    if outline is None: d.polygon(pts, fill=fill)
    else: d.line(pts + [pts[0]], fill=outline, width=width)

def mandala(size=520, tone="gold", rings=4, seed=1):
    """A henna-style rosette: rings of petals, dots and scallops around a flower."""
    r = np.random.default_rng(seed)
    m, d = _canvas(size, size)
    c = size * S / 2; R = size * S * 0.48
    lw = max(1, round(size * 0.0065 * S))
    d.ellipse([c - R * 0.12, c - R * 0.12, c + R * 0.12, c + R * 0.12], fill=255)
    n = 8
    for k in range(n):
        _petal(d, c, c, k * 2 * math.pi / n, R * 0.3, R * 0.07)
    radius = R * 0.33
    for ring in range(rings):
        n = 12 + ring * 6
        step = (R - R * 0.36) / rings
        d.ellipse([c - radius, c - radius, c + radius, c + radius], outline=255, width=lw)
        for k in range(n):
            a = (k + 0.5 * (ring % 2)) * 2 * math.pi / n
            if ring % 2 == 0:
                _petal(d, c + math.cos(a) * radius, c + math.sin(a) * radius, a, step * 0.9, step * 0.22, outline=255, width=lw)
                dx, dy = c + math.cos(a) * (radius + step * 0.45), c + math.sin(a) * (radius + step * 0.45)
                rr = lw * 1.4
                d.ellipse([dx - rr, dy - rr, dx + rr, dy + rr], fill=255)
            else:
                rr = step * 0.25
                px, py = c + math.cos(a) * (radius + step * 0.5), c + math.sin(a) * (radius + step * 0.5)
                d.arc([px - rr, py - rr, px + rr, py + rr], math.degrees(a) - 90, math.degrees(a) + 90, fill=255, width=lw)
                rr2 = lw * 1.8
                d.ellipse([px - rr2, py - rr2, px + rr2, py + rr2], fill=255)
        radius += step
    for k in range(48):
        a = k * 2 * math.pi / 48
        px, py = c + math.cos(a) * R * 0.985, c + math.sin(a) * R * 0.985
        rr = lw * 1.3
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=255)
    return _finish(m, size, size, tone)

def _bez(p0, p1, p2, p3, n=40):
    return [((1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0],
             (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]) for t in np.linspace(0, 1, n)]

def paisley(size=220, tone="gold", flip=False):
    """A buta (paisley): a round body whose tip curls over, with an inner outline, a small flower and a dotted edge."""
    w, h = size, int(size * 1.25)
    m, d = _canvas(w, h)
    W_, H_ = w * S, h * S
    lw = max(1, round(size * 0.012 * S))
    T, P1, P2 = (0.86, 0.05), (0.13, 0.62), (0.8, 0.68)
    outline = _bez(T, (0.36, -0.02), (0.06, 0.32), P1) + _bez(P1, (0.18, 1.0), (0.8, 1.02), P2) + _bez(P2, (0.84, 0.4), (0.58, 0.3), T)
    def path(scale, cx=0.47, cy=0.64):
        return [(W_ * (cx + (x - cx) * scale), H_ * (cy + (y - cy) * scale)) for x, y in outline]
    d.line(path(1.0) + [path(1.0)[0]], fill=255, width=lw * 2, joint="curve")
    d.line(path(0.7) + [path(0.7)[0]], fill=255, width=lw, joint="curve")
    cx, cy = W_ * 0.47, H_ * 0.68
    for k in range(6):
        _petal(d, cx, cy, k * math.pi / 3, W_ * 0.12, W_ * 0.035)
    d.ellipse([cx - lw * 3, cy - lw * 3, cx + lw * 3, cy + lw * 3], fill=0)
    for x, y in path(1.12)[2:-2:4]:
        d.ellipse([x - lw * 1.3, y - lw * 1.3, x + lw * 1.3, y + lw * 1.3], fill=255)
    img = _finish(m, w, h, tone)
    return img.transpose(Image.FLIP_LEFT_RIGHT) if flip else img

def rainbow(w=620, h=330, seed=3, opacity=0.6, colors=("#F2B8B5", "#F6D7A7", "#F3EBB0", "#CFE3C1", "#BBD4EA", "#D5C8E6")):
    """A soft watercolour rainbow (normal blend)."""
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w / 2, h * 0.98
    dist = np.sqrt(((xx - cx) / (w * 0.48)) ** 2 + ((yy - cy) / (h * 0.92)) ** 2)
    noise = ndi.gaussian_filter(r.standard_normal((h, w)).astype(np.float32), 5) * 0.03
    dist = dist + noise
    n = len(colors); inner = 0.52
    col = np.zeros((h, w, 3), np.float32); a = np.zeros((h, w), np.float32)
    for i, c in enumerate(colors):
        lo = 1 - (i + 1) * (1 - inner) / n; hi = 1 - i * (1 - inner) / n
        band = np.clip(np.minimum(dist - lo, hi - dist) * 160, 0, 1)
        col += band[..., None] * hx3(c)[None, None, :]
        a = np.maximum(a, band)
    col = col / np.maximum(a[..., None], 1e-4)
    a = ndi.gaussian_filter(a, 1.6) * opacity * (1 - np.clip((yy - h * 0.86) / (h * 0.14), 0, 1))
    return _rgba(col, a)

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
