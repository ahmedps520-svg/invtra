"""Generate the second artwork collection: children's and grown-ups' birthdays, baby showers, newborns,
aqiqah, graduation, henna, corporate events, engagements and anniversaries, and general gatherings.

Reuses gen.py's geometry, auto-fitting, palettes and paper; adds painted objects (antique toys,
hot-air balloons, storks, lambs, owls, peacocks, glass, silver…), procedural ornament from gold.py
(shaded balloons, bunting, confetti, laurels, mortarboards, henna rosettes and paisleys, rainbows),
and the layouts that place them. Writes:
  artdata/recipes3/<key>.json   compose.py recipes
  artdata/collection3.json      rows + EN/AR names for the app (appended to the first collection)
usage: gen3.py [seed=1]   (run from the working folder that holds artdata/)
"""
import json, math, os, sys, random

sys.path.insert(0, os.path.dirname(__file__))
import gen
import gold
from gen import (FAM, PAPERS, TPL, autofit, crescent_layer, ensure, flower, frames_for, gold_name, mixc, on_canvas, palette,
                 pick, place, size, slug, stars_layer, washes_for, zones, _string)

OUT = "artdata/recipes3"

PAPERS.update({
    "peach": dict(en="Peach", ar="خوخي", rgb=("#FBF0E8", "#F6E6DA"), dark=False),
    "linen": dict(en="Linen", ar="كتاني", rgb=("#F4F0E8", "#EDE7DC"), dark=False),
    "charcoal": dict(en="Charcoal", ar="فحمي", rgb=("#202124", "#18191B"), dark=True),
})

# ─────────────────────────── families ───────────────────────────
# kind: plant (oriented like a flower spray), ground (stands on the bottom edge), sky (floats), perch (bird on a branch)
NEW_FAM = {
    "kballoon": dict(en="Hot-Air Balloon", ar="المنطاد", desc_en="Painted hot-air balloons drifting up", desc_ar="مناطيد مرسومة تحلّق عالياً", accent="#4C6C96", ink="#2B3647", hue="blue", kind="sky",
                     els=["balloon-blue", "balloon-pink", "balloon-striped", "balloon-tricolor"], alt=["npink", "nblue", "ksun"]),
    "ktoys": dict(en="Toy Box", ar="صندوق الألعاب", desc_en="Antique toys painted in watercolour", desc_ar="ألعاب عتيقة مرسومة بالألوان المائية", accent="#A8443A", ink="#3A2A24", hue="red", kind="ground",
                  els=["toy-train", "toy-locomotive", "toy-carriage", "toy-hen", "toy-horse-wheels", "toy-horse-dapple", "toy-elephant", "rocking-horse", "rocking-horse-red", "rocking-soldier", "toy-top", "toy-clown", "noah-ark"], alt=["ksun", "npink", "nmeadow"]),
    "kzoo": dict(en="Menagerie", ar="حديقة الحيوان", desc_en="A giraffe, a flamingo and friends painted from life", desc_ar="زرافة وفلامنغو وأصدقاء مرسومون من الطبيعة", accent="#9C5E36", ink="#3A2C22", hue="yellow", kind="ground",
                 els=["giraffe", "flamingo-pink", "rabbit-angora", "toy-elephant", "camel-dromedary", "swan-water", "hare-meadow"], alt=["ksun", "nmeadow", "kfruit"]),
    "kfruit": dict(en="Cherry", ar="الكرز", desc_en="Ripe cherries and strawberries", desc_ar="حبات كرز وفراولة ناضجة", accent="#A3323B", ink="#3D2124", hue="red", kind="plant",
                   els=["cherry-red", "cherry-black", "cherries-white", "cherry-branch", "strawberries-big", "strawberry-hanging", "strawberry-full"], alt=["nmeadow", "npink"]),
    "ksun": dict(en="Sunflower", ar="دوار الشمس", desc_en="Sunflowers and golden blooms", desc_ar="زهور دوار الشمس وأزهار ذهبية", accent="#9C6A26", ink="#3A3020", hue="yellow", kind="plant",
                 els=["sunflower-yellow", "gaillardia", "yellow-daisies", "yellow-flower", "orange-flower", "begonia", "yellow-bouquet"], alt=["nmeadow"]),
    "abloom": dict(en="Garden Bouquet", ar="باقة الحديقة", desc_en="Painted garden bouquets", desc_ar="باقات زهور حديقة مرسومة", accent="#A04E68", ink="#40282F", hue="pink", kind="plant",
                   els=["bouquet-garden", "begonia", "sweetpea-bunch2", "rose-bouquet", "tulip-bouquet", "peony-pink", "dahlia-pink", "bouquet-roses", "bouquet-yellow"], alt=["peony", "rose"]),
    "abird": dict(en="Songbird", ar="الطيور المغرّدة", desc_en="Cardinals, bee-eaters and parakeets on painted branches", desc_ar="طيور الكاردينال والوروار والببغاوات على أغصان مرسومة", accent="#A0393B", ink="#33262A", hue="red", kind="perch",
                  els=["cardinals", "bee-eater", "flycatcher", "bird-berries", "parakeets"], alt=["abloom", "kfruit"]),
    "aglass": dict(en="Glass & Candle", ar="الزجاج والشموع", desc_en="Painted coloured glass and candlesticks", desc_ar="أوانٍ زجاجية ملوّنة وشمعدانات مرسومة", accent="#3E4F86", ink="#2A2D3E", hue="blue", kind="ground",
                   els=["glass-red", "glass-green", "glass-blue", "candle-blue", "candle-brass", "candle-purple"], alt=["abloom", "rose", "white"]),
    "bstork": dict(en="Stork", ar="اللقلق", desc_en="A painted white stork", desc_ar="لقلق أبيض مرسوم", accent="#9A4A3C", ink="#342A26", hue="blue", kind="ground",
                   els=["stork-white", "stork-rock"], alt=["nblue", "npink", "nmeadow"]),
    "bpram": dict(en="Pram", ar="عربة الطفل", desc_en="A vintage pram and tiny shoes", desc_ar="عربة أطفال عتيقة وحذاء صغير", accent="#5A6C8C", ink="#2D3340", hue="blue", kind="ground",
                  els=["pram", "baby-shoes-red", "baby-boot"], alt=["nblue", "npink", "nblossom"]),
    "bnursery": dict(en="Nursery", ar="غرفة الطفل", desc_en="Antique nursery toys", desc_ar="ألعاب أطفال عتيقة", accent="#8A5A3C", ink="#3A2C24", hue="yellow", kind="ground",
                     els=["rocking-horse", "rocking-horse-red", "toy-horse-wheels", "toy-horse-dapple", "noah-ark", "toy-elephant", "toy-top"], alt=["npink", "nblue", "nmeadow"]),
    "blamb": dict(en="Little Lamb", ar="الحمل الصغير", desc_en="A little lamb drawn from life", desc_ar="حمل صغير مرسوم من الطبيعة", accent="#6A7656", ink="#2F3328", hue="green", kind="ground",
                  els=["lamb-lying", "sheep-sketch", "rabbit-angora", "hare-meadow"], alt=["nmeadow", "nvalley", "npink"]),
    "alamb": dict(en="Lamb", ar="الخروف", desc_en="A lamb drawn from life", desc_ar="خروف مرسوم من الطبيعة", accent="#6A7656", ink="#2F3328", hue="green", kind="ground",
                  els=["lamb-lying", "sheep-sketch"], alt=["nvalley", "rjasmine", "nmeadow"]),
    "bswan": dict(en="Swan", ar="البجعة", desc_en="A white swan on still water", desc_ar="بجعة بيضاء على ماء ساكن", accent="#56768A", ink="#2A3540", hue="blue", kind="ground",
                  els=["swan-water"], alt=["nblue", "nvalley", "white"]),
    "gowl": dict(en="Owl", ar="البومة", desc_en="A wise painted owl", desc_ar="بومة حكيمة مرسومة", accent="#7A5A34", ink="#2E2820", hue="gold", kind="perch",
                 els=["owl-eagle", "owl-horned", "owl-barred"], alt=["green", "ksun"]),
    "gglobe": dict(en="Globe", ar="الكرة الأرضية", desc_en="An antique globe", desc_ar="كرة أرضية عتيقة", accent="#7A4E2E", ink="#2E2620", hue="gold", kind="ground",
                   els=["globe"], alt=["green", "ksun"]),
    "gcup": dict(en="Silver Cup", ar="الكأس", desc_en="A silver cup and a gilded one", desc_ar="كأس فضية وأخرى مذهّبة", accent="#5C6670", ink="#262B30", hue="white", kind="ground",
                 els=["trophy-silver", "cup-gold"], alt=["green", "white"]),
    "hpeacock": dict(en="Peacock", ar="الطاووس", desc_en="A jewel-bright peacock", desc_ar="طاووس بألوان الجواهر", accent="#1F6767", ink="#1F3232", hue="green", kind="perch",
                     els=["peacock-perch", "peacock-branch", "peacock-green", "peacock-insects"], alt=["redrose", "rrose", "rjasmine"]),
    "hglass": dict(en="Jewel Glass", ar="الزجاج الملوّن", desc_en="Jewel-coloured glass, painted fans and a lantern", desc_ar="زجاج بألوان الجواهر ومراوح مرسومة وفانوس", accent="#8A2F3A", ink="#33222A", hue="red", kind="ground",
                   els=["glass-red", "glass-blue", "glass-green", "fan-pink", "fan-black", "lantern-punched"], alt=["redrose", "rrose", "rjasmine"]),
    "cobj": dict(en="Heirloom", ar="المقتنيات", desc_en="Heirloom silver, brass and an antique globe", desc_ar="مقتنيات فضية ونحاسية وكرة أرضية عتيقة", accent="#5E5A52", ink="#26241F", hue="white", kind="ground",
                 els=["globe", "cup-gold", "trophy-silver", "candle-brass", "pot-silver", "teapot-pewter"], alt=["green"]),
    "eswan": dict(en="Lovebirds", ar="طيور الحب", desc_en="A swan and a pair of cardinals", desc_ar="بجعة وزوج من طيور الكاردينال", accent="#9A3A44", ink="#35262A", hue="pink", kind="ground",
                  els=["swan-water", "cardinals"], alt=["rose", "redrose", "white"]),
    "ocoffee": dict(en="Coffee & Tea", ar="القهوة والشاي", desc_en="Painted coffee pots and teapots", desc_ar="أباريق قهوة وشاي مرسومة", accent="#8A5530", ink="#33261C", hue="gold", kind="ground",
                    els=["pot-copper", "pot-lustre", "pot-silver", "pot-tole", "teapot-pewter", "lantern-tinware"], alt=["rcitrus", "rjasmine", "abloom"]),
    "oshell": dict(en="Seashell", ar="الأصداف", desc_en="Painted seashells", desc_ar="أصداف بحرية مرسومة", accent="#9C5E3A", ink="#3A2C24", hue="yellow", kind="ground",
                   els=["shell-nautilus", "shells-scallop", "shell-scallop2", "shells-conch"], alt=["nmeadow"]),
    "ocamel": dict(en="Desert", ar="الصحراء", desc_en="A dromedary among date palms", desc_ar="جمل بين النخيل", accent="#8A5A2B", ink="#33261A", hue="gold", kind="ground",
                   els=["camel-dromedary", "palm-tree", "date-palm", "palm-oasis"], alt=["rdates"]),
    "obasket": dict(en="Flower Basket", ar="سلة الزهور", desc_en="Baskets of painted flowers", desc_ar="سلال زهور مرسومة", accent="#A0506A", ink="#3D2830", hue="pink", kind="ground",
                    els=["basket-flowers", "basket-hanging"], alt=["abloom", "rose"]),
}
FAM.update(NEW_FAM)
for k in ("npink", "nblue", "nmeadow", "nvalley", "nblossom", "peony", "rose", "redrose", "white", "green", "rrose", "rjasmine", "rcitrus", "rpom", "rdates"):
    FAM[k].setdefault("kind", "plant")

