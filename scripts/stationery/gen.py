"""Generate the artwork collection: N designs per occasion (wedding, newborn, Ramadan).

Each design = paper + washes + frames + layers (painted cut-outs and gold ornament), laid out by a
template, then auto-fitted so nothing intrudes into the text box or the QR footer. Writes:
  artdata/recipes2/<key>.json   compose.py recipes
  artdata/collection.json       rows + EN/AR names for the app
usage: gen.py [per_occasion=100] [seed=1]
"""
import json, math, os, sys, random
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import gold

CUT = "artdata/cut"
OUT = "artdata/recipes2"
W, H = 1080, 1350

# ─────────────────────────── element catalogue ───────────────────────────
FAM = {
    # wedding
    "rose": dict(en="Rose", ar="الورد", desc_en="Painted garden roses", desc_ar="ورود حدائق مرسومة باليد", accent="#A35F60", ink="#45282C", hue="pink",
                 els=["rose-centifolia", "rose-pink", "rose-blush", "rose-cluster", "rose-cabbage", "rose-soft", "rose-blushpink", "rose-single", "rose-pale", "rose-bud", "rose-spray", "rose-pinkcluster", "damask-full", "damask-pink", "damask-blush", "damask-light", "damask-pinkwhite", "rose-bouquet", "bouquet-roses", "camellia-rose"]),
    "redrose": dict(en="Red Rose", ar="الورد الأحمر", desc_en="Deep red Redouté roses", desc_ar="ورود ريدوتيه الحمراء", accent="#8C2F3A", ink="#3B1C21", hue="red",
                    els=["rose-red", "rose-deep", "rose-duchesse", "rose-gallica", "rose-darkred", "rose-bengal", "rose-crimson", "rose-scarlet", "carnation-red", "bouquet-red"]),
    "white": dict(en="White Blossom", ar="الزهر الأبيض", desc_en="White blossoms painted by hand", desc_ar="أزهار بيضاء مرسومة باليد", accent="#7A6A4C", ink="#2E3329", hue="white",
                  els=["rose-white", "gardenia", "camellia-white", "magnolia-grand", "magnolia-white", "clematis-white", "clematis-star", "azalea-white", "waterlily-white", "calla-white", "myrtle-white", "orange-blossom", "hibiscus-white", "lily-white", "gardenia-peach"]),
    "peony": dict(en="Peony & Camellia", ar="الفاوانيا والكاميليا", desc_en="Peonies and camellias in blush and rose", desc_ar="زهور الفاوانيا والكاميليا بالوردي", accent="#B0505F", ink="#43292B", hue="pink",
                  els=["peony-pink", "peony-blush", "camellia-pink", "camellia-soft", "camellia-stripe", "camellia-red", "bouquet-camellia", "azalea-pink", "ranunculus-pink", "bouquet-pink"]),
    "exotic": dict(en="Orchid & Lotus", ar="الأوركيد واللوتس", desc_en="Orchids, lotus and passionflowers", desc_ar="زهور الأوركيد واللوتس وزهرة الآلام", accent="#9A4C74", ink="#3D2838", hue="pink",
                   els=["orchid-cattleya", "orchid-cream", "lotus-pink", "lotus-rose", "passion-pale", "passion-white", "hibiscus-red", "lotus-leaf"]),
    "blue": dict(en="Hydrangea & Lilac", ar="الهيدرانجيا والليلك", desc_en="Hydrangeas, lilac and wisteria in soft blues", desc_ar="زهور الهيدرانجيا والليلك والويستيريا بألوان زرقاء ناعمة", accent="#56708E", ink="#2B3747", hue="blue",
                 els=["hydrangea-blue", "hydrangea-violet", "wisteria-blue", "wisteria-cream", "clematis-blue", "morningglory-violet", "lilac-pale", "lilac-white", "iris-blue", "morningglory-sky"]),
    "chrys": dict(en="Dahlia & Aster", ar="الداليا والأستر", desc_en="Dahlias, asters and chrysanthemums", desc_ar="زهور الداليا والأستر والأقحوان", accent="#8A4B6A", ink="#3A2433", hue="pink",
                  els=["chrys-white", "chrys-pink", "chrys-purple", "chrys-rose", "aster-purple", "dahlia-red", "dahlia-single", "bouquet-chrys"]),
    "green": dict(en="Olive & Laurel", ar="الزيتون والغار", desc_en="Olive, laurel and myrtle branches", desc_ar="أغصان الزيتون والغار والآس", accent="#646C4A", ink="#26301F", hue="green",
                  els=["olive-branch", "olive-fruit", "laurel", "bay-laurel", "phillyrea", "myrtle-white", "fern-tall", "fern-frond"]),
    # newborn
    "nblue": dict(en="Forget-me-not", ar="«لا تنسني»", desc_en="Tiny blue forget-me-nots and bluebells", desc_ar="زهور «لا تنسني» والجريسات الزرقاء الصغيرة", accent="#4F7299", ink="#2C3B4C", hue="blue",
                  els=["forgetmenot", "bluebell", "bluebell-pale", "wild-gentian", "morningglory-sky", "pansy-blue", "iris-blue"]),
    "npink": dict(en="Sweet Pea", ar="البازلاء العطرية", desc_en="Sweet peas, primroses and pink blossom", desc_ar="زهور البازلاء العطرية وزهرة الربيع والزهر الوردي", accent="#A85F6D", ink="#4A3036", hue="pink",
                  els=["sweetpea-pink", "sweetpea-mix", "primrose-pink", "mallow-pink", "cherry-white", "cherry-double", "apple-blossom", "rose-bud", "rose-single"]),
    "nlilac": dict(en="Violet & Pansy", ar="البنفسج والبانسيه", desc_en="Violets, pansies and lilac", desc_ar="زهور البنفسج والبانسيه والليلك", accent="#6F6290", ink="#3A3348", hue="lilac",
                   els=["violet-bunch", "pansy-purple", "pansy-soft", "primula-purple", "lilac-pale", "lilac-purple", "lavender", "auricula"]),
    "nmeadow": dict(en="Buttercup & Daisy", ar="الحوذان والأقحوان", desc_en="Buttercups, daisies and chamomile", desc_ar="زهور الحوذان والأقحوان والبابونج", accent="#8D7432", ink="#3A3424", hue="yellow",
                    els=["buttercup", "buttercup-sprig", "daisy-white", "chamomile", "pansy-yellow", "wild-yellow", "aster-white", "wild-poppy"]),
    "nvalley": dict(en="Lily of the Valley", ar="زنبق الوادي", desc_en="Nodding lily of the valley and white blossom", desc_ar="أجراس زنبق الوادي والزهر الأبيض", accent="#5E7A61", ink="#2D3A30", hue="green",
                    els=["lilyvalley", "aster-white", "cherry-white", "myrtle-white"]),
    "nberry": dict(en="Strawberry", ar="الفراولة", desc_en="Sweet strawberries and their blossom", desc_ar="حبات فراولة وأزهارها", accent="#B0444C", ink="#3E2426", hue="red",
                   els=["strawberry-hanging", "strawberry-plant", "strawberry-full"]),
    "nbird": dict(en="Hummingbird", ar="الطائر الطنان", desc_en="Hummingbirds among painted flowers", desc_ar="طيور طنانة بين أزهار مرسومة", accent="#3F7F6E", ink="#22332E", hue="green",
                  els=["hummingbird-leaf", "hummingbird-pink", "hummingbird-branch", "hummingbird-red", "hummingbird-flower", "hummingbird-green", "hummingbird-long", "hummingbird-small", "robin", "bird-waxwing"]),
    "nfly": dict(en="Butterfly", ar="الفراشات", desc_en="Butterflies over soft flowers", desc_ar="فراشات فوق أزهار ناعمة", accent="#A0613A", ink="#3B2A20", hue="yellow",
                 els=["butterflies", "butterfly-orange"]),
    "nnest": dict(en="Little Nest", ar="العش الصغير", desc_en="A little nest of eggs among spring flowers", desc_ar="عش صغير بالبيض بين أزهار الربيع", accent="#5C83A6", ink="#2C3A47", hue="blue",
                  els=["nest-blue", "nest-white"]),
    "nblossom": dict(en="Cherry Blossom", ar="زهر الكرز", desc_en="Cherry and apple blossom branches", desc_ar="أغصان زهر الكرز والتفاح", accent="#B0606F", ink="#4A3034", hue="pink",
                     els=["cherry-white", "cherry-double", "apple-blossom", "plum-branch"]),
    # ramadan
    "rdates": dict(en="Date Palm", ar="النخيل", desc_en="Date palms and ripe dates", desc_ar="نخيل وعناقيد تمر", accent="#8A5A2B", ink="#33261A", hue="gold",
                   els=["dates-cluster", "dates-branch", "date-palm", "palm-oasis", "palm-tree"]),
    "rpom": dict(en="Pomegranate", ar="الرمان", desc_en="Ripe pomegranates and their blossom", desc_ar="ثمار رمان ناضجة وأزهارها", accent="#9E3D33", ink="#3E231F", hue="red",
                 els=["pomegranate", "pomegranate-branch", "pomegranate-flower"]),
    "rcitrus": dict(en="Orange Blossom", ar="زهر البرتقال", desc_en="Orange blossom and citrus branches", desc_ar="زهر البرتقال وأغصان الحمضيات", accent="#A0622A", ink="#35281C", hue="gold",
                    els=["orange-blossom", "orange-branch", "orange-small", "lemon-branch", "lemons", "citrus-big", "citrus-bird"]),
    "rfig": dict(en="Fig & Olive", ar="التين والزيتون", desc_en="Fig and olive branches", desc_ar="أغصان التين والزيتون", accent="#5E6A44", ink="#272E1F", hue="green",
                 els=["fig-branch", "olive-branch", "olive-fruit"]),
    "rjasmine": dict(en="Jasmine", ar="الياسمين", desc_en="Fragrant white jasmine", desc_ar="أغصان ياسمين أبيض عطِر", accent="#5F7A55", ink="#2F3A2F", hue="green",
                     els=["jasmine-white", "jasmine-bunch", "orange-blossom", "myrtle-white"]),
    "rrose": dict(en="Damask Rose", ar="الورد الدمشقي", desc_en="Damask roses in blush pink", desc_ar="ورود دمشقية بلون وردي", accent="#A5566B", ink="#4A2B33", hue="pink",
                  els=["damask-full", "damask-pink", "damask-blush", "damask-light", "damask-pinkwhite"]),
    "rlamp": dict(en="Brass Lamp", ar="القنديل", desc_en="A painted brass lamp", desc_ar="قنديل نحاسي مرسوم", accent="#8A6A2C", ink="#33291A", hue="gold",
                  els=["brass-lamp"]),
}

