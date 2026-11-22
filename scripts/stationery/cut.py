"""Lift a painted flower off its (aged) paper: flatten the paper to white, drop captions/logos/specks,
then 'colour-to-alpha' so the painting can be laid on any light paper with its watercolour translucency.
usage: cut.py <in.jpg> <out.png> [--keep N] [--thr 0.10] [--minfrac 0.02] [--box x0,y0,x1,y1 (fractions)]"""
import sys, argparse
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("dst")
ap.add_argument("--thr", type=float, default=0.10, help="ink threshold for the object mask")
ap.add_argument("--minfrac", type=float, default=0.015, help="keep components at least this fraction of the largest")
ap.add_argument("--box", default=None, help="only keep ink inside this box (fractions x0,y0,x1,y1)")
ap.add_argument("--maxside", type=int, default=1600)
ap.add_argument("--cutdrop", action="append", default=[], help="clear this box of the finished cut-out (fractions); repeatable")
ap.add_argument("--drop", action="append", default=[], help="clear ink inside this box (fractions x0,y0,x1,y1); repeatable")
a = ap.parse_args()

im = Image.open(a.src).convert("RGB")
if max(im.size) > a.maxside:
    im.thumbnail((a.maxside, a.maxside), Image.LANCZOS)
rgb = np.asarray(im).astype(np.float32) / 255.0
H, W, _ = rgb.shape

# 1) Paper estimate: fit a quadratic surface per channel to pixels that look like paper.
b = max(4, int(min(H, W) * 0.04))
border = np.concatenate([rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3), rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
paper0 = np.median(border, axis=0)
dist = np.sqrt(((rgb - paper0) ** 2).sum(-1))
lum = rgb.mean(-1)
paperish = (dist < 0.10) & (lum > np.median(lum[dist < 0.12]) - 0.08) if (dist < 0.12).any() else dist < 0.1
yy, xx = np.mgrid[0:H, 0:W]
X = xx / W - 0.5; Y = yy / H - 0.5
A = np.stack([np.ones_like(X), X, Y, X * X, Y * Y, X * Y], -1)
sel = paperish[::4, ::4].reshape(-1)
As = A[::4, ::4].reshape(-1, 6)[sel]
bg = np.empty_like(rgb)
for c in range(3):
    vals = rgb[::4, ::4, c].reshape(-1)[sel]
    coef, *_ = np.linalg.lstsq(As, vals, rcond=None)
    bg[..., c] = (A @ coef)
bg = np.clip(bg, 0.05, 1.0)

# 2) Flatten: paper → white.
norm = np.clip(rgb / bg, 0, 1)

# 3) Object mask: anything with ink; keep the plant, drop captions, plate numbers, logos, specks.
ink = 1 - norm.min(-1)
sat = norm.max(-1) - norm.min(-1)
obj = (ink > a.thr) | (sat > 0.12)
obj = ndi.binary_opening(obj, iterations=1)
if a.box:
    x0, y0, x1, y1 = [float(v) for v in a.box.split(",")]
    m = np.zeros_like(obj); m[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = True
    obj &= m
for box in a.drop:
    x0, y0, x1, y1 = [float(v) for v in box.split(",")]
    obj[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = False
# Ignore a thin frame of the scan edge (page borders, shadows).
e = max(3, int(min(H, W) * 0.015)); obj[:e] = obj[-e:] = False; obj[:, :e] = obj[:, -e:] = False
grown = ndi.binary_dilation(obj, iterations=max(2, int(min(H, W) * 0.006)))
lab, n = ndi.label(grown)
if n == 0:
    sys.exit("no object found")
sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
big = sizes.max()
keep_ids = [i + 1 for i, s in enumerate(sizes) if s >= big * a.minfrac]
# Small, text-like components far below/above the main mass are captions: keep only those overlapping the main bbox rows.
main = lab == (int(np.argmax(sizes)) + 1)
rows = np.where(main.any(1))[0]; r0, r1 = rows[0], rows[-1]
kept = np.zeros_like(main)
for i in keep_ids:
    comp = lab == i
    cr = np.where(comp.any(1))[0]; cc = np.where(comp.any(0))[0]
    bh, bw = cr[-1] - cr[0] + 1, cc[-1] - cc[0] + 1
    if sizes[i - 1] < big * 0.08 and (cr[0] > r1 or cr[-1] < r0):
        continue  # caption above/below the plant
    if max(bh, bw) / max(1, min(bh, bw)) > 9 and min(bh, bw) < 0.05 * min(H, W):
        continue  # page edge, fold or rule
    corner = (cc[-1] < 0.2 * W or cc[0] > 0.8 * W) and (cr[-1] < 0.2 * H or cr[0] > 0.8 * H)
    if corner and sizes[i - 1] < big * 0.12:
        continue  # stamp or logo in a corner
    kept |= comp
soft = ndi.gaussian_filter(ndi.binary_dilation(kept, iterations=3).astype(np.float32), 2.0)
norm = norm * soft[..., None] + (1 - soft[..., None])

# 4) Colour to alpha against white (exact: compositing over white reproduces the flattened painting).
alpha = np.clip(1 - norm.min(-1), 0, 1)
alpha = np.where(alpha < 0.025, 0, alpha)
safe = np.maximum(alpha, 1e-4)[..., None]
col = np.clip((norm - (1 - alpha[..., None])) / safe, 0, 1)
rgba = np.dstack([col, alpha])

ys, xs = np.where(alpha > 0.02)
pad = 6
y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad)
x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad)
crop = rgba[y0:y1, x0:x1].copy()
if a.cutdrop:
    ch, cw = crop.shape[:2]
    for box in a.cutdrop:
        bx0, by0, bx1, by1 = [float(v) for v in box.split(",")]
        crop[int(by0 * ch):int(by1 * ch), int(bx0 * cw):int(bx1 * cw), 3] = 0
    ys, xs = np.where(crop[..., 3] > 0.02)
    crop = crop[max(0, ys.min() - pad):ys.max() + pad, max(0, xs.min() - pad):xs.max() + pad]
out = Image.fromarray((crop * 255).round().astype(np.uint8), "RGBA")
out.save(a.dst)
print(a.dst, out.size, f"components kept {len(keep_ids)}/{n}")