KB = NEW_FAM["kballoon"]["els"]
NOFLIP = {"toy-carriage", "toy-locomotive", "globe"}
TALL = {"stork-white", "stork-rock", "giraffe", "flamingo-pink", "peacock-perch", "peacock-branch", "owl-horned", "owl-barred", "owl-eagle", "candle-blue", "candle-brass",
        "candle-purple", "glass-red", "glass-green", "glass-blue", "trophy-silver", "toy-clown", "lantern-punched", "lantern-tinware", "pot-copper", "pot-lustre", "sunflower-yellow", "palm-tree", "date-palm"}
PERCH = {"owl-eagle", "owl-horned", "owl-barred", "cardinals", "bee-eater", "flycatcher", "bird-berries", "parakeets", "peacock-perch", "peacock-branch"}
SMALL_HANG = ["toy-top", "butterfly-brown", "toy-hen", "toy-horse-wheels", "baby-boot"]

# ─────────────────────────── placement helpers ───────────────────────────
def fitw(src, maxw, maxh):
    iw, ih = size(src)
    return min(maxw, maxh * iw / ih)

def hgt(src, w):
    iw, ih = size(src)
    return ih * w / iw

def ground(src, maxw, maxh, x, bottom=1312, flip=False, rot=0, **kw):
    w = fitw(src, maxw, maxh)
    return place(src, w, x, bottom - hgt(src, w) / 2, rot, flip=flip and src not in NOFLIP, **kw)

def hang(src, maxw, maxh, x, top=10, flip=False, rot=0, **kw):
    w = fitw(src, maxw, maxh)
    return place(src, w, x, top + hgt(src, w) / 2, rot, flip=flip and src not in NOFLIP, **kw)

def small(L):
    """Decoration kept whenever it stays clear of the text and QR, however little ink it has."""
    L["small"] = True
    return L

def autofit3(layers, zs, limit=900):
    for i, L in enumerate(layers): L["_i"] = i
    kept = autofit([L for L in layers if not L.get("small")], zs, limit)
    kept += [L for L in layers if L.get("small") and gen.intrusion(L, zs) <= limit]
    kept.sort(key=lambda L: L["_i"])  # the template's stacking order
    for L in kept: L.pop("_i", None); L.pop("small", None)
    return kept

def sky(L, top):
    """A scatter (stars, confetti) squeezed into the band above the text."""
    return small(L)

def zones3(content, bottom_pad):
    """As gen.zones, with the QR's clear space sized to the largest QR (300 px) and its plate."""
    zs = zones(content, bottom_pad)
    x0, y0, x1, y1 = zs[2]
    zs[2] = (345, y0, 735, y1)
    return zs

def kind_els(els, kind):
    return [e for e in els if elkind(e) == kind]

def elkind(e):
    for f in NEW_FAM.values():
        if e in f["els"]:
            return "perch" if e in PERCH else f["kind"]
    return "plant"

def alt_els(ctx):
    pool = []
    for k in FAM[ctx["fam"]].get("alt", []) if ctx["fam"] else []:
        pool += [e for e in FAM[k]["els"] if elkind(e) == "plant"]
    return pool or FAM["npink"]["els"]

def corner(rng, obj, left, ctx, maxw=340, maxh=400, spray=0.8):
    """A bottom corner: an object standing on the edge with a flower spray tucked behind it, or just flowers."""
    f = pick(rng, alt_els(ctx), 1)[0]
    if obj is None:
        return [flower(f, 340, (140, 1175) if left else (940, 1175), (0.45, -1) if left else (-0.45, -1), flip=not left)]
    o = ground(obj, maxw, maxh, 175 if left else 905, bottom=1330, flip=not left)
    if rng.random() < spray:
        return [flower(f, 330, (60, 1215) if left else (1020, 1215), (0.55, -1) if left else (-0.55, -1), flip=not left), o]
    return [o]