PAPERS = {
    # light
    "ivory": dict(en="Ivory", ar="عاجي", rgb=("#FBF8F1", "#F6F1E6"), dark=False),
    "cream": dict(en="Cream", ar="كريمي", rgb=("#F9F2E6", "#F4EBDC"), dark=False),
    "blush": dict(en="Blush", ar="وردي فاتح", rgb=("#FBF1EE", "#F7E8E4"), dark=False),
    "rose": dict(en="Rose", ar="زهري", rgb=("#F8EAE8", "#F3E0DD"), dark=False),
    "sage": dict(en="Sage", ar="أخضر مريمي", rgb=("#F1F4EB", "#EAEEE2"), dark=False),
    "mint": dict(en="Mint", ar="نعناعي", rgb=("#EEF5F1", "#E6EFE9"), dark=False),
    "sky": dict(en="Sky", ar="سماوي", rgb=("#EEF4F9", "#E5EDF5"), dark=False),
    "powder": dict(en="Powder Blue", ar="أزرق فاتح", rgb=("#E8F0F7", "#DFE9F2"), dark=False),
    "lilac": dict(en="Lilac", ar="ليلكي", rgb=("#F4F0F7", "#EDE7F2"), dark=False),
    "butter": dict(en="Butter", ar="أصفر فاتح", rgb=("#FBF6E5", "#F6EFD8"), dark=False),
    "sand": dict(en="Sand", ar="رملي", rgb=("#F5EDDF", "#EEE3D0"), dark=False),
    "champagne": dict(en="Champagne", ar="شمباني", rgb=("#F7F0E3", "#F0E6D3"), dark=False),
    "pearl": dict(en="Pearl", ar="لؤلؤي", rgb=("#F6F6F3", "#EFEFEA"), dark=False),
    # dark
    "navy": dict(en="Navy", ar="كحلي", rgb=("#16233F", "#111C33"), dark=True),
    "midnight": dict(en="Midnight", ar="أزرق ليلي", rgb=("#101B30", "#0B1424"), dark=True),
    "emerald": dict(en="Emerald", ar="زمردي", rgb=("#103229", "#0B261F"), dark=True),
    "forest": dict(en="Forest", ar="أخضر داكن", rgb=("#1A322B", "#142822"), dark=True),
    "plum": dict(en="Plum", ar="برقوقي", rgb=("#2F1B32", "#251528"), dark=True),
    "burgundy": dict(en="Burgundy", ar="عنابي", rgb=("#3B1621", "#2F111A"), dark=True),
    "teal": dict(en="Teal", ar="فيروزي داكن", rgb=("#0F343A", "#0B2A2F"), dark=True),
    "onyx": dict(en="Onyx", ar="أسود", rgb=("#171615", "#100F0E"), dark=True),
}

