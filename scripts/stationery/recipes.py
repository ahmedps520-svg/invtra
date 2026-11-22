"""Writes one recipe JSON per design (artdata/recipes/<key>.json).
grow(): a plant whose stem starts at `stem` (often just off the paper) and leans toward `toward`.
place(): a cut-out centred at (cx, cy) with an explicit rotation."""
import json, math, os, sys
from PIL import Image

CUT = "artdata/cut"
_sizes = {}
def size(src):
    if src not in _sizes:
        _sizes[src] = Image.open(f"{CUT}/{src}.png").size
    return _sizes[src]

def grow(src, w, stem, toward, flip=False, **kw):
    iw, ih = size(src)
    if kw.get("crop"):
        x0, y0, x1, y1 = kw["crop"]; iw, ih = iw * (x1 - x0), ih * (y1 - y0)
    h = ih * w / iw
    dx, dy = toward[0] - stem[0], toward[1] - stem[1]
    n = math.hypot(dx, dy); dx, dy = dx / n, dy / n
    th = math.atan2(-dx, -dy)
    cx = stem[0] - (h / 2) * math.sin(th)
    cy = stem[1] - (h / 2) * math.cos(th)
    return {"src": src, "cx": round(cx), "cy": round(cy), "w": w, "rot": round(math.degrees(th), 1), "flip": flip, **kw}

def bloom(src, w, head, up, flip=False, **kw):
    """The cut-out's top (its flowers) lands at `head`, facing direction `up`; the rest trails behind."""
    iw, ih = size(src)
    if kw.get("crop"):
        x0, y0, x1, y1 = kw["crop"]; iw, ih = iw * (x1 - x0), ih * (y1 - y0)
    h = ih * w / iw
    n = math.hypot(*up); ux, uy = up[0] / n, up[1] / n
    th = math.atan2(-ux, -uy)
    return {"src": src, "cx": round(head[0] - (h / 2) * ux), "cy": round(head[1] - (h / 2) * uy), "w": w, "rot": round(math.degrees(th), 1), "flip": flip, **kw}

_fc = {}
def flower_center(src, crop=None):
    """Where the petals are (fractions of the cut-out): non-green, painted pixels, weighted by how much paint."""
    key = (src, tuple(crop) if crop else None)
    if key not in _fc:
        import numpy as np
        im = Image.open(f"{CUT}/{src}.png").convert("RGBA")
        if crop:
            w0, h0 = im.size; im = im.crop((int(crop[0] * w0), int(crop[1] * h0), int(crop[2] * w0), int(crop[3] * h0)))
        a = np.asarray(im).astype(float) / 255
        hsv = np.asarray(im.convert("RGB").convert("HSV")).astype(float) / 255
        hue, sat, val = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
        green = (hue > 45) & (hue < 185) & (sat > 0.12)
        petal = (a[..., 3] > 0.25) & ~green
        wts = petal * a[..., 3]
        ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        tot = wts.sum()
        _fc[key] = ((xs * wts).sum() / tot / a.shape[1], (ys * wts).sum() / tot / a.shape[0]) if tot > 0 else (0.5, 0.25)
    return _fc[key]

def flower(src, w, at, up, flip=False, **kw):
    """The cut-out's flowers land at `at`; the plant grows along `up` (from its stem towards its flowers)."""
    iw, ih = size(src)
    crop = kw.get("crop")
    if crop:
        iw, ih = iw * (crop[2] - crop[0]), ih * (crop[3] - crop[1])
    h = ih * w / iw
    fx, fy = flower_center(src, crop)
    if flip: fx = 1 - fx
    v0 = ((fx - 0.5) * w, (fy - 1.0) * h)  # stem base (bottom centre) → flowers
    ang = lambda v: math.atan2(-v[1], v[0])
    th = ang(up) - ang(v0)
    d0 = ((fx - 0.5) * w, (fy - 0.5) * h)
    d = (d0[0] * math.cos(th) + d0[1] * math.sin(th), -d0[0] * math.sin(th) + d0[1] * math.cos(th))
    return {"src": src, "cx": round(at[0] - d[0]), "cy": round(at[1] - d[1]), "w": w, "rot": round(math.degrees(th), 1), "flip": flip, **kw}