def bottom_pair(rng, els, ctx, big=1.0):
    """The bottom corners: objects standing on the edge (with flowers behind), else flower sprays."""
    g = list(dict.fromkeys(e for e in els if elkind(e) in ("ground", "perch")))
    if g:
        objs = pick(rng, g, 2) if len(g) >= 2 else [g[0], None]
        if rng.random() < 0.5: objs = objs[::-1]
        return corner(rng, objs[0], True, ctx, 340 * big, 400 * big) + corner(rng, objs[1], False, ctx, 340 * big, 400 * big)
    p = [e for e in els if elkind(e) == "plant"] or alt_els(ctx)
    a, b = pick(rng, p, 2)
    s = rng.uniform(0.95, 1.1)
    return [flower(a, 330 * s, (140, 1180), (0.45, -1)), flower(b, 330 * s, (940, 1180), (-0.45, -1), flip=True)]

def top_flowers(rng, ctx, n=2, s=1.0):
    p = alt_els(ctx)
    a, b = pick(rng, p, 2)
    L = [flower(a, 400 * s, (210, 150), (0.8, 1))]
    if n > 1: L.append(flower(b, 400 * s, (870, 150), (-0.8, 1), flip=True))
    return L

def balloon_colors(rng, ctx):
    if ctx["dark"]:
        return rng.choice([("gold", "silver", "ivory"), ("gold", "rose", "ivory"), ("gold", "ivory", "gold")])
    g = ctx["group"]
    if g in ("SHOWER", "NEWBORN2"):
        return rng.choice([("sky", "ivory", "silver"), ("blush", "ivory", "gold"), ("sage", "ivory", "gold"), ("lilac", "blush", "ivory"), ("sky", "blush", "ivory")])
    if g == "KIDS":
        return rng.choice([("coral", "sky", "butter"), ("gold", "blush", "sky"), ("red", "navy", "ivory"), ("sage", "butter", "blush"), ("lilac", "sky", "gold"), ("coral", "gold", "sage")])
    return rng.choice([("gold", "ivory", "blush"), ("gold", "rose", "ivory"), ("gold", "silver", "ivory"), ("gold", "sage", "ivory")])

def confetti_layer(rng, ctx, w=1000, h=360, cy=190, count=60):
    pal = ("gold",) if ctx["dark"] else (("gold", "blush", "sky", "butter") if ctx["group"] in ("KIDS", "SHOWER", "NEWBORN2") else ("gold", "rose"))
    seed = rng.randrange(1000)
    nm = ensure(f"g-confetti-{w}x{h}-{count}-{seed}-{'-'.join(pal)}", lambda: gold.confetti(w, h, count, seed, pal))
    return small(place(nm, w, 540, cy, 0, blend="normal"))

# ─────────────────────────── layouts ───────────────────────────
def T_skyballoons(rng, els, ctx):
    bs = pick(rng, KB, 3)
    L = []
    if not ctx["dark"]:
        L += [place("g-cloud", 300, 380, 250, 0, blend="normal"), place("g-cloud2", 240, 800, 330, 0, blend="normal", flip=True)]
    w1 = fitw(bs[0], 285, 370); L.append(place(bs[0], w1, 180, 30 + hgt(bs[0], w1) / 2, round(rng.uniform(-5, 5), 1)))
    w2 = fitw(bs[1], 190, 250); L.append(place(bs[1], w2, 895, 45 + hgt(bs[1], w2) / 2, round(rng.uniform(-6, 6), 1)))
    if rng.random() < 0.55:
        w3 = fitw(bs[2], 95, 130); L.append(small(place(bs[2], w3, 690, 70 + hgt(bs[2], w3) / 2, round(rng.uniform(-6, 6), 1))))
    rest = [e for e in els if e not in KB]
    L += bottom_pair(rng, rest or alt_els(ctx), ctx)
    return L, dict(top=400)

def T_foilballoons(rng, els, ctx):
    cols = balloon_colors(rng, ctx)
    seed = rng.randrange(1000)
    bunch = ensure(f"g-bunch-{'-'.join(cols)}-{seed}", lambda: gold.balloon_bunch(cols, 200, seed))
    single = rng.choice(cols)
    one = ensure(f"g-balloon-{single}-{seed % 7}", lambda: gold.balloon(170, single, 1.5, seed % 7))
    left = rng.random() < 0.5
    bw = 450
    L = [confetti_layer(rng, ctx, 1000, 330, 185, 46)]
    L.append(place(bunch, bw, 190 if left else 890, hgt(bunch, bw) / 2 - 18, 0, blend="normal", flip=not left))
    L.append(small(place(one, 170, 900 if left else 180, hgt(one, 125) / 2 + 20, round(rng.uniform(-8, 8), 1), blend="normal")))
    L += bottom_pair(rng, [e for e in els if e not in KB] or alt_els(ctx), ctx)
    return L, dict(top=410)

def T_bunting(rng, els, ctx):
    seed = rng.randrange(1000)
    if ctx["dark"] or ctx["group"] in ("ADULT", "GRAD", "CORP", "LOVE"):
        foil, pal = ctx["tone"] if ctx["tone"] in ("gold", "silver", "rose") else "gold", ("ivory",)
    else:
        foil = None
        pal = rng.choice([("blush", "ivory", "sage", "butter", "sky"), ("sky", "ivory", "blush"), ("coral", "butter", "sky", "sage"), ("red", "ivory", "navy"), ("lilac", "blush", "ivory", "sky")])
    nm = ensure(f"g-bunting-{foil or '-'.join(pal)}-{seed}", lambda: gold.bunting(1080, 230, 11, pal, 0.32, seed, foil))
    L = [place(nm, 1080, 540, 115, 0, blend="normal", nofit=True)]
    if rng.random() < 0.6:
        L.append(confetti_layer(rng, ctx, 1000, 110, 262, 18))
    L += bottom_pair(rng, [e for e in els if e not in KB] or alt_els(ctx), ctx)
    return L, dict(top=345)

def T_parade(rng, els, ctx):
    g = [e for e in els if elkind(e) in ("ground", "perch")]
    a, b = pick(rng, g, 2)
    L = corner(rng, a, True, ctx, 350, 420) + corner(rng, b, False, ctx, 350, 420)
    r = rng.random()
    if r < 0.4: L.append(confetti_layer(rng, ctx, 1000, 290, 160, 40))
    elif r < 0.7: L.append(small(stars_layer(rng, "gold", 1000, 290, 160, 24)))
    L += top_flowers(rng, ctx, 2, 0.95)
    return L, dict(top=330)

def T_rainbow(rng, els, ctx):
    seed = rng.randrange(1000)
    rb = ensure(f"g-rainbow-{seed}-75", lambda: gold.rainbow(620, 330, seed, opacity=0.75))
    left = rng.random() < 0.5
    rx = 300 if left else 780
    L = [place(rb, 580, rx, 190, 0, blend="normal"), place("g-cloud", 230, rx - 230, 310, 0, blend="normal"), place("g-cloud2", 210, rx + 230, 315, 0, blend="normal", flip=True)]
    g = [e for e in els if elkind(e) in ("ground", "perch")]
    a = pick(rng, g or alt_els(ctx), 1)[0]
    f = pick(rng, alt_els(ctx), 2)
    if g:
        L += corner(rng, a, not left, ctx, 350, 420)
    else:
        L.append(flower(a, 340, (930, 1170) if left else (150, 1170), (-0.45, -1) if left else (0.45, -1), flip=left))
    L.append(flower(f[0], 320, (140, 1185) if left else (940, 1185), (0.45, -1) if left else (-0.45, -1), flip=not left))
    L.append(flower(f[1], 380, (900, 150) if left else (180, 150), (-0.8, 1) if left else (0.8, 1), flip=left))
    return L, dict(top=400)