OCC = {
    "WEDDING": dict(fams=["rose", "redrose", "white", "peony", "exotic", "blue", "chrys", "green"],
                    papers_light=["ivory", "cream", "blush", "rose", "sage", "champagne", "pearl", "sky", "lilac"],
                    papers_dark=["emerald", "navy", "burgundy", "onyx", "plum", "forest"], dark_share=0.22,
                    templates=["garland", "mirror", "diag", "cascade", "crown", "meadow", "swag", "sides", "archflor"],
                    occasions=["WEDDING", "ENGAGEMENT", "ANNIVERSARY"], lang=[("EN", 0.4), ("AR", 0.35), ("BILINGUAL", 0.25)]),
    "NEWBORN": dict(fams=["nblue", "npink", "nlilac", "nmeadow", "nvalley", "nberry", "nbird", "nnest", "nblossom"],
                    papers_light=["sky", "powder", "blush", "rose", "mint", "sage", "butter", "lilac", "cream", "ivory"],
                    papers_dark=[], dark_share=0.0,
                    templates=["garland", "mirror", "diag", "cascade", "meadow", "clouds", "birds", "nest", "flutter", "hanging"],
                    occasions=["NEWBORN", "BABY_SHOWER", "AQIQAH"], lang=[("EN", 0.45), ("AR", 0.35), ("BILINGUAL", 0.2)]),
    "RAMADAN": dict(fams=["rdates", "rpom", "rcitrus", "rfig", "rjasmine", "rrose", "rlamp"],
                    papers_light=["ivory", "cream", "sand", "champagne", "sage", "pearl"],
                    papers_dark=["navy", "midnight", "emerald", "plum", "burgundy", "teal", "onyx"], dark_share=0.6,
                    templates=["lanterns", "arch", "bands", "crescent", "skyline", "mosaic", "oasis", "floralmoon", "lanternflor"],
                    occasions=["RAMADAN"], lang=[("AR", 0.6), ("BILINGUAL", 0.3), ("EN", 0.1)]),
}

TPL = {
    "garland": dict(en="Garland", ar="إكليل", desc_en="in a garland across the top", desc_ar="تتوّج أعلى البطاقة في إكليل ناعم"),
    "mirror": dict(en="Bouquet", ar="باقة", desc_en="mirrored in the four corners", desc_ar="تتناظر في زوايا البطاقة الأربع"),
    "diag": dict(en="Sprays", ar="أغصان", desc_en="reaching in from opposite corners", desc_ar="تمتد من زاويتين متقابلتين"),
    "cascade": dict(en="Cascade", ar="شلال", desc_en="cascading down one side", desc_ar="تنساب على جانب البطاقة"),
    "crown": dict(en="Crown", ar="تاج", desc_en="gathered in a crown above the names", desc_ar="تجتمع في تاج فوق الأسماء"),
    "meadow": dict(en="Meadow", ar="مرج", desc_en="growing up from the bottom like a meadow", desc_ar="تنمو من أسفل البطاقة كمرج ربيعي"),
    "swag": dict(en="Festoon", ar="زينة", desc_en="hung in festoons along the top", desc_ar="تتدلى في أكاليل على طول أعلى البطاقة"),
    "sides": dict(en="Border", ar="حواشي", desc_en="climbing both sides of the card", desc_ar="تتسلق جانبي البطاقة"),
    "archflor": dict(en="Arch", ar="قوس", desc_en="around a fine gold arch", desc_ar="حول قوس ذهبي رفيع"),
    "clouds": dict(en="Moon & Clouds", ar="القمر والغيوم", desc_en="with a gold moon, stars and soft clouds", desc_ar="مع قمر ذهبي ونجوم وغيوم ناعمة"),
    "birds": dict(en="Song", ar="أنشودة", desc_en="with birds in flight", desc_ar="مع طيور محلّقة"),
    "nest": dict(en="Nest", ar="عش", desc_en="around a little nest", desc_ar="حول عش صغير"),
    "flutter": dict(en="Flutter", ar="رفرفة", desc_en="with butterflies fluttering above", desc_ar="مع فراشات ترفرف فوقها"),
    "hanging": dict(en="Mobile", ar="معلّقة", desc_en="hanging like a nursery mobile", desc_ar="تتدلى كمعلّقة فوق سرير الطفل"),
    "lanterns": dict(en="Lanterns", ar="فوانيس", desc_en="Gold lanterns hanging from the top, with a crescent and stars", desc_ar="فوانيس ذهبية تتدلى من أعلى البطاقة مع هلال ونجوم", gold=True),
    "arch": dict(en="Arch", ar="قوس", desc_en="framed by a gold pointed arch", desc_ar="داخل قوس ذهبي مدبب"),
    "bands": dict(en="Mosaic", ar="نقوش", desc_en="between bands of gold geometric pattern", desc_ar="بين أشرطة من النقوش الهندسية الذهبية"),
    "crescent": dict(en="Crescent", ar="هلال", desc_en="beneath a gold crescent and stars", desc_ar="تحت هلال ذهبي ونجوم"),
    "skyline": dict(en="Minarets", ar="مآذن", desc_en="A gold skyline of domes and minarets under a starry sky", desc_ar="أفق ذهبي من القباب والمآذن تحت سماء مرصعة بالنجوم", gold=True),
    "mosaic": dict(en="Star Pattern", ar="نجمة", desc_en="A faint gold star pattern with lanterns and a crescent", desc_ar="نقش نجمي ذهبي خفيف مع فوانيس وهلال", gold=True),
    "oasis": dict(en="Oasis", ar="واحة", desc_en="under a crescent moon, like an oasis at night", desc_ar="تحت هلال كواحة في الليل"),
    "floralmoon": dict(en="Moon", ar="قمر", desc_en="with a gold crescent and scattered stars", desc_ar="مع هلال ذهبي ونجوم متناثرة"),
    "lanternflor": dict(en="Lantern", ar="فانوس", desc_en="with gold lanterns hanging above", desc_ar="مع فوانيس ذهبية تتدلى فوقها"),
}

# ─────────────────────────── geometry helpers ───────────────────────────
_size, _fc, _alpha = {}, {}, {}

def ensure(name, factory):
    path = f"{CUT}/{name}.png"
    if not os.path.exists(path):
        factory().save(path)
    return name

def size(src, crop=None):
    if src not in _size:
        _size[src] = Image.open(f"{CUT}/{src}.png").size
    iw, ih = _size[src]
    if crop:
        iw, ih = iw * (crop[2] - crop[0]), ih * (crop[3] - crop[1])
    return iw, ih

def flower_center(src, crop=None):
    key = (src, tuple(crop) if crop else None)
    if key not in _fc:
        im = Image.open(f"{CUT}/{src}.png").convert("RGBA")
        if crop:
            w0, h0 = im.size; im = im.crop((int(crop[0] * w0), int(crop[1] * h0), int(crop[2] * w0), int(crop[3] * h0)))
        im.thumbnail((200, 200))
        a = np.asarray(im).astype(float) / 255
        hsv = np.asarray(im.convert("RGB").convert("HSV")).astype(float) / 255
        green = (hsv[..., 0] * 360 > 45) & (hsv[..., 0] * 360 < 185) & (hsv[..., 1] > 0.12)
        wts = ((a[..., 3] > 0.25) & ~green) * a[..., 3]
        ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        t = wts.sum()
        _fc[key] = ((xs * wts).sum() / t / a.shape[1], (ys * wts).sum() / t / a.shape[0]) if t > 0 else (0.5, 0.3)
    return _fc[key]

BOOST = 1.3

CREATURES = ("hummingbird", "robin", "bird-", "butterfl", "nest-")

