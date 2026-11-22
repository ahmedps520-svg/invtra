"""Flag designs whose text or QR sits on painted artwork: text pixels = where the rendered card differs
from the bare artwork; artwork pixels = where the artwork differs from its plain paper."""
import json, glob, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
rows = json.load(open("artdata/collection.json"))
out = []
for r in rows:
    k = r["k"]
    card = np.asarray(Image.open([f for f in (f"artdata/cards2/{k}-{l}.png" for l in ("en", "ar", "bilingual")) if __import__("os").path.exists(f)][0]).convert("RGB").resize((360, 450))).astype(float)
    art = np.asarray(Image.open(f"artdata/cards2/{k}-bare.png").convert("RGB").resize((360, 450))).astype(float)
    paper = np.median(art[200:300, 120:240].reshape(-1, 3), axis=0)  # the open middle of the card
    text = np.abs(card - art).max(-1) > 40
    text = ndi.binary_dilation(text, iterations=2)
    ink = np.abs(art - paper).max(-1) > 70
    ink = ndi.binary_opening(ink, iterations=1)
    clash = (text & ink).sum()
    out.append((int(clash), k, r["meta"]["occ"], r["meta"]["tpl"]))
out.sort(reverse=True)
json.dump(out, open("artdata/qa.json", "w"))
for c, k, o, t in out[:40]: print(c, k, o, t)
print("over 150:", sum(1 for c, *_ in out if c > 150), "| over 400:", sum(1 for c, *_ in out if c > 400))