def T_standing(rng, els, ctx):
    t = [e for e in els if e in TALL]
    a = pick(rng, t, 1)[0]
    left = rng.random() < 0.5
    f1, f2, f3 = pick(rng, alt_els(ctx), 3)
    L = [flower(f3, 330, (60, 1215) if left else (1020, 1215), (0.55, -1) if left else (-0.55, -1), flip=not left), ground(a, 320, 700, 170 if left else 910, bottom=1330, flip=not left)]
    if left:
        L += [flower(f1, 420, (870, 160), (-0.8, 1), flip=True), flower(f2, 320, (945, 1180), (-0.45, -1), flip=True)]
        return L, dict(x=300, w=640, top=300)
    L += [flower(f1, 420, (210, 160), (0.8, 1)), flower(f2, 320, (135, 1180), (0.45, -1))]
    return L, dict(x=140, w=640, top=300)

def T_perched(rng, els, ctx):
    p = [e for e in els if e in PERCH]
    a = pick(rng, p, 1)[0]
    right = rng.random() < 0.6
    L = [hang(a, 360, 470, 900 if right else 180, 12, flip=right)]
    if ctx["group"] in ("GRAD", "CORP"):
        L.append(small(stars_layer(rng, ctx["tone"] if ctx["tone"] in ("gold", "silver", "rose") else "gold", 520, 230, 160, 14)))
        L[-1]["cx"] = 300 if right else 780
    f1, f2 = pick(rng, alt_els(ctx), 2)
    L += [flower(f1, 350, (140, 1175), (0.45, -1)), flower(f2, 350, (940, 1175), (-0.45, -1), flip=True)]
    return L, dict(x=140 if right else 300, w=640, top=320)

def _foil_tone(ctx):
    return ctx["tone"] if ctx["tone"] in ("gold", "silver", "rose") else "gold"

def T_laurelcap(rng, els, ctx):
    tone = _foil_tone(ctx)
    laurel = ensure(gold_name("g-laurel", tone), lambda: gold.laurel_wreath(420, tone))
    L = [small(place(laurel, 380, 540, 210, 0, blend="normal"))]
    if ctx["group"] == "CORP":
        star = ensure(gold_name("g-star8", tone), lambda: gold.star(140, 8, 0.55, tone))
        L.append(small(place(star, 92, 540, 198, 0, blend="normal")))
    else:
        cap = ensure(gold_name("g-cap", tone), lambda: gold.mortarboard(300, tone))
        L.append(small(place(cap, 205, 540, 205, 0, blend="normal")))
    if not ctx["dark"] or rng.random() < 0.5:
        L += top_flowers(rng, ctx, 2, 0.8)
    if els:
        L += bottom_pair(rng, els, ctx)
    else:
        band = ensure(gold_name("g-band-thin", tone), lambda: gold.geometric_band(1080, 56, lw=1.8, tone=tone))
        pat = ensure(gold_name("g-pattern", tone), lambda: gold.pattern_field(1080, 1350, 120, 1.2, tone))
        L.insert(0, place(pat, 1080, 540, 675, 0, nofit=True, blend="normal", opacity=0.2 if ctx["dark"] else 0.26))
        L.append(place(band, 1080, 540, 1310, 0, nofit=True, blend="normal"))
        L.append(small(stars_layer(rng, tone, 300, 220, 230, 10))); L[-1]["cx"] = 165
        L.append(small(stars_layer(rng, tone, 300, 220, 230, 10))); L[-1]["cx"] = 915
        return L, dict(top=415, bottom=150)
    return L, dict(top=415)

def T_capstoss(rng, els, ctx):
    tone = _foil_tone(ctx)
    cap = ensure(gold_name("g-cap", tone), lambda: gold.mortarboard(300, tone))
    L = [small(stars_layer(rng, tone, 1000, 300, 170, 24))]
    for (x, y, w, r) in ((190, 160, 190, -18), (560, 95, 140, 12), (880, 180, 170, 24)):
        L.append(small(place(cap, w, x, y, r + round(rng.uniform(-6, 6), 1), blend="normal")))
    L += bottom_pair(rng, els or alt_els(ctx), ctx)
    return L, dict(top=360)

def T_henna(rng, els, ctx):
    tone = "henna" if not ctx["dark"] and rng.random() < 0.55 else _foil_tone(ctx)
    m = ensure(f"g-mandala-{tone}", lambda: gold.mandala(560, tone))
    mw = 760
    p1 = ensure(f"g-paisley-{tone}", lambda: gold.paisley(220, tone))
    L = [place(m, mw, 0, 0, 0, blend="normal", nofit=True), place(m, mw, 1080, 0, 0, blend="normal", nofit=True)]
    L += [small(place(p1, 150, 540, 180, 0, blend="normal"))]
    g = [e for e in els if elkind(e) in ("ground", "perch")]
    if g:
        a = pick(rng, g, 1)[0]
        f = pick(rng, alt_els(ctx), 1)[0]
        left = rng.random() < 0.5
        L += corner(rng, a, left, ctx, 340, 440) + [flower(f, 360, (940, 1175) if left else (140, 1175), (-0.45, -1) if left else (0.45, -1), flip=left)]
    else:
        L += bottom_pair(rng, els, ctx)
    return L, dict(top=360)

def T_hennaarch(rng, els, ctx):
    tone = "henna" if not ctx["dark"] and rng.random() < 0.5 else _foil_tone(ctx)
    arch = ensure(f"g-arch-{tone}" if tone != "gold" else "g-arch", lambda: gold.arch_frame(1080, 1350, 72, 70, tone=tone))
    m = ensure(f"g-mandala-sm-{tone}", lambda: gold.mandala(300, tone, rings=3))
    p = ensure(f"g-paisley-{tone}", lambda: gold.paisley(220, tone))
    L = [place(arch, 1080, 540, 675, 0, blend="normal", nofit=True), small(place(m, 250, 540, 255, 0, blend="normal")),
         small(place(p, 125, 132, 640, -12, blend="normal")), small(place(p, 125, 948, 640, 12, blend="normal", flip=True))]
    L += bottom_pair(rng, [e for e in els if elkind(e) == "plant"] or alt_els(ctx), ctx)
    return L, dict(x=200, w=680, top=400)

def T_still(rng, els, ctx):
    g = [e for e in els if elkind(e) == "ground"]
    a, b = pick(rng, g, 2)
    L = corner(rng, a, True, ctx, 320, 460) + corner(rng, b, False, ctx, 320, 460)
    if rng.random() < 0.55:
        swag = rng.choice(["swag-redroses", "swag-spring", "swag-roses", "swag-flowers"])
        sw = fitw(swag, 1040, 280)
        L.append(place(swag, sw, 540, hgt(swag, sw) / 2 + 8, 0, nofit=True))
        top = max(330, round(hgt(swag, sw) + 50))
    else:
        L += top_flowers(rng, ctx, 2, 1.0)
        top = 330
    return L, dict(top=top)

def T_swagtop(rng, els, ctx):
    swag = rng.choice(["swag-redroses", "swag-spring", "swag-roses"])
    sw = fitw(swag, 1040, 280)
    L = [place(swag, sw, 540, hgt(swag, sw) / 2 + 8, 0, nofit=True)]
    L += bottom_pair(rng, els or alt_els(ctx), ctx)
    return L, dict(top=max(330, round(hgt(swag, sw) + 50)))

def T_wreathtop(rng, els, ctx):
    w = 255
    L = [place("wreath-flowers", w, 540, 25 + hgt("wreath-flowers", w) / 2, 0, nofit=True)]
    L += bottom_pair(rng, els or alt_els(ctx), ctx)
    return L, dict(top=385)