def flower(src, w, at, up, flip=False, **kw):
    w = w * BOOST * (0.55 if src.startswith(CREATURES) else 1)
    iw, ih = size(src, kw.get("crop"))
    h = ih * w / iw
    fx, fy = flower_center(src, kw.get("crop"))
    if flip: fx = 1 - fx
    v0 = ((fx - 0.5) * w, (fy - 1.0) * h)
    ang = lambda v: math.atan2(-v[1], v[0])
    th = ang(up) - ang(v0)
    d0 = ((fx - 0.5) * w, (fy - 0.5) * h)
    d = (d0[0] * math.cos(th) + d0[1] * math.sin(th), -d0[0] * math.sin(th) + d0[1] * math.cos(th))
    return {"src": src, "cx": round(at[0] - d[0]), "cy": round(at[1] - d[1]), "w": round(w), "rot": round(math.degrees(th), 1), "flip": flip, **kw}

def place(src, w, cx, cy, rot=0, **kw):
    return {"src": src, "cx": round(cx), "cy": round(cy), "w": round(w), "rot": rot, **kw}

def layer_mask(L, scale=0.25):
    """Placed alpha of a layer at low resolution: (mask, x0, y0) in scaled canvas coords."""
    key = (L["src"], tuple(L.get("crop") or ()), bool(L.get("flip")), bool(L.get("flipv")))
    if key not in _alpha:
        im = Image.open(f"{CUT}/{L['src']}.png").getchannel("A")
        if L.get("crop"):
            x0, y0, x1, y1 = L["crop"]; w0, h0 = im.size
            im = im.crop((int(x0 * w0), int(y0 * h0), int(x1 * w0), int(y1 * h0)))
        if L.get("flip"): im = im.transpose(Image.FLIP_LEFT_RIGHT)
        if L.get("flipv"): im = im.transpose(Image.FLIP_TOP_BOTTOM)
        _alpha[key] = im
    im = _alpha[key]
    w = max(1, round(L["w"] * scale)); h = max(1, round(im.height * L["w"] / im.width * scale))
    m = im.resize((w, h), Image.BILINEAR)
    if L.get("rot"): m = m.rotate(L["rot"], resample=Image.BILINEAR, expand=True)
    a = np.asarray(m).astype(np.float32) / 255 * L.get("opacity", 1.0)
    return a, round(L["cx"] * scale - a.shape[1] / 2), round(L["cy"] * scale - a.shape[0] / 2)

def zones(content, bottom_pad):
    """Areas that must stay clear: the text box and the QR footer (as the card engine lays them out)."""
    footer_top = H - bottom_pad - 34 - 250 - 46 - 52
    x, w, top = content
    return [
        (x + 40, top, x + w - 40, footer_top - 30),
        (215, footer_top - 8, 865, footer_top + 46),
        (320, footer_top + 30, 760, H - bottom_pad + 30),  # QR plate with clear space, so phones lock on quickly
    ]

def intrusion(L, zs, scale=0.25):
    a, x0, y0 = layer_mask(L, scale)
    total = 0.0
    for (zx0, zy0, zx1, zy1) in zs:
        X0, Y0, X1, Y1 = int(zx0 * scale), int(zy0 * scale), int(zx1 * scale), int(zy1 * scale)
        ix0, iy0 = max(X0, x0), max(Y0, y0)
        ix1, iy1 = min(X1, x0 + a.shape[1]), min(Y1, y0 + a.shape[0])
        if ix1 > ix0 and iy1 > iy0:
            total += float((a[iy0 - y0:iy1 - y0, ix0 - x0:ix1 - x0] > 0.12).sum()) / scale / scale
    return total

def on_canvas(L, scale=0.25):
    a, x0, y0 = layer_mask(L, scale)
    X0, Y0 = max(0, x0), max(0, y0); X1, Y1 = min(int(W * scale), x0 + a.shape[1]), min(int(H * scale), y0 + a.shape[0])
    if X1 <= X0 or Y1 <= Y0: return 0.0
    return float((a[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0] > 0.12).sum()) / scale / scale

def autofit(layers, zs, limit=900):
    """Push each intruding layer outward (off the paper's edge, like real stationery), shrinking only a
    little; drop it if it still can't clear or ends up mostly off the card."""
    cz = ((zs[0][0] + zs[0][2]) / 2, (zs[0][1] + zs[0][3]) / 2)
    kept = []
    for L in layers:
        if L.get("nofit"):
            kept.append(L); continue
        L = dict(L)
        ok = False
        for step in range(26):
            if intrusion(L, zs) <= limit:
                ok = True; break
            dx, dy = L["cx"] - cz[0], (L["cy"] - cz[1]) * 0.8
            n = math.hypot(dx, dy) or 1
            L["cx"] += round(dx / n * 22); L["cy"] += round(dy / n * 22)
            if step % 3 == 2: L["w"] = round(L["w"] * 0.96)
        if ok and on_canvas(L) > 12000:
            kept.append(L)
    return kept

