"""Search Openverse (CC0 / public-domain only), download thumbnails, and build a numbered contact sheet.
usage: ov.py <outdir> <slug> "<query>" [pages=1] [extra openverse params, e.g. source=wikimedia]"""
import json, sys, os, io, urllib.parse, urllib.request, concurrent.futures as cf
from PIL import Image, ImageDraw, ImageFont

UA = {"User-Agent": "invtra-design-sourcing/1.0 (contact@invtra.store)"}
out, slug, query = sys.argv[1], sys.argv[2], sys.argv[3]
pages = int(sys.argv[4]) if len(sys.argv) > 4 else 1
extra = dict(a.split("=", 1) for a in sys.argv[5:])
d = os.path.join(out, slug); os.makedirs(d, exist_ok=True)

def get(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read()

results = []
for page in range(1, pages + 1):
    params = {"q": query, "license": "cc0,pdm", "page_size": 20, "page": page, **extra}
    data = json.loads(get("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(params)))
    results += data.get("results", [])
results = [r for r in results if (r.get("width") or 0) >= 900 or (r.get("height") or 0) >= 900]
meta = [{k: r.get(k) for k in ("id", "title", "creator", "license", "license_version", "source", "url", "foreign_landing_url", "width", "height", "thumbnail")} for r in results]
json.dump(meta, open(os.path.join(d, "results.json"), "w"), indent=1)

def thumb(i_r):
    i, r = i_r
    try:
        im = Image.open(io.BytesIO(get(r["thumbnail"] or r["url"]))).convert("RGB")
        im.thumbnail((240, 240)); return i, im
    except Exception as e:
        return i, None

with cf.ThreadPoolExecutor(8) as ex:
    thumbs = dict(ex.map(thumb, enumerate(meta)))
cols, cw, ch = 8, 250, 280
rows = (len(meta) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, max(1, rows) * ch), (40, 40, 40))
dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
except Exception: font = None
for i, r in enumerate(meta):
    x, y = (i % cols) * cw, (i // cols) * ch
    im = thumbs.get(i)
    if im: sheet.paste(im, (x + 5 + (240 - im.width) // 2, y + 5 + (240 - im.height) // 2))
    dr.text((x + 6, y + 250), f"{i} {r['source'][:9]} {r['width']}x{r['height']}", fill=(255, 220, 120), font=font)
sheet.save(os.path.join(d, "sheet.jpg"), quality=80)
print(slug, len(meta), "results →", os.path.join(d, "sheet.jpg"))