def T_hearts(rng, els, ctx):
    tone = "rose" if not ctx["dark"] else _foil_tone(ctx)
    seed = rng.randrange(1000)
    hs = ensure(f"g-hearts-big-{seed}-{tone}", lambda: gold.hearts(1000, 330, 16, seed, tone, sizes=(26, 34, 44, 56)))
    L = [small(place(hs, 1000, 540, 175, 0, blend="normal"))]
    L += top_flowers(rng, ctx, 2, 0.85)
    L += bottom_pair(rng, els or alt_els(ctx), ctx)
    return L, dict(top=345)

def T_crowned(rng, els, ctx):
    tone = _foil_tone(ctx)
    cr = ensure(gold_name("g-crown", tone), lambda: gold.crown(240, tone))
    L = [confetti_layer(rng, ctx, 1000, 300, 165, 40), small(place(cr, 210, 540, 160, 0, blend="normal"))] + top_flowers(rng, ctx, 2, 0.85)
    L += bottom_pair(rng, [e for e in els if e not in KB] or alt_els(ctx), ctx)
    return L, dict(top=340)

def T_lambmoon(rng, els, ctx):
    tone = _foil_tone(ctx)
    lamb = pick(rng, [e for e in els if e in ("lamb-lying", "sheep-sketch", "rabbit-angora", "hare-meadow")], 1)[0]
    f1, f2 = pick(rng, alt_els(ctx), 2)
    left = rng.random() < 0.5
    L = [small(crescent_layer(rng, tone, 860 if left else 220, 175, 170, flip=not left)), small(stars_layer(rng, tone, 1000, 300, 170, 22)),
         *corner(rng, lamb, left, ctx, 360, 300, spray=1.0), flower(f1, 330, (945, 1180) if left else (135, 1180), (-0.45, -1) if left else (0.45, -1), flip=left),
         flower(f2, 380, (200, 150) if left else (880, 150), (0.8, 1) if left else (-0.8, 1), flip=not left)]
    return L, dict(top=355)

def T_lambmeadow(rng, els, ctx):
    """A lamb in the grass, flower sprays above and a small gold crescent."""
    tone = _foil_tone(ctx)
    lamb = pick(rng, els, 1)[0]
    f1, f2, f3 = pick(rng, alt_els(ctx), 3)
    left = rng.random() < 0.5
    L = [flower(f1, 400, (210, 150), (0.8, 1)), flower(f2, 400, (870, 150), (-0.8, 1), flip=True), small(crescent_layer(rng, tone, 540, 150, 110)),
         *corner(rng, lamb, left, ctx, 360, 300, spray=1.0), flower(f3, 330, (945, 1180) if left else (135, 1180), (-0.45, -1) if left else (0.45, -1), flip=left)]
    return L, dict(top=340)

def T_carousel(rng, els, ctx):
    """Painted toys and gold stars hanging on threads, like a nursery mobile."""
    hangs = [e for e in els if e in SMALL_HANG] + ["butterfly-brown", "toy-top"]
    items = pick(rng, list(dict.fromkeys(hangs)), 2)
    tone = "gold"
    st = gold_name("g-star8", tone); ensure(st, lambda: gold.star(140, 8, 0.55, tone))
    L = []
    for x, ln in ((180, 130), (340, 230), (740, 230), (900, 130)):
        line = ensure(f"g-string-{ln}", lambda ln=ln: _string(ln))
        L.append(place(line, 8, x, ln / 2, 0, blend="normal", nofit=True))
    L += [small(hang(items[0], 190, 200, 180, 125)), small(place(st, 64, 340, 260, 0, blend="normal")), small(place(st, 64, 740, 260, 0, blend="normal")), small(hang(items[1], 190, 200, 900, 125, flip=True))]
    L += bottom_pair(rng, [e for e in els if e not in KB and e not in items] or alt_els(ctx), ctx)
    return L, dict(top=345)

def T_scatter(rng, els, ctx):
    a, b, c, d = pick(rng, els, 4)
    L = [place(a, fitw(a, 240, 260), 165, 165, round(rng.uniform(-18, 18), 1)), place(b, fitw(b, 210, 230), 915, 175, round(rng.uniform(-18, 18), 1), flip=True),
         place(c, fitw(c, 230, 250), 160, 1185, round(rng.uniform(-18, 18), 1)), place(d, fitw(d, 250, 260), 920, 1180, round(rng.uniform(-18, 18), 1), flip=True)]
    return L, dict(top=330)

def T_orchard(rng, els, ctx):
    fruit = [e for e in els if e.startswith(("cherry", "cherries"))] or els
    a, b = pick(rng, fruit, 2)
    L = [hang(a, 300, 360, 185, -15, rot=round(rng.uniform(-8, 8), 1)), hang(b, 270, 330, 900, -10, flip=True, rot=round(rng.uniform(-8, 8), 1))]
    low = [e for e in els if e.startswith("straw")] or alt_els(ctx)
    c, d = pick(rng, low, 2)
    L += [flower(c, 250, (140, 1180), (0.45, -1)), flower(d, 250, (940, 1180), (-0.45, -1), flip=True)]
    return L, dict(top=370)

def T_framed(rng, els, ctx):
    tone = _foil_tone(ctx)
    band = ensure(gold_name("g-band-thin", tone), lambda: gold.geometric_band(1080, 56, lw=1.8, tone=tone))
    laurel = ensure(gold_name("g-laurel", tone), lambda: gold.laurel_wreath(420, tone))
    star = ensure(gold_name("g-star8", tone), lambda: gold.star(140, 8, 0.55, tone))
    crest = 280 if els else 340
    L = [place(band, 1080, 540, 40, 0, nofit=True, blend="normal"), place(band, 1080, 540, 1310, 0, nofit=True, blend="normal"),
         small(place(laurel, crest, 540, 200 if els else 205, 0, blend="normal")), small(place(star, crest * 0.25, 540, 192 if els else 195, 0, blend="normal"))]
    if not els:
        pat = ensure(gold_name("g-pattern", tone), lambda: gold.pattern_field(1080, 1350, 120, 1.2, tone))
        L.insert(0, place(pat, 1080, 540, 675, 0, nofit=True, blend="normal", opacity=0.2 if ctx["dark"] else 0.26))
    g = list(dict.fromkeys(e for e in els if elkind(e) == "ground"))
    if g:
        a, b = pick(rng, g, 2) if len(g) >= 2 else (g[0], None)
        for obj, left in ((a, True), (b, False)):
            if obj: L.append(ground(obj, 280, 340, 165 if left else 915, 1280, flip=not left))
    elif els:
        L += bottom_pair(rng, els, ctx)
    return L, dict(top=385 if els else 400, bottom=150)