# ─────────────────────────── colour helpers ───────────────────────────
def hx(c): return np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], float) / 255
def tohex(v): return "#" + "".join(f"{int(round(max(0, min(1, x)) * 255)):02X}" for x in v)
def lum(c):
    v = hx(c); v = np.where(v <= 0.03928, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
def mixc(a, b, t): return tohex(hx(a) * (1 - t) + hx(b) * t)
def darken_to(c, bg, target):
    for i in range(60):
        if contrast(c, bg) >= target: return c
        c = mixc(c, "#000000", 0.05)
    return c
def lighten_to(c, bg, target):
    for i in range(60):
        if contrast(c, bg) >= target: return c
        c = mixc(c, "#FFFFFF", 0.06)
    return c

def palette(fam, paper, tone):
    bg = PAPERS[paper]["rgb"][0]
    if PAPERS[paper]["dark"]:
        text = "#F7F0E1"
        accent = {"gold": "#DDBA72", "silver": "#D6DBE2", "rose": "#E8B9A5"}[tone]
        muted = lighten_to(mixc(text, bg, 0.38), bg, 4.6)
        surface = mixc(bg, "#FFFFFF", 0.06)
        return [bg, surface, lighten_to(text, bg, 10), muted, lighten_to(accent, bg, 4.8)]
    F = FAM[fam] if fam else dict(accent="#8A6A2C", ink="#2C261D")
    text = darken_to(F["ink"], bg, 9.5)
    accent = darken_to(F["accent"], bg, 4.6)
    muted = mixc(text, bg, 0.42)
    muted = darken_to(muted, bg, 3.4)
    surface = mixc(bg, "#FFFFFF", 0.5)
    return [bg, surface, text, muted, accent]

FONTS = {
    "WEDDING": dict(display=["cormorant", "playfair", "italiana", "cormorant"], body=["cormorant", "jost", "cormorant"], ard=["amiri", "aref-ruqaa", "el-messiri"], arb=["amiri", "plex-arabic"],
                    names=[("great-vibes", "aref-ruqaa"), ("pinyon", "aref-ruqaa"), ("great-vibes", "katibeh"), (None, "rakkas"), ("pinyon", "katibeh"), (None, None)], formal=["cinzel", "italiana", "marcellus"]),
    "NEWBORN": dict(display=["quicksand", "cormorant", "quicksand"], body=["quicksand", "jost", "cormorant"], ard=["baloo", "el-messiri", "amiri"], arb=["baloo", "plex-arabic"],
                    names=[("dancing-script", "lemonada"), ("great-vibes", "aref-ruqaa"), ("dancing-script", "marhey"), ("pacifico", "lemonada"), ("great-vibes", "katibeh"), (None, None)], formal=[]),
    "RAMADAN": dict(display=["cormorant", "playfair", "cinzel"], body=["cormorant", "jost"], ard=["aref-ruqaa", "amiri", "reem-kufi", "el-messiri"], arb=["amiri", "plex-arabic"],
                    names=[(None, "aref-ruqaa"), ("great-vibes", "rakkas"), (None, "katibeh"), (None, "amiri"), ("pinyon", "aref-ruqaa"), (None, "reem-kufi")], formal=["cinzel", "marcellus"]),
}

# ─────────────────────────── templates ───────────────────────────
def pick(rng, pool, n, exclude=()):
    pool = [p for p in pool if p not in exclude and os.path.exists(f"{CUT}/{p}.png")]
    rng.shuffle(pool)
    out = pool[:n]
    while len(out) < n and pool: out.append(rng.choice(pool))
    return out

def tall(src):
    iw, ih = size(src); return ih / iw

def T_garland(rng, els, ctx):
    a, b, c = pick(rng, els, 3)
    s = rng.uniform(0.92, 1.12)
    return [flower(a, 400 * s, (250, 165), (0.75, 1)), flower(b, 400 * s, (830, 165), (-0.75, 1), flip=True),
            flower(c, 260 * s, (150, 1175), (0.45, -1)), flower(a if rng.random() < 0.5 else b, 250 * s, (930, 1175), (-0.45, -1), flip=True)], dict(top=330)

def T_mirror(rng, els, ctx):
    a, c = pick(rng, els, 2)
    s = rng.uniform(0.9, 1.12)
    return [flower(a, 400 * s, (240, 160), (0.8, 1)), flower(a, 400 * s, (840, 160), (-0.8, 1), flip=True),
            flower(c, 250 * s, (145, 1180), (0.45, -1)), flower(c, 250 * s, (935, 1180), (-0.45, -1), flip=True)], dict(top=330)

def T_diag(rng, els, ctx):
    a, b, c = pick(rng, els, 3)
    s = rng.uniform(0.95, 1.15)
    L = [flower(a, 470 * s, (200, 190), (0.85, 1)), flower(b, 400 * s, (900, 1150), (-0.6, -1), flip=True),
         flower(c, 230 * s, (950, 140), (-0.8, 1), flip=True)]
    if rng.random() < 0.5: L.append(flower(c, 210 * s, (120, 1190), (0.5, -1)))
    return L, dict(top=330)

def T_cascade(rng, els, ctx):
    a, b, c = pick(rng, els, 3)
    left = rng.random() < 0.5
    s = rng.uniform(0.92, 1.08)
    if left:
        L = [flower(a, 420 * s, (170, 230), (0.85, 1)), flower(b, 360 * s, (95, 660), (1, 0.05)), flower(c, 330 * s, (170, 1110), (0.6, -1))]
        return L, dict(x=300, w=640, top=270)
    L = [flower(a, 420 * s, (910, 230), (-0.85, 1), flip=True), flower(b, 360 * s, (985, 660), (-1, 0.05), flip=True), flower(c, 330 * s, (910, 1110), (-0.6, -1), flip=True)]
    return L, dict(x=140, w=640, top=270)

def T_crown(rng, els, ctx):
    a, b, c = pick(rng, els, 3)
    s = rng.uniform(0.92, 1.1)
    L = [flower(a, 330 * s, (540, 85), (0, 1)), flower(b, 290 * s, (290, 95), (0.9, 0.5)), flower(b, 290 * s, (790, 95), (-0.9, 0.5), flip=True),
         flower(c, 220 * s, (140, 1190), (0.4, -1)), flower(c, 220 * s, (940, 1190), (-0.4, -1), flip=True)]
    return L, dict(top=385)

def T_meadow(rng, els, ctx):
    pool = sorted(els, key=lambda e: -tall(e))
    ups = pick(rng, pool[: max(3, len(pool) // 2 + 1)], 4)
    s = rng.uniform(0.9, 1.08)
    L = [flower(ups[0], 240 * s, (95, 1080), (0.12, -1)), flower(ups[1], 220 * s, (230, 1150), (0.25, -1)), flower(ups[2], 240 * s, (985, 1080), (-0.12, -1), flip=True),
         flower(ups[3], 220 * s, (850, 1150), (-0.25, -1), flip=True)]
    t1, t2 = pick(rng, els, 2)
    L += [flower(t1, 280 * s, (190, 140), (0.7, 1)), flower(t2, 260 * s, (890, 135), (-0.7, 1), flip=True)]
    return L, dict(top=310)

def T_swag(rng, els, ctx):
    swag = rng.choice(["swag-roses", "swag-flowers"])
    a, c = pick(rng, els, 2)
    L = [place(swag, 1000, 540, 120, 0, flipv=False), flower(c, 240, (140, 1185), (0.45, -1)), flower(c, 240, (940, 1185), (-0.45, -1), flip=True)]
    if swag == "swag-flowers": L[0] = place(swag, 980, 540, 110)
    return L, dict(top=330)

def T_sides(rng, els, ctx):
    pool = sorted(els, key=lambda e: -tall(e))[: max(3, len(els) // 2 + 1)]
    a, b = pick(rng, pool, 2)
    s = rng.uniform(0.9, 1.05)
    L = [flower(a, 300 * s, (95, 360), (0.2, 1)), flower(a, 300 * s, (985, 360), (-0.2, 1), flip=True),
         flower(b, 300 * s, (95, 1000), (0.15, -1)), flower(b, 300 * s, (985, 1000), (-0.15, -1), flip=True)]
    return L, dict(x=220, w=640, top=300)

def T_archflor(rng, els, ctx):
    a, b = pick(rng, els, 2)
    tone = ctx["tone"]
    arch = ensure(f"g-arch{'' if tone == 'gold' else '-' + tone}", lambda: gold.arch_frame(1080, 1350, 72, 70, tone=tone))
    s = rng.uniform(0.9, 1.05)
    L = [place(arch, 1080, 540, 675, 0, nofit=True, blend="normal"),
         flower(a, 360 * s, (150, 290), (0.9, 0.9)), flower(a, 360 * s, (930, 290), (-0.9, 0.9), flip=True),
         flower(b, 260 * s, (120, 1180), (0.5, -1)), flower(b, 260 * s, (960, 1180), (-0.5, -1), flip=True)]
    return L, dict(x=190, w=700, top=390)

def gold_name(base, tone): return base if tone == "gold" else f"{base}-{tone}"

def stars_layer(rng, tone, w=1000, h=360, cy=200, count=22):
    seed = rng.randrange(1000)
    nm = ensure(f"g-stars-{w}x{h}-{count}-{seed}-{tone}", lambda: gold.starfield(w, h, count, seed, tone))
    return place(nm, w, 540, cy, 0, blend="normal", nofit=False)

def lantern_layer(rng, tone, x, chain, height, glow=True):
    st = rng.randrange(3)
    nm = ensure(f"g-lan-{st}-{height}-{chain}-{int(glow)}-{tone}", lambda: gold.lantern(height, st, glow, tone, chain))
    iw, ih = size(nm)
    return place(nm, iw, x, ih / 2 - 4, 0, blend="normal")

def crescent_layer(rng, tone, cx, cy, w, flip=False):
    nm = gold_name("g-crescent-r" if flip else "g-crescent", tone)
    ensure(nm, lambda: gold.crescent(340, tone, 205 if flip else -25))
    return place(nm, w * 1.25, cx, cy, rng.uniform(-10, 10), blend="normal")

def T_clouds(rng, els, ctx):
    tone = "gold"
    L = [crescent_layer(rng, tone, 830, 175, 200), stars_layer(rng, tone, 1000, 330, 200, 20)]
    cl = ["g-cloud", "g-cloud2"]
    L += [place(cl[0], 420, 210, 250, 0, blend="normal"), place(cl[1], 360, 960, 1130, 0, blend="normal"), place(cl[0], 300, 120, 1200, 0, blend="normal", flip=True)]
    if els:
        a = pick(rng, els, 1)[0]
        L.append(flower(a, 230, (930, 1170), (-0.5, -1), flip=True))
    return L, dict(top=360)

def T_birds(rng, els, ctx):
    birds = pick(rng, FAM["nbird"]["els"], 2)
    a, b = pick(rng, els, 2)
    L = [place(birds[0], 260, 220, 210, 0, flip=rng.random() < 0.5), flower(a, 340, (870, 170), (-0.8, 1), flip=True),
         flower(b, 240, (140, 1180), (0.45, -1)), place(birds[1], 210, 930, 1150, 0, flip=True)]
    return L, dict(top=340)

def T_nest(rng, els, ctx):
    nest = rng.choice(FAM["nnest"]["els"])
    a, b = pick(rng, els, 2)
    L = [flower(a, 360, (230, 160), (0.8, 1)), flower(b, 320, (860, 160), (-0.8, 1), flip=True),
         place(nest, 270, 155, 1185, 0), flower(a, 230, (950, 1180), (-0.45, -1), flip=True)]
    return L, dict(top=330)

def T_flutter(rng, els, ctx):
    a, b = pick(rng, els, 2)
    L = [place("butterfly-orange", 140, 300, 150, -18), place("butterflies", 300, 800, 170, 0),
         flower(a, 290, (140, 1170), (0.45, -1)), flower(b, 290, (940, 1170), (-0.45, -1), flip=True), flower(b, 240, (150, 200), (0.8, 1))]
    return L, dict(top=330)

def T_hanging(rng, els, ctx):
    a = pick(rng, els, 1)[0]
    tone = "gold"
    st = gold_name("g-star8", tone); ensure(st, lambda: gold.star(140, 8, 0.55, tone))
    L = []
    for x, ln in ((180, 140), (330, 230), (750, 230), (900, 140)):
        line = ensure(f"g-string-{ln}", lambda ln=ln: _string(ln))
        L.append(place(line, 8, x, ln / 2, 0, blend="normal", nofit=True))
    L += [place(st, 58, 180, 160, 0, blend="normal"), crescent_layer(rng, tone, 330, 260, 90), place(st, 58, 750, 250, 0, blend="normal"), place(gold_name("g-sparkle", tone), 60, 900, 160, 0, blend="normal")]
    L += [flower(a, 260, (140, 1175), (0.45, -1)), flower(a, 260, (940, 1175), (-0.45, -1), flip=True)]
    return L, dict(top=330)

def _string(ln):
    im = Image.new("RGBA", (8, ln), (0, 0, 0, 0))
    a = np.zeros((ln, 8, 4), np.float32); a[:, 3:5, 0], a[:, 3:5, 1], a[:, 3:5, 2], a[:, 3:5, 3] = 0.78, 0.63, 0.36, 0.9
    return Image.fromarray((a * 255).astype(np.uint8), "RGBA")

def T_lanterns(rng, els, ctx):
    tone = ctx["tone"]
    n = rng.choice([3, 5])
    xs = [215, 540, 865] if n == 3 else [140, 320, 540, 760, 940]
    chains = [10, 70, 10] if n == 3 else [0, 110, 40, 110, 0]
    heights = [340, 360, 340] if n == 3 else [270, 270, 300, 270, 270]
    L = [stars_layer(rng, tone, 1040, 420, 230, 30)]
    for x, c, hh in zip(xs, chains, heights):
        L.append(lantern_layer(rng, tone, x, c, hh, glow=ctx["dark"]))
    L.append(crescent_layer(rng, tone, 90 if rng.random() < 0.5 else 990, 520, 110))
    return L, dict(top=470)

def T_arch(rng, els, ctx):
    tone = ctx["tone"]
    arch = ensure(gold_name("g-arch", tone), lambda: gold.arch_frame(1080, 1350, 72, 70, tone=tone))
    L = [place(arch, 1080, 540, 675, 0, nofit=True, blend="normal"), crescent_layer(rng, tone, 540, 250, 120)]
    L.append(stars_layer(rng, tone, 520, 200, 250, 12))
    if els:
        a = pick(rng, els, 1)[0]
        L += [flower(a, 260, (115, 1185), (0.5, -1)), flower(a, 260, (965, 1185), (-0.5, -1), flip=True)]
    L += [lantern_layer(rng, tone, 180, 30, 230, glow=ctx["dark"]), lantern_layer(rng, tone, 900, 30, 230, glow=ctx["dark"])]
    return L, dict(x=200, w=680, top=400)

def T_bands(rng, els, ctx):
    tone = ctx["tone"]
    band = ensure(gold_name("g-band", tone), lambda: gold.geometric_band(1080, 86, tone=tone))
    L = [place(band, 1080, 540, 52, 0, nofit=True, blend="normal"), place(band, 1080, 540, 1298, 0, nofit=True, blend="normal"),
         crescent_layer(rng, tone, 540, 200, 120)]
    if els:
        a, b = pick(rng, els, 2)
        L += [flower(a, 300, (150, 230), (0.8, 1)), flower(a, 300, (930, 230), (-0.8, 1), flip=True)]
    return L, dict(top=340, bottom=150)

def T_crescent(rng, els, ctx):
    tone = ctx["tone"]
    right = rng.random() < 0.5
    L = [crescent_layer(rng, tone, 860 if right else 220, 200, 280, flip=not right), stars_layer(rng, tone, 1000, 380, 210, 22)]
    if els:
        a, b = pick(rng, els, 2)
        L += [flower(a, 380, (900 if not right else 180, 1120), (-0.6 if not right else 0.6, -1), flip=not right),
              flower(b, 230, (130 if not right else 950, 1185), (0.45 if not right else -0.45, -1), flip=right)]
    return L, dict(top=360)

def T_skyline(rng, els, ctx):
    tone = ctx["tone"]
    sky = ensure(gold_name("g-skyline", tone), lambda: gold.skyline(1080, 230, tone))
    L = [place(sky, 1080, 540, 1350 - 115, 0, nofit=True, blend="normal"), stars_layer(rng, tone, 1000, 360, 200, 26), crescent_layer(rng, tone, 540, 190, 150)]
    return L, dict(top=330, bottom=215)

def T_mosaic(rng, els, ctx):
    tone = ctx["tone"]
    pat = ensure(gold_name("g-pattern", tone), lambda: gold.pattern_field(1080, 1350, 120, 1.2, tone))
    L = [place(pat, 1080, 540, 675, 0, nofit=True, blend="normal", opacity=0.16 if ctx["dark"] else 0.22),
         lantern_layer(rng, tone, 190, 20, 330, glow=ctx["dark"]), lantern_layer(rng, tone, 890, 60, 330, glow=ctx["dark"]),
         crescent_layer(rng, tone, 540, 220, 150)]
    return L, dict(top=420, plate=True)

def T_oasis(rng, els, ctx):
    tone = ctx["tone"]
    palms = pick(rng, ["date-palm", "palm-oasis", "palm-tree"], 2)
    L = [crescent_layer(rng, tone, 540, 190, 160), stars_layer(rng, tone, 1000, 360, 200, 22),
         flower(palms[0], 330, (120, 1070), (0.1, -1)), flower(palms[1], 300, (965, 1090), (-0.1, -1), flip=True)]
    if "dates-cluster" in els or rng.random() < 0.5:
        L.append(place("dates-cluster", 220, 950, 150, -12, flip=True))
    return L, dict(top=360)

def T_floralmoon(rng, els, ctx):
    tone = ctx["tone"]
    a, b = pick(rng, els, 2)
    L = [flower(a, 410, (230, 175), (0.8, 1)), crescent_layer(rng, tone, 860, 170, 170), stars_layer(rng, tone, 520, 220, 230, 12),
         flower(b, 330, (900, 1140), (-0.6, -1), flip=True), flower(a, 220, (130, 1190), (0.45, -1))]
    L[2]["cx"] = 800
    return L, dict(top=345)

def T_lanternflor(rng, els, ctx):
    tone = ctx["tone"]
    a, b = pick(rng, els, 2)
    L = [lantern_layer(rng, tone, 200, 20, 330, glow=ctx["dark"]), lantern_layer(rng, tone, 880, 70, 330, glow=ctx["dark"]),
         stars_layer(rng, tone, 600, 260, 240, 12), flower(a, 340, (150, 1120), (0.55, -1)), flower(b, 340, (930, 1120), (-0.55, -1), flip=True)]
    return L, dict(top=430)

TEMPLATES = {k[2:].lower(): v for k, v in globals().items() if k.startswith("T_")}

# ─────────────────────────── design assembly ───────────────────────────
def washes_for(rng, paper, fam):
    P = PAPERS[paper]
    if P["dark"]:
        glow = mixc(P["rgb"][0], "#F2D9A0", 0.5)
        return [{"color": glow, "cx": rng.choice([220, 540, 860]), "cy": 200, "r": 620, "sx": 1.3, "opacity": 0.18, "mode": "glow"}]
    tint = {"pink": "#F1D3D2", "red": "#EBC9C4", "white": "#E6E2D2", "blue": "#D3DEEA", "lilac": "#E0D8EC", "yellow": "#F1E6BE", "green": "#D9E3D2", "gold": "#EFDCC0"}[FAM[fam]["hue"] if fam else "gold"]
    return [{"color": tint, "cx": 540, "cy": 40, "r": 620, "sx": 1.5, "opacity": rng.uniform(0.2, 0.32)}]

def frames_for(rng, paper, tone, tpl):
    if tpl in ("archflor", "arch", "bands"):
        return []
    style = rng.random()
    if PAPERS[paper]["dark"] or style < 0.4:
        return [{"type": "rect", "inset": 42, "width": 1.6, "foil": tone, "opacity": 0.9}, {"type": "rect", "inset": 52, "width": 0.8, "foil": tone, "opacity": 0.6}]
    if style < 0.7:
        return [{"type": "round", "inset": 46, "radius": 28, "width": 1.2, "color": "#B09A78", "opacity": 0.5}]
    if style < 0.85:
        return [{"type": "rect", "inset": 44, "width": 1.2, "color": "#A39684", "opacity": 0.45}]
    return []

def build(occ, fam, tpl, paper, rng):
    O = OCC[occ]
    dark = PAPERS[paper]["dark"]
    tone = "gold" if not dark or rng.random() < 0.82 else rng.choice(["silver", "rose"])
    if occ == "NEWBORN": tone = "gold"
    ctx = dict(paper=paper, dark=dark, tone=tone)
    els = [e for e in (FAM[fam]["els"] if fam else []) if os.path.exists(f"{CUT}/{e}.png")]
    layers, geo = TEMPLATES[tpl](rng, els, ctx)
    content = (geo.get("x", 170), geo.get("w", 740), geo.get("top", 330))
    bottom = geo.get("bottom", 95)
    zs = zones(content, bottom)
    blend = "lift" if dark else "multiply"
    for L in layers:
        L.setdefault("blend", blend)
        if L["blend"] == "multiply" and dark: L["blend"] = "lift"
    fitted = autofit(layers, zs)
    painted = [L for L in fitted if not L["src"].startswith("g-") and L["src"] not in ("swag-roses", "swag-flowers")]
    gold_layers = [L for L in fitted if L["src"].startswith("g-")]
    needs = 2 if fam else 0
    if len(painted) < min(needs, len([L for L in layers if not L["src"].startswith("g-")])) :
        return None
    ink = sum(on_canvas(L) for L in fitted)
    if ink < (40000 if TPL[tpl].get("gold") else 90000) and not geo.get("plate"):
        return None
    recipe = dict(paper={"color": PAPERS[paper]["rgb"][0], "color2": PAPERS[paper]["rgb"][1], "mottle": 0.018 if not dark else 0.03, "grain": 0.012 if not dark else 0.02, "vignette": 0.06 if not dark else 0.18},
                  washes=washes_for(rng, paper, fam), frames=frames_for(rng, paper, tone, tpl), layers=fitted,
                  content={"x": content[0], "w": content[1], "top": content[2]}, bottomPad=bottom, quality=82)
    return recipe, ctx

def choose_lang(rng, occ):
    r, acc = rng.random(), 0
    for l, p in OCC[occ]["lang"]:
        acc += p
        if r <= acc: return l
    return "EN"

def fonts_for(rng, occ, fam, tpl):
    F = FONTS[occ]
    formal = F["formal"] and (fam in ("green",) or tpl in ("bands", "skyline", "mosaic", "lanterns") ) and rng.random() < 0.6
    names = rng.choice(F["names"])
    if formal:
        disp = rng.choice(F["formal"]) if rng.choice(F["formal"]) in ("cinzel", "italiana") else "cinzel"
        return [disp, rng.choice(F["body"]), rng.choice(F["ard"]), rng.choice(F["arb"])], (None, names[1]), 0.8, True
    disp = rng.choice(F["display"])
    scale = 1.05 if names[0] in ("great-vibes", "pinyon", "dancing-script") else (0.95 if names[0] == "pacifico" else 1.0)
    return [disp, rng.choice(F["body"]), rng.choice(F["ard"]), rng.choice(F["arb"])], names, scale, False

def divider_for(occ, tpl, fam):
    if occ == "RAMADAN": return "star"
    if occ == "NEWBORN": return "heart" if fam in ("npink", "nberry") else ("star" if tpl in ("clouds", "hanging") else "floral")
    if fam == "green": return "diamond"
    return "floral"

def style_for(occ, fam, paper, tpl):
    dark = PAPERS[paper]["dark"]
    if occ == "RAMADAN": return "luxe" if dark and tpl in ("lanterns", "arch", "skyline", "mosaic") else "heritage"
    if occ == "NEWBORN": return "playful" if fam in ("nbird", "nfly", "nnest", "nberry") or tpl in ("clouds", "hanging", "flutter", "birds") else "floral"
    if dark: return "luxe"
    if fam == "green": return "classic"
    return "floral"

def slug(s):
    out = "".join(c.lower() if c.isalnum() else "-" for c in s)
    while "--" in out: out = out.replace("--", "-")
    return out.strip("-")

def naming(occ, fam, tpl, paper):
    T, P = TPL[tpl], PAPERS[paper]
    if T.get("gold") or not fam:
        en = f"{P['en']} {T['en']}"; ar = f"{T['ar']} · {P['ar']}"
        desc_en = f"{T['desc_en']}, on {P['en'].lower()} paper."
        desc_ar = f"{T['desc_ar']}، على ورق {P['ar']}."
    else:
        F = FAM[fam]
        en = f"{F['en']} {T['en']}"; ar = f"{T['ar']} {F['ar']}"
        desc_en = f"{F['desc_en']} {T['desc_en']}, on {P['en'].lower()} paper."
        desc_ar = f"{F['desc_ar']} {T['desc_ar']}، على ورق {P['ar']}."
    return en, ar, desc_en, desc_ar

def generate(per=100, seed=1):
    os.makedirs(OUT, exist_ok=True)
    rows, used_names, used_keys = [], set(), set()
    existing = {"peony", "redoute", "whiterose", "crimson", "camellia", "cherry", "magnolia", "taif", "jasmine", "olive", "laurel", "wildflower", "tulip", "hydrangea", "sweetpea", "forgetmenot", "lilyvalley", "orchid", "lily", "iris", "wisteria", "poppy", "lavender", "pomegranate", "anemone", "daisy", "fern"}
    for occ, O in OCC.items():
        rng = random.Random(f"{seed}-{occ}")
        combos = []
        for tpl in O["templates"]:
            gold_only = TPL[tpl].get("gold")
            fams = [None] if gold_only else O["fams"]
            for fam in fams:
                if tpl == "nest" and fam in ("nnest", "nbird", "nfly"): continue
                if tpl == "birds" and fam in ("nbird", "nnest"): continue
                if tpl == "flutter" and fam in ("nfly",): continue
                if tpl == "oasis" and fam not in ("rdates", None): continue
                if fam in ("nbird", "nnest") and tpl not in ("diag", "mirror", "clouds"): continue
                if fam == "rlamp" and tpl not in ("arch", "crescent", "floralmoon"): continue
                for paper in O["papers_light"] + O["papers_dark"]:
                    if tpl == "clouds" and paper not in ("sky", "powder", "blush", "rose", "lilac", "mint"): continue
                    combos.append((fam, tpl, paper))
        rng.shuffle(combos)
        quota_dark = round(per * O["dark_share"])
        count = {"tpl": {}, "fam": {}, "paper": {}}
        n_dark = 0
        chosen = 0
        cap_tpl = math.ceil(per / len(O["templates"])) + 3
        cap_fam = math.ceil(per / len(O["fams"])) + 4
        cap_paper = math.ceil(per / max(1, len(O["papers_light"]) + len(O["papers_dark"]))) + 4
        for fam, tpl, paper in combos:
            if chosen >= per: break
            dark = PAPERS[paper]["dark"]
            if dark and n_dark >= quota_dark: continue
            if not dark and (chosen - n_dark) >= per - quota_dark: continue
            if count["tpl"].get(tpl, 0) >= cap_tpl: continue
            if fam and count["fam"].get(fam, 0) >= cap_fam: continue
            if count["paper"].get(paper, 0) >= cap_paper: continue
            en, ar, desc_en, desc_ar = naming(occ, fam, tpl, paper)
            if en in used_names:
                en = f"{en} · {PAPERS[paper]['en']}"; ar = f"{ar} · {PAPERS[paper]['ar']}"
                if en in used_names: continue
            key = slug(en.replace("·", " ").replace("&", "and"))
            if key in used_keys or key in existing or any(seg in ("en", "ar", "bi") for seg in key.split("-")): continue
            r = random.Random(f"{seed}-{key}")
            built = build(occ, fam, tpl, paper, r)
            if not built: continue
            recipe, ctx = built
            pal = palette(fam, paper, ctx["tone"])
            fonts, names, scale, upper = fonts_for(r, occ, fam, tpl)
            lang = choose_lang(r, occ)
            premium = dark or tpl in ("arch", "bands", "skyline", "mosaic", "archflor", "swag") or r.random() < 0.18
            occs = list(O["occasions"])
            if occ == "WEDDING" and fam in ("redrose", "peony", "rose") and r.random() < 0.4: occs.append("HENNA")
            if occ == "RAMADAN" and tpl in ("bands", "mosaic", "skyline", "arch"): occs.append("CORPORATE")
            if occ == "NEWBORN" and fam in ("nblue", "npink", "nblossom", "nmeadow") and r.random() < 0.35: occs.append("BIRTHDAY")
            row = dict(k=key, o=occs, c=pal, f=fonts, b=[recipe["content"]["x"], recipe["content"]["w"], recipe["content"]["top"], recipe["bottomPad"]], d=divider_for(occ, tpl, fam), y=style_for(occ, fam, paper, tpl),
                       names=dict(en=dict(name=en, description=desc_en), ar=dict(name=ar, description=desc_ar)), meta=dict(occ=occ, fam=fam, tpl=tpl, paper=paper, tone=ctx["tone"]))
            if premium: row["p"] = 1
            if lang != "EN": row["l"] = lang
            if names != (None, None): row["n"] = list(names)
            if scale != 1.0: row["s"] = scale
            if upper: row["u"] = 1
            json.dump({"key": key, **recipe}, open(f"{OUT}/{key}.json", "w"), indent=1)
            rows.append(row)
            used_names.add(en); used_keys.add(key)
            count["tpl"][tpl] = count["tpl"].get(tpl, 0) + 1
            if fam: count["fam"][fam] = count["fam"].get(fam, 0) + 1
            count["paper"][paper] = count["paper"].get(paper, 0) + 1
            chosen += 1; n_dark += int(dark)
        print(occ, chosen, "designs;", "dark", n_dark, "| templates", count["tpl"])
    json.dump(rows, open("artdata/collection.json", "w"), indent=1, ensure_ascii=False)
    return rows

if __name__ == "__main__":
    per = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    rows = generate(per, seed)
    print(len(rows), "rows")