def place(src, w, cx, cy, rot=0, **kw):
    return {"src": src, "cx": cx, "cy": cy, "w": w, "rot": rot, **kw}

GOLD2 = [{"type": "rect", "inset": 42, "width": 1.6, "foil": "gold", "opacity": 0.9}, {"type": "rect", "inset": 52, "width": 0.8, "foil": "gold", "opacity": 0.6}]
def ink_frame(color, inset=44, width=1.3, opacity=0.6):
    return [{"type": "rect", "inset": inset, "width": width, "color": color, "opacity": opacity}]

W, H = 1080, 1350
R = {}

R["redoute"] = dict(
    paper={"color": "#FBF7F0", "color2": "#F7F0E6", "mottle": 0.02},
    washes=[{"color": "#F1DCD6", "cx": 540, "cy": 80, "r": 520, "sx": 1.4, "opacity": 0.28}],
    frames=GOLD2,
    layers=[
        grow("rose-centifolia", 400, (-40, -60), (420, 330)),
        grow("rose-pink", 400, (1120, -60), (660, 330), flip=True),
        place("rose-bouquet", 330, 540, 120, 180),
        grow("rose-deep", 250, (-30, 1390), (260, 1010)),
        grow("rose-duchesse", 250, (1110, 1390), (820, 1010), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["whiterose"] = dict(
    paper={"color": "#FBF9F4", "color2": "#F5F3EC", "mottle": 0.018},
    washes=[{"color": "#DCE5D5", "cx": 540, "cy": 60, "r": 620, "sx": 1.4, "opacity": 0.3}],
    frames=[{"type": "arch", "inset": 70, "top": 90, "width": 1.5, "foil": "gold", "opacity": 0.85}],
    layers=[
        flower("phillyrea", 300, (360, 90), (1, 0.3)),
        flower("phillyrea", 300, (720, 90), (-1, 0.3), flip=True),
        flower("rose-white", 550, (240, 190), (0.7, 1)),
        flower("rose-blush", 480, (850, 180), (-0.7, 1), flip=True),
        flower("phillyrea", 250, (150, 1170), (0.4, -1)),
        flower("phillyrea", 250, (930, 1170), (-0.4, -1), flip=True),
    ],
    content={"x": 190, "w": 700, "top": 350}, bottomPad=100)

R["crimson"] = dict(
    paper={"color": "#FAF3EE", "color2": "#F5EAE3", "mottle": 0.02},
    washes=[{"color": "#EBC9C4", "cx": 760, "cy": 80, "r": 560, "sx": 1.3, "opacity": 0.3}],
    frames=ink_frame("#7A2632", 44, 1.4, 0.55),
    layers=[
        flower("rose-bengal", 340, (210, 150), (0.8, 1)),
        flower("rose-gallica", 240, (500, 80), (0.2, 1)),
        flower("rose-red", 490, (800, 190), (-0.6, 1), flip=True),
        flower("rose-darkred", 300, (180, 1130), (0.5, -1)),
        flower("rose-gallica", 240, (910, 1150), (-0.5, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["camellia"] = dict(
    paper={"color": "#FAF6F0", "color2": "#F4EEE6", "mottle": 0.02},
    washes=[{"color": "#F0D4D2", "cx": 80, "cy": 640, "r": 540, "sy": 1.6, "opacity": 0.3}],
    frames=ink_frame("#B9897F", 40, 1.0, 0.45),
    layers=[
        flower("camellia-white", 340, (100, 660), (1, 0)),
        flower("camellia-pink", 430, (175, 185), (0.8, 1)),
        flower("camellia-red", 340, (170, 1120), (0.6, -1)),
        flower("camellia-stripe", 260, (940, 150), (-0.8, 1), flip=True),
    ],
    content={"x": 320, "w": 630, "top": 280}, bottomPad=95)

R["cherry"] = dict(
    paper={"color": "#FBF4F1", "color2": "#F7EDEA", "mottle": 0.018},
    washes=[{"color": "#F2D2D6", "cx": 860, "cy": 140, "r": 500, "opacity": 0.32}],
    frames=[],
    layers=[
        flower("cherry-white", 380, (250, 150), (1, 0.5)),
        flower("cherry-double", 500, (840, 110), (-1, 0.6), flip=True),
        flower("plum-branch", 230, (120, 1140), (0.4, -1)),
        flower("apple-blossom", 280, (940, 1140), (-0.5, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=90)

R["magnolia"] = dict(
    paper={"color": "#F7F6F0", "color2": "#F1F1E9", "mottle": 0.02},
    washes=[{"color": "#DDE3D3", "cx": 180, "cy": 180, "r": 480, "opacity": 0.34}, {"color": "#F0D6DC", "cx": 940, "cy": 1220, "r": 440, "opacity": 0.3}],
    frames=ink_frame("#7E8B70", 44, 1.1, 0.45),
    layers=[
        flower("magnolia-stem", 300, (950, 160), (-0.8, 1), flip=True),
        flower("magnolia-grand", 480, (130, 90), (1, 0.9)),
        flower("magnolia-pink", 380, (960, 1170), (-0.6, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 340}, bottomPad=95)

R["taif"] = dict(
    paper={"color": "#FBF5F2", "color2": "#F7EDE9", "mottle": 0.02},
    washes=[{"color": "#F0CFD3", "cx": 540, "cy": 60, "r": 560, "sx": 1.5, "opacity": 0.3}, {"color": "#F0CFD3", "cx": 540, "cy": 1330, "r": 520, "sx": 1.6, "opacity": 0.22}],
    frames=GOLD2,
    layers=[
        flower("damask-full", 420, (270, 180), (0.7, 1)),
        flower("damask-pink", 420, (810, 180), (-0.7, 1), flip=True),
        flower("damask-blush", 310, (170, 1130), (0.4, -1)),
        flower("damask-light", 300, (910, 1130), (-0.4, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 335}, bottomPad=95)

R["jasmine"] = dict(
    paper={"color": "#F8F8F2", "color2": "#F2F3EA", "mottle": 0.018},
    washes=[{"color": "#DCE6D6", "cx": 540, "cy": 40, "r": 600, "sx": 1.5, "opacity": 0.3}],
    frames=[{"type": "round", "inset": 46, "radius": 26, "width": 1.2, "color": "#8FA083", "opacity": 0.5}],
    layers=[
        flower("jasmine-white", 440, (300, 150), (1, 0.5), crop=[0.15, 0, 1, 1]),
        flower("jasmine-white", 440, (780, 150), (-1, 0.5), flip=True, crop=[0.15, 0, 1, 1]),
        flower("jasmine-bunch", 300, (540, 110), (0, 1)),
        flower("jasmine-pink", 300, (160, 1130), (0.4, -1)),
        flower("jasmine-bunch", 280, (920, 1140), (-0.4, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["olive"] = dict(
    paper={"color": "#F6F3EA", "color2": "#F1EDE2", "mottle": 0.022},
    washes=[{"color": "#DDE2CC", "cx": 540, "cy": 50, "r": 620, "sx": 1.5, "opacity": 0.3}],
    frames=ink_frame("#7C8562", 44, 1.2, 0.5),
    layers=[
        flower("olive-branch", 400, (230, 100), (1, 0.6)),
        flower("olive-fruit", 400, (850, 100), (-1, 0.6), flip=True),
        flower("olive-branch", 250, (150, 1150), (0.5, -1)),
        flower("olive-fruit", 250, (930, 1150), (-0.5, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 320}, bottomPad=95)

R["laurel"] = dict(
    paper={"color": "#FAF8F2", "color2": "#F4F1E8", "mottle": 0.018},
    washes=[],
    frames=GOLD2,
    layers=[
        flower("laurel", 340, (240, 105), (0.9, 0.6)),
        flower("laurel", 340, (840, 105), (-0.9, 0.6), flip=True),
        flower("bay-laurel", 240, (150, 1160), (0.5, -1)),
        flower("bay-laurel", 240, (930, 1160), (-0.5, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 320}, bottomPad=95)

R["wildflower"] = dict(
    paper={"color": "#FBF7EC", "color2": "#F7F1E3", "mottle": 0.02},
    washes=[{"color": "#EFE2C4", "cx": 540, "cy": 1350, "r": 700, "sx": 1.4, "opacity": 0.25}],
    frames=[],
    layers=[
        flower("wild-bouquet", 300, (200, 140), (0.6, 1)),
        flower("wild-pink", 230, (900, 130), (-0.6, 1), flip=True),
        flower("wild-poppy", 260, (60, 1190), (0.25, -1)),
        flower("wild-paintbrush", 250, (120, 1060), (0.15, -1)),
        flower("wild-gentian", 230, (240, 1130), (0.35, -1)),
        flower("wild-yellow", 260, (1020, 1190), (-0.25, -1), flip=True),
        flower("wild-penstemon", 240, (970, 1060), (-0.15, -1), flip=True),
        flower("wild-columbine", 210, (850, 1130), (-0.35, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 310}, bottomPad=95)

R["tulip"] = dict(
    paper={"color": "#FBF7EF", "color2": "#F7F1E6", "mottle": 0.02},
    washes=[{"color": "#F5DCC9", "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": 0.28}],
    frames=ink_frame("#B07A4F", 44, 1.1, 0.45),
    layers=[
        flower("tulip-mix", 390, (220, 140), (0.7, 1)),
        flower("tulip-striped", 410, (860, 120), (-0.7, 1), flip=True),
        flower("tulip-single", 240, (140, 1130), (0.3, -1)),
        flower("tulip-red", 250, (930, 1130), (-0.3, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["hydrangea"] = dict(
    paper={"color": "#F3F5F6", "color2": "#EDF1F3", "mottle": 0.02},
    washes=[{"color": "#D3DEEA", "cx": 160, "cy": 140, "r": 480, "opacity": 0.35}, {"color": "#E8D6E2", "cx": 960, "cy": 1230, "r": 420, "opacity": 0.3}],
    frames=ink_frame("#6F86A0", 44, 1.1, 0.45),
    layers=[
        flower("hydrangea-violet", 360, (890, 140), (-0.8, 1), flip=True),
        flower("hydrangea-blue", 440, (190, 150), (0.8, 1)),
        flower("hydrangea-blue", 270, (130, 1170), (0.5, -1)),
        flower("hydrangea-pink", 330, (950, 1150), (-0.5, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["sweetpea"] = dict(
    paper={"color": "#FBF2F1", "color2": "#F7ECEB", "mottle": 0.018},
    washes=[{"color": "#F3D2D8", "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": 0.3}],
    frames=[{"type": "round", "inset": 46, "radius": 30, "width": 1.2, "color": "#C98E98", "opacity": 0.5}],
    layers=[
        flower("sweetpea-pink", 380, (230, 160), (0.8, 1)),
        flower("sweetpea-mix", 340, (860, 160), (-0.8, 1), flip=True),
        flower("sweetpea-vine", 260, (120, 1165), (0.4, -1)),
        flower("sweetpea-pink", 250, (930, 1160), (-0.4, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["forgetmenot"] = dict(
    paper={"color": "#F4F7F9", "color2": "#EEF3F6", "mottle": 0.018},
    washes=[{"color": "#D2E1EE", "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": 0.32}],
    frames=[{"type": "round", "inset": 46, "radius": 30, "width": 1.2, "color": "#7E9CB8", "opacity": 0.5}],
    layers=[
        flower("forgetmenot", 380, (220, 160), (0.8, 1)),
        flower("forgetmenot", 380, (860, 160), (-0.8, 1), flip=True),
        flower("wild-gentian", 230, (140, 1150), (0.35, -1)),
        flower("wild-gentian", 230, (940, 1150), (-0.35, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 320}, bottomPad=95)

R["lilyvalley"] = dict(
    paper={"color": "#F3F4EE", "color2": "#EDEFE6", "mottle": 0.02},
    washes=[{"color": "#D9E3D2", "cx": 200, "cy": 160, "r": 520, "opacity": 0.35}],
    frames=[{"type": "round", "inset": 46, "radius": 30, "width": 1.2, "color": "#8BA08A", "opacity": 0.5}],
    layers=[
        place("lilyvalley", 460, 210, 150, 200),
        place("lilyvalley", 420, 880, 140, 160, flip=True),
        place("lilyvalley", 300, 950, 1190, -10, flip=True),
        place("lilyvalley", 260, 120, 1210, 15),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["orchid"] = dict(
    paper={"color": "#FBF8F3", "color2": "#F6F1EA", "mottle": 0.018},
    washes=[{"color": "#EBD6E6", "cx": 540, "cy": 50, "r": 620, "sx": 1.5, "opacity": 0.28}],
    frames=[{"type": "arch", "inset": 70, "top": 90, "width": 1.5, "foil": "gold", "opacity": 0.85}],
    layers=[
        flower("orchid-cattleya", 360, (890, 130), (-0.8, 1), flip=True, crop=[0, 0, 1, 0.72]),
        flower("orchid-cattleya", 420, (200, 150), (0.8, 1), crop=[0, 0, 1, 0.72]),
        flower("orchid-cattleya", 240, (140, 1180), (0.4, -1), crop=[0, 0, 1, 0.72]),
        flower("orchid-cream", 300, (950, 1170), (-0.4, -1), flip=True),
    ],
    content={"x": 190, "w": 700, "top": 350}, bottomPad=100)

R["lily"] = dict(
    paper={"color": "#F9F8F4", "color2": "#F3F2EC", "mottle": 0.018},
    washes=[{"color": "#E6E0D2", "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": 0.3}],
    frames=ink_frame("#8C8370", 44, 1.1, 0.45),
    layers=[
        flower("lily-belladonna", 360, (880, 160), (-0.8, 1), flip=True),
        flower("lily-white", 400, (210, 180), (0.8, 1)),
        flower("lily-whites", 300, (950, 1160), (-0.4, -1), flip=True, crop=[0.45, 0, 1, 1]),
        flower("lily-white", 240, (130, 1180), (0.4, -1)),
    ],
    content={"x": 170, "w": 740, "top": 335}, bottomPad=95)

R["iris"] = dict(
    paper={"color": "#F6F5F7", "color2": "#F0EFF3", "mottle": 0.018},
    washes=[{"color": "#DCD7EA", "cx": 160, "cy": 150, "r": 480, "opacity": 0.33}, {"color": "#D6E0EC", "cx": 960, "cy": 1230, "r": 420, "opacity": 0.3}],
    frames=ink_frame("#6E6A92", 44, 1.1, 0.45),
    layers=[
        flower("iris-blue", 380, (870, 160), (-0.8, 1), flip=True),
        flower("iris-purple", 400, (210, 170), (0.8, 1)),
        flower("iris-white", 250, (130, 1170), (0.4, -1)),
        flower("iris-violet", 280, (950, 1160), (-0.4, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 335}, bottomPad=95)

R["wisteria"] = dict(
    paper={"color": "#F7F5F8", "color2": "#F2EFF4", "mottle": 0.018},
    washes=[{"color": "#DDD6EC", "cx": 540, "cy": 20, "r": 680, "sx": 1.4, "opacity": 0.34}],
    frames=[],
    layers=[
        flower("wisteria-vine", 330, (910, 130), (-0.25, 1), flip=True),
        flower("wisteria-blue", 300, (200, 120), (0.15, 1)),
        flower("wisteria-cream", 260, (560, 80), (0.05, 1)),
        flower("wisteria-vine", 250, (130, 1180), (0.4, -1)),
        flower("wisteria-vine", 250, (950, 1180), (-0.4, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 375}, bottomPad=95)

R["poppy"] = dict(
    paper={"color": "#FBF6EF", "color2": "#F7F0E6", "mottle": 0.02},
    washes=[{"color": "#F4D4C2", "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": 0.28}],
    frames=ink_frame("#B4553C", 44, 1.1, 0.45),
    layers=[
        flower("poppy-orange", 380, (890, 120), (-0.8, 1), flip=True, crop=[0, 0, 0.56, 1]),
        flower("poppy-scarlet", 380, (200, 170), (0.8, 1)),
        flower("wild-poppy", 260, (130, 1170), (0.4, -1)),
        flower("poppy-red", 260, (950, 1160), (-0.4, -1), flip=True, crop=[0, 0, 1, 0.55]),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["lavender"] = dict(
    paper={"color": "#F6F4F7", "color2": "#F1EEF3", "mottle": 0.018},
    washes=[{"color": "#E0D8EC", "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": 0.32}],
    frames=[{"type": "round", "inset": 46, "radius": 30, "width": 1.2, "color": "#8E80AA", "opacity": 0.5}],
    layers=[
        flower("lavender", 280, (330, 100), (0.9, 0.7)),
        flower("lavender-pale", 330, (170, 150), (0.7, 1)),
        flower("lavender", 290, (900, 130), (-0.7, 1), flip=True),
        flower("lavender-pale", 220, (1010, 260), (-1, 0.5), flip=True),
        flower("lavender-sprigs", 190, (130, 1190), (0.3, -1), crop=[0, 0, 1, 0.6]),
        flower("lavender-sprigs", 190, (950, 1190), (-0.3, -1), flip=True, crop=[0, 0, 1, 0.6]),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["pomegranate"] = dict(
    paper={"color": "#FAF5EC", "color2": "#F5EEE2", "mottle": 0.022},
    washes=[{"color": "#F0D2C2", "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": 0.26}],
    frames=GOLD2,
    layers=[
        flower("pomegranate-branch", 330, (880, 110), (-0.8, 1), flip=True, crop=[0.15, 0, 1, 0.62]),
        flower("pomegranate", 360, (165, 110), (0.8, 1)),
        flower("pomegranate-flower", 250, (140, 1170), (0.4, -1), crop=[0, 0.45, 1, 1]),
        flower("pomegranate-flower", 250, (940, 1170), (-0.4, -1), flip=True, crop=[0, 0.45, 1, 1]),
    ],
    content={"x": 170, "w": 740, "top": 335}, bottomPad=95)

R["anemone"] = dict(
    paper={"color": "#F8F6F4", "color2": "#F2EFEC", "mottle": 0.018},
    washes=[{"color": "#E3D6E2", "cx": 160, "cy": 150, "r": 480, "opacity": 0.3}],
    frames=ink_frame("#7D5E78", 44, 1.1, 0.45),
    layers=[
        flower("anemone-japan", 340, (900, 120), (-0.8, 1), flip=True),
        flower("anemone-mix", 410, (160, 115), (0.8, 1)),
        flower("anemone-japan", 250, (130, 1170), (0.4, -1)),
        flower("anemone-soft", 300, (950, 1160), (-0.4, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 335}, bottomPad=95)

R["daisy"] = dict(
    paper={"color": "#FBF8EE", "color2": "#F7F3E5", "mottle": 0.02},
    washes=[{"color": "#F1E6BE", "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": 0.28}],
    frames=[{"type": "round", "inset": 46, "radius": 30, "width": 1.2, "color": "#B49A55", "opacity": 0.5}],
    layers=[
        flower("chamomile", 280, (950, 140), (-0.8, 1), flip=True),
        flower("daisy-white", 380, (900, 105), (-0.8, 1), flip=True),
        flower("daisy-white", 410, (170, 115), (0.8, 1)),
        flower("chamomile", 230, (120, 1180), (0.4, -1)),
        flower("daisy-white", 260, (950, 1170), (-0.4, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 330}, bottomPad=95)

R["fern"] = dict(
    paper={"color": "#F4F5EF", "color2": "#EEF0E7", "mottle": 0.02},
    washes=[{"color": "#D6E2CF", "cx": 540, "cy": 40, "r": 640, "sx": 1.5, "opacity": 0.3}],
    frames=ink_frame("#5F7D5A", 44, 1.1, 0.45),
    layers=[
        bloom("fern-tall", 380, (330, 230), (0.9, 1)),
        bloom("fern-frond", 360, (760, 230), (-0.9, 1), flip=True),
        bloom("fern-green", 300, (120, 330), (0.25, 1)),
        bloom("fern-green", 300, (960, 330), (-0.25, 1), flip=True),
        bloom("fern-frond", 240, (200, 1000), (0.4, -1)),
        bloom("fern-tall", 240, (880, 1000), (-0.4, -1), flip=True),
    ],
    content={"x": 170, "w": 740, "top": 340}, bottomPad=95)

if __name__ == "__main__":
    os.makedirs("artdata/recipes", exist_ok=True)
    only = set(sys.argv[1:])
    for k, r in R.items():
        if only and k not in only: continue
        json.dump({"key": k, **r}, open(f"artdata/recipes/{k}.json", "w"), indent=1)
        print(k)