NEW_TPL = {
    "skyballoons": dict(en="Skies", ar="سماء", desc_en="with hot-air balloons drifting overhead", desc_ar="مع مناطيد تحلّق في الأعلى"),
    "foilballoons": dict(en="Balloons", ar="بالونات", desc_en="with a bunch of shining balloons and confetti", desc_ar="مع باقة بالونات لامعة وقصاصات ملوّنة"),
    "bunting": dict(en="Bunting", ar="رايات", desc_en="under a string of party bunting", desc_ar="تحت حبل من الرايات الاحتفالية"),
    "parade": dict(en="Parade", ar="موكب", desc_en="lined up along the bottom of the card", desc_ar="تصطف على طول أسفل البطاقة"),
    "rainbow": dict(en="Rainbow", ar="قوس قزح", desc_en="under a soft watercolour rainbow", desc_ar="تحت قوس قزح مائي ناعم"),
    "standing": dict(en="Portrait", ar="لوحة", desc_en="standing tall at the side of the card", desc_ar="تقف شامخة على جانب البطاقة"),
    "perched": dict(en="Perch", ar="غصن", desc_en="perched in the corner", desc_ar="تجثم في زاوية البطاقة"),
    "laurelcap": dict(en="Laurels", ar="أكاليل الغار", desc_en="beneath a gold laurel wreath", desc_ar="تحت إكليل غار ذهبي"),
    "capstoss": dict(en="Celebration", ar="احتفال", desc_en="with graduation caps tossed into a starry sky", desc_ar="مع قبعات تخرّج تتطاير في سماء مرصّعة بالنجوم"),
    "henna": dict(en="Mehndi", ar="حنّاء", desc_en="among henna rosettes and paisleys", desc_ar="بين نقوش الحنّاء والبوتة"),
    "hennaarch": dict(en="Henna Arch", ar="قوس الحنّاء", desc_en="framed by an arch with henna rosettes", desc_ar="داخل قوس مع نقوش الحنّاء"),
    "still": dict(en="Still Life", ar="طبيعة صامتة", desc_en="arranged as a still life", desc_ar="في لوحة طبيعة صامتة"),
    "swagtop": dict(en="Swags", ar="أكاليل", desc_en="under hanging garlands of flowers", desc_ar="تحت أكاليل زهور متدلية"),
    "wreathtop": dict(en="Wreath", ar="إكليل الزهر", desc_en="beneath a painted flower wreath", desc_ar="تحت إكليل زهور مرسوم"),
    "hearts": dict(en="Hearts", ar="قلوب", desc_en="with a scatter of foil hearts", desc_ar="مع قلوب لامعة متناثرة"),
    "crowned": dict(en="Little Crown", ar="التاج الصغير", desc_en="under a gold crown and confetti", desc_ar="تحت تاج ذهبي وقصاصات ملوّنة"),
    "lambmoon": dict(en="Moonlight", ar="ضوء القمر", desc_en="under a gold crescent and stars", desc_ar="تحت هلال ذهبي ونجوم"),
    "lambmeadow": dict(en="Meadow", ar="مرج", desc_en="in a meadow under flower sprays and a little crescent", desc_ar="في مرج تحت أغصان زهر وهلال صغير"),
    "carousel": dict(en="Carousel", ar="الدوّارة", desc_en="with toys and stars hanging like a nursery mobile", desc_ar="مع ألعاب ونجوم تتدلى كمعلّقة فوق سرير الطفل"),
    "scatter": dict(en="Collection", ar="مجموعة", desc_en="gathered in the four corners", desc_ar="تتوزع في زوايا البطاقة الأربع"),
    "orchard": dict(en="Orchard", ar="بستان", desc_en="hanging from the top like an orchard", desc_ar="تتدلى من الأعلى كأنها بستان"),
    "framed": dict(en="Gilt", ar="إطار مذهّب", desc_en="between fine gold bands with a laurel crest", desc_ar="بين أشرطة ذهبية رفيعة مع شعار من الغار", gold=True),
}
TPL.update(NEW_TPL)
TEMPLATES = dict(gen.TEMPLATES)
TEMPLATES.update({k[2:].lower(): v for k, v in globals().items() if k.startswith("T_")})

def compatible(tpl, fam):
    F = FAM[fam] if fam else None
    els = [e for e in (F["els"] if F else []) if os.path.exists(f"{gen.CUT}/{e}.png")]
    kinds = {elkind(e) for e in els}
    plants = kinds == {"plant"}
    if tpl in ("garland", "mirror", "diag", "cascade", "meadow", "sides", "crown", "clouds"):
        return plants
    if tpl == "skyballoons": return fam is not None and (fam == "kballoon" or kinds & {"ground", "plant", "perch"})
    if tpl == "foilballoons": return fam != "kballoon"
    if tpl == "parade": return len([e for e in els if elkind(e) in ("ground", "perch")]) >= 2
    if tpl == "rainbow": return fam != "kballoon"
    if tpl == "standing": return len([e for e in els if e in TALL]) >= 2
    if tpl == "perched": return any(e in PERCH for e in els)
    if tpl in ("laurelcap", "framed"): return fam is None or not plants or fam in ("ksun", "green")
    if tpl == "capstoss": return fam is not None
    if tpl == "still": return len([e for e in els if elkind(e) == "ground"]) >= 2
    if tpl in ("lambmoon", "lambmeadow"): return fam in ("blamb", "alamb")
    if tpl == "carousel": return fam in ("bnursery", "ktoys", "bpram", "blamb", "bstork", "kzoo")
    if tpl == "scatter": return fam == "oshell"
    if tpl == "orchard": return fam == "kfruit"
    if tpl in ("henna", "hennaarch"): return fam in ("hpeacock", "hglass", "redrose", "rrose", "rjasmine")
    return True

# ─────────────────────────── occasion groups ───────────────────────────
L_PASTEL = ["sky", "powder", "blush", "rose", "mint", "sage", "butter", "lilac", "cream", "peach"]
GROUPS = {
    "KIDS": dict(n=60, occ=["BIRTHDAY"], fams=["kballoon", "ktoys", "kzoo", "kfruit", "ksun"], cap={"kfruit": 7, "ksun": 7, "ktoys": 22, "kzoo": 20, "kballoon": 14},
                 tpls=["skyballoons", "foilballoons", "bunting", "parade", "rainbow", "standing", "crowned", "carousel", "orchard", "garland", "diag"],
                 light=["sky", "powder", "blush", "butter", "mint", "cream", "peach", "lilac", "ivory"], dark=["navy"], dark_share=0.06,
                 lang=[("EN", 0.45), ("AR", 0.35), ("BILINGUAL", 0.2)], style="playful", div=["dots", "star", "heart"]),
    "ADULT": dict(n=45, occ=["BIRTHDAY"], fams=["abloom", "abird", "aglass", "ksun", "peony", "obasket"], cap={"ksun": 7},
                  tpls=["foilballoons", "bunting", "swagtop", "still", "wreathtop", "perched", "garland", "mirror", "cascade", "orchard"],
                  light=["ivory", "cream", "blush", "champagne", "sage", "pearl", "peach", "linen"], dark=["navy", "emerald", "onyx", "burgundy", "charcoal"], dark_share=0.3,
                  lang=[("EN", 0.45), ("AR", 0.35), ("BILINGUAL", 0.2)], style="floral", div=["floral", "dots", "diamond"]),
    "SHOWER": dict(n=50, occ=["BABY_SHOWER", "NEWBORN"], fams=["bstork", "bpram", "bnursery", "blamb", "bswan", "kballoon"],
                   tpls=["skyballoons", "foilballoons", "bunting", "parade", "rainbow", "standing", "carousel"],
                   light=L_PASTEL, dark=[], dark_share=0.0, lang=[("EN", 0.45), ("AR", 0.35), ("BILINGUAL", 0.2)], style="playful", div=["heart", "star", "dots"]),
    "NEWBORN2": dict(n=35, occ=["NEWBORN", "BABY_SHOWER"], fams=["bstork", "bpram", "bnursery", "blamb", "bswan", "kballoon"],
                     tpls=["rainbow", "parade", "standing", "carousel", "skyballoons", "lambmoon", "foilballoons"],
                     light=L_PASTEL, dark=[], dark_share=0.0, lang=[("EN", 0.4), ("AR", 0.4), ("BILINGUAL", 0.2)], style="playful", div=["star", "heart"]),
    "AQIQAH": dict(n=20, occ=["AQIQAH", "NEWBORN"], fams=["alamb"], tpls=["lambmoon", "lambmeadow", "rainbow"],
                   light=["sky", "powder", "blush", "mint", "sage", "cream", "ivory", "butter", "lilac", "peach", "sand"], dark=[], dark_share=0.0,
                   lang=[("AR", 0.55), ("BILINGUAL", 0.3), ("EN", 0.15)], style="heritage", div=["star"]),
    "GRAD": dict(n=40, occ=["GRADUATION"], fams=["gowl", "gglobe", "gcup", "ksun", None], cap={None: 4, "ksun": 6},
                 tpls=["laurelcap", "capstoss", "perched", "standing", "parade", "framed"],
                 light=["ivory", "cream", "champagne", "pearl", "sky", "sage", "linen"], dark=["navy", "midnight", "emerald", "onyx", "burgundy", "charcoal"], dark_share=0.4,
                 lang=[("EN", 0.45), ("AR", 0.3), ("BILINGUAL", 0.25)], style="classic", div=["diamond", "star", "hairline"]),
    "HENNA": dict(n=40, occ=["HENNA"], fams=["hpeacock", "hglass", "redrose", "rrose", "rjasmine"],
                  tpls=["henna", "hennaarch", "standing", "perched", "still", "swagtop"],
                  light=["blush", "rose", "champagne", "cream", "sand", "peach"], dark=["burgundy", "emerald", "plum", "teal", "onyx"], dark_share=0.45,
                  lang=[("AR", 0.6), ("BILINGUAL", 0.25), ("EN", 0.15)], style="heritage", div=["floral", "diamond"]),
    "CORP": dict(n=30, occ=["CORPORATE"], fams=["cobj", "green", "aglass", None], cap={None: 6, "cobj": 16, "aglass": 8}, tpls=["framed", "laurelcap", "still", "parade"],
                 light=["ivory", "pearl", "champagne", "sand", "linen"], dark=["navy", "midnight", "onyx", "emerald", "charcoal", "forest"], dark_share=0.55,
                 lang=[("EN", 0.5), ("BILINGUAL", 0.3), ("AR", 0.2)], style="classic", div=["hairline", "diamond"]),
    "LOVE": dict(n=25, occ=["ENGAGEMENT", "ANNIVERSARY"], fams=["eswan", "aglass", "rose", "redrose", "peony", "white"],
                 tpls=["hearts", "swagtop", "wreathtop", "still", "standing", "perched", "parade"],
                 light=["ivory", "blush", "rose", "champagne", "pearl", "cream"], dark=["burgundy", "emerald", "navy", "onyx"], dark_share=0.25,
                 lang=[("EN", 0.4), ("AR", 0.35), ("BILINGUAL", 0.25)], style="floral", div=["heart", "floral"]),
    "GATHER": dict(n=35, occ=["OTHER"], fams=["ocoffee", "oshell", "ocamel", "obasket", "kfruit", "rcitrus", "rpom"], cap={"kfruit": 5, "rpom": 5, "rcitrus": 5},
                   tpls=["still", "parade", "scatter", "orchard", "swagtop", "standing", "garland", "diag", "bunting"],
                   light=["ivory", "cream", "sand", "sage", "sky", "butter", "peach", "linen"], dark=["teal", "navy", "emerald", "charcoal"], dark_share=0.2,
                   lang=[("EN", 0.4), ("AR", 0.4), ("BILINGUAL", 0.2)], style="classic", div=["floral", "dots", "diamond"]),
}

FONTS3 = {
    "KIDS": dict(display=["fredoka", "quicksand", "fredoka"], body=["quicksand", "jost"], ard=["baloo", "lemonada", "marhey"], arb=["baloo", "plex-arabic"],
                 names=[("pacifico", "lemonada"), ("dancing-script", "marhey"), (None, "baloo"), ("dancing-script", "lalezar"), ("pacifico", "marhey"), (None, None)], formal=[]),
    "ADULT": dict(display=["cormorant", "playfair", "italiana"], body=["cormorant", "jost"], ard=["amiri", "aref-ruqaa", "el-messiri"], arb=["amiri", "plex-arabic"],
                  names=[("great-vibes", "aref-ruqaa"), ("parisienne", "katibeh"), ("alex-brush", "rakkas"), (None, None), ("allura", "aref-ruqaa")], formal=["cinzel", "italiana"]),
    "SHOWER": gen.FONTS["NEWBORN"], "NEWBORN2": gen.FONTS["NEWBORN"],
    "AQIQAH": dict(display=["cormorant", "quicksand"], body=["cormorant", "jost"], ard=["aref-ruqaa", "amiri", "el-messiri"], arb=["amiri", "plex-arabic"],
                   names=[(None, "aref-ruqaa"), ("great-vibes", "katibeh"), (None, "amiri"), ("dancing-script", "alkalami")], formal=[]),
    "GRAD": dict(display=["cinzel", "playfair", "cormorant", "marcellus"], body=["jost", "cormorant"], ard=["el-messiri", "reem-kufi", "amiri"], arb=["plex-arabic", "amiri"],
                 names=[(None, None), ("great-vibes", "aref-ruqaa"), (None, "reem-kufi"), ("pinyon", "rakkas")], formal=["cinzel", "marcellus"]),
    "HENNA": dict(display=["cormorant", "playfair", "italiana"], body=["cormorant", "jost"], ard=["aref-ruqaa", "rakkas", "katibeh", "el-messiri"], arb=["amiri", "plex-arabic"],
                  names=[(None, "aref-ruqaa"), ("great-vibes", "katibeh"), (None, "rakkas"), ("pinyon", "gulzar"), (None, "alkalami"), ("parisienne", "ruwudu")], formal=[]),
    "CORP": dict(display=["cinzel", "marcellus", "playfair", "jost"], body=["jost", "cormorant"], ard=["el-messiri", "reem-kufi", "plex-arabic"], arb=["plex-arabic"],
                 names=[(None, None), (None, "reem-kufi")], formal=["cinzel", "marcellus"]),
    "LOVE": gen.FONTS["WEDDING"],
    "GATHER": dict(display=["cormorant", "playfair", "jost"], body=["jost", "cormorant"], ard=["el-messiri", "amiri", "aref-ruqaa"], arb=["plex-arabic", "amiri"],
                   names=[(None, None), ("great-vibes", "aref-ruqaa"), (None, "rakkas"), ("parisienne", "katibeh")], formal=["marcellus"]),
}

def fonts_for(rng, group, fam, tpl):
    F = FONTS3[group]
    formal = F["formal"] and (group == "CORP" or tpl in ("framed", "laurelcap")) and rng.random() < 0.7
    names = rng.choice(F["names"])
    if formal:
        return [rng.choice(F["formal"]), rng.choice(F["body"]), rng.choice(F["ard"]), rng.choice(F["arb"])], (None, names[1]), 0.8, True
    disp = rng.choice(F["display"])
    scale = 1.05 if names[0] in ("great-vibes", "pinyon", "dancing-script", "parisienne", "alex-brush", "allura") else (0.95 if names[0] == "pacifico" else 1.0)
    return [disp, rng.choice(F["body"]), rng.choice(F["ard"]), rng.choice(F["arb"])], names, scale, False

def style_for(group, fam, paper, tpl):
    dark = PAPERS[paper]["dark"]
    if dark and group not in ("KIDS",): return "luxe"
    if group in ("KIDS", "SHOWER", "NEWBORN2"):
        return "floral" if fam in ("ksun", "kfruit") and tpl in ("garland", "diag") else "playful"
    if group == "AQIQAH": return "heritage" if tpl in ("lambmoon", "lambmeadow") else "playful"
    if group == "HENNA": return "heritage" if tpl in ("henna", "hennaarch") else "floral"
    if group in ("GRAD", "CORP"): return "classic"
    if group == "GATHER": return "floral" if fam in ("obasket", "kfruit", "rcitrus", "rpom") else "classic"
    return "floral"

def choose(rng, pairs):
    r, acc = rng.random(), 0
    for v, p in pairs:
        acc += p
        if r <= acc: return v
    return pairs[0][0]

# ─────────────────────────── assembly ───────────────────────────
def build(group, fam, tpl, paper, rng):
    dark = PAPERS[paper]["dark"]
    tone = "gold" if not dark or rng.random() < 0.8 else rng.choice(["silver", "rose"])
    if group in ("SHOWER", "NEWBORN2", "KIDS", "AQIQAH"): tone = "gold"
    ctx = dict(paper=paper, dark=dark, tone=tone, group=group, fam=fam)
    els = [e for e in (FAM[fam]["els"] if fam else []) if os.path.exists(f"{gen.CUT}/{e}.png")]
    layers, geo = TEMPLATES[tpl](rng, els, ctx)
    content = (geo.get("x", 170), geo.get("w", 740), geo.get("top", 330))
    bottom = geo.get("bottom", 95)
    zs = zones3(content, bottom)
    blend = "lift" if dark else "multiply"
    for L in layers:
        L.setdefault("blend", blend)
        if L["blend"] == "multiply" and dark: L["blend"] = "lift"
    fitted = autofit3(layers, zs)
    painted_in = [L for L in layers if not L["src"].startswith("g-")]
    painted = [L for L in fitted if not L["src"].startswith("g-")]
    if len(painted) < min(2, len(painted_in)):
        return None
    # The template's main subject must survive the fitting.
    if fam and els and not any(L["src"] in els for L in fitted) and tpl not in ("skyballoons",):
        return None
    ink = sum(on_canvas(L) for L in fitted)
    if ink < (40000 if TPL[tpl].get("gold") or not fam else 80000):
        return None
    recipe = dict(paper={"color": PAPERS[paper]["rgb"][0], "color2": PAPERS[paper]["rgb"][1], "mottle": 0.018 if not dark else 0.03, "grain": 0.012 if not dark else 0.02, "vignette": 0.06 if not dark else 0.18},
                  washes=washes_for(rng, paper, fam), frames=[] if tpl in ("henna", "hennaarch", "framed", "bunting", "swagtop") else frames_for(rng, paper, tone if tone != "henna" else "gold", tpl),
                  layers=fitted, content={"x": content[0], "w": content[1], "top": content[2]}, bottomPad=bottom, quality=82)
    return recipe, ctx

def naming(fam, tpl, paper):
    T, P = TPL[tpl], PAPERS[paper]
    if not fam:
        return f"{P['en']} {T['en']}", f"{T['ar']} · {P['ar']}", f"{T['desc_en'][0].upper()}{T['desc_en'][1:]}, on {P['en'].lower()} paper.", f"{T['desc_ar']}، على ورق {P['ar']}."
    F = FAM[fam]
    return f"{F['en']} {T['en']}", f"{T['ar']} {F['ar']}", f"{F['desc_en']} {T['desc_en']}, on {P['en'].lower()} paper.", f"{F['desc_ar']} {T['desc_ar']}، على ورق {P['ar']}."

def generate(seed=1):
    os.makedirs(OUT, exist_ok=True)
    ex = json.load(open("artdata/existing-names.json"))
    used_en = {n.lower() for n in ex["en"]}; used_ar = set(ex["ar"]); used_keys = set(ex["keys"])
    rows = []
    for group, G in GROUPS.items():
        rng = random.Random(f"{seed}-{group}")
        combos = []
        for tpl in G["tpls"]:
            for fam in G["fams"]:
                if not compatible(tpl, fam): continue
                for paper in G["light"] + G["dark"]:
                    if PAPERS[paper]["dark"] and tpl in ("rainbow", "skyballoons", "carousel"): continue
                    combos.append((fam, tpl, paper))
        rng.shuffle(combos)
        per = G["n"]
        quota_dark = round(per * G["dark_share"])
        count = {"tpl": {}, "fam": {}, "paper": {}}
        n_dark = chosen = 0
        cap_tpl = math.ceil(per / len(G["tpls"])) + 3
        cap_fam = math.ceil(per / len(G["fams"])) + 4
        cap_paper = math.ceil(per / max(1, len(G["light"]) + len(G["dark"]))) + 4
        for fam, tpl, paper in combos:
            if chosen >= per: break
            dark = PAPERS[paper]["dark"]
            if dark and n_dark >= quota_dark: continue
            if not dark and (chosen - n_dark) >= per - quota_dark: continue
            if count["tpl"].get(tpl, 0) >= cap_tpl or count["fam"].get(fam, 0) >= G.get("cap", {}).get(fam, cap_fam) or count["paper"].get(paper, 0) >= cap_paper: continue
            en, ar, desc_en, desc_ar = naming(fam, tpl, paper)
            if en.lower() in used_en or ar in used_ar:
                en = f"{en} · {PAPERS[paper]['en']}"; ar = f"{ar} · {PAPERS[paper]['ar']}"
                if en.lower() in used_en or ar in used_ar: continue
            key = slug(en.replace("·", " ").replace("&", "and"))
            if key in used_keys or any(seg in ("en", "ar", "bi") for seg in key.split("-")): continue
            r = random.Random(f"{seed}-{key}")
            built = build(group, fam, tpl, paper, r)
            if not built: continue
            recipe, ctx = built
            pal = palette(fam, paper, ctx["tone"] if ctx["tone"] in ("gold", "silver", "rose") else "gold")
            fonts, names, scale, upper = fonts_for(r, group, fam, tpl)
            lang = choose(r, G["lang"])
            premium = dark or tpl in ("hennaarch", "framed", "laurelcap", "henna", "wreathtop") or r.random() < 0.2
            occs = list(G["occ"])
            if group == "ADULT" and r.random() < 0.3: occs.append("ANNIVERSARY")
            if group == "KIDS" and fam in ("kballoon", "ktoys") and r.random() < 0.3: occs.append("BABY_SHOWER")
            if group == "HENNA" and r.random() < 0.4: occs.append("ENGAGEMENT")
            if group == "LOVE" and r.random() < 0.35: occs.append("WEDDING")
            if group == "CORP" and tpl in ("framed", "laurelcap") and r.random() < 0.5: occs.append("GRADUATION")
            if group == "GRAD" and fam is None: occs.append("CORPORATE")
            if group == "GATHER" and fam in ("kfruit", "obasket", "oshell") and r.random() < 0.5: occs.append("BIRTHDAY")
            if group == "GATHER" and fam in ("ocoffee", "rpom", "rcitrus") and r.random() < 0.4: occs.append("RAMADAN")
            row = dict(k=key, o=occs, c=pal, f=fonts, b=[recipe["content"]["x"], recipe["content"]["w"], recipe["content"]["top"], recipe["bottomPad"]],
                       d=r.choice(G["div"]), y=style_for(group, fam, paper, tpl),
                       names=dict(en=dict(name=en, description=desc_en), ar=dict(name=ar, description=desc_ar)),
                       meta=dict(occ=group, fam=fam, tpl=tpl, paper=paper, tone=ctx["tone"]))
            if premium: row["p"] = 1
            if lang != "EN": row["l"] = lang
            if names != (None, None): row["n"] = list(names)
            if scale != 1.0: row["s"] = scale
            if upper: row["u"] = 1
            json.dump({"key": key, **recipe}, open(f"{OUT}/{key}.json", "w"), indent=1)
            rows.append(row)
            used_en.add(en.lower()); used_ar.add(ar); used_keys.add(key)
            count["tpl"][tpl] = count["tpl"].get(tpl, 0) + 1
            count["fam"][fam] = count["fam"].get(fam, 0) + 1
            count["paper"][paper] = count["paper"].get(paper, 0) + 1
            chosen += 1; n_dark += int(dark)
        print(group, chosen, "/", per, "designs; dark", n_dark, "| templates", count["tpl"])
    json.dump(rows, open("artdata/collection3.json", "w"), indent=1, ensure_ascii=False)
    return rows

if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    rows = generate(seed)
    print(len(rows), "rows")
