"""Export the artwork for INVTRA Studio (the free-form editor) into the app.

From the working folder that holds artdata/ (cut-outs and the design recipes), writes:
  public/studio/a/<id>.webp          each painted piece or ornament (painted ≤ 900 px, gold ≤ 1200 px)
  public/studio/t/<id>.webp          its thumbnail for the asset panel (≤ 220 px)
  public/studio/s/<id>.webp          painted pieces only: a soft white silhouette, the "paper" the piece is
                                     printed on (it hides what's underneath and keeps colours true on dark paper)
  public/studio/templates/<key>.json every design decomposed: its paper, washes, frames and pieces
  public/studio/paper.jpg            the paper grain laid over plain backgrounds
  src/lib/canvas/assets-data.ts      the catalog: id, size, category, EN/AR names, shown in the library or not
usage: studio.py <repo>
"""
import json, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

REPO = sys.argv[1]
CUT = "artdata/cut"
PUB = os.path.join(REPO, "public", "studio")
for d in ("a", "t", "s", "templates"):
    os.makedirs(os.path.join(PUB, d), exist_ok=True)

# ─────────────────────────── names and categories ───────────────────────────
# base word → (English, Arabic, category). Longest match wins, so "rose-bouquet" finds "rose-bouquet" first.
BASE = {
    "rose": ("Rose", "وردة", "flowers"), "damask": ("Damask rose", "وردة دمشقية", "flowers"), "carnation": ("Carnation", "قرنفل", "flowers"),
    "peony": ("Peony", "فاوانيا", "flowers"), "camellia": ("Camellia", "كاميليا", "flowers"), "magnolia": ("Magnolia", "ماغنوليا", "flowers"),
    "gardenia": ("Gardenia", "غاردينيا", "flowers"), "orchid": ("Orchid", "أوركيد", "flowers"), "lotus": ("Lotus", "لوتس", "flowers"),
    "waterlily": ("Water lily", "زنبق الماء", "flowers"), "lily": ("Lily", "زنبق", "flowers"), "lilyvalley": ("Lily of the valley", "زنبق الوادي", "flowers"),
    "tulip": ("Tulip", "توليب", "flowers"), "iris": ("Iris", "سوسن", "flowers"), "hydrangea": ("Hydrangea", "هيدرانجيا", "flowers"),
    "wisteria": ("Wisteria", "ويستيريا", "flowers"), "lilac": ("Lilac", "ليلك", "flowers"), "lavender": ("Lavender", "خزامى", "flowers"),
    "jasmine": ("Jasmine", "ياسمين", "flowers"), "anemone": ("Anemone", "شقائق النعمان", "flowers"), "poppy": ("Poppy", "خشخاش", "flowers"),
    "dahlia": ("Dahlia", "داليا", "flowers"), "chrys": ("Chrysanthemum", "أقحوان", "flowers"), "aster": ("Aster", "أستر", "flowers"),
    "daisy": ("Daisy", "زهرة الربيع", "flowers"), "chamomile": ("Chamomile", "بابونج", "flowers"), "buttercup": ("Buttercup", "حوذان", "flowers"),
    "pansy": ("Pansy", "بانسيه", "flowers"), "violet": ("Violet", "بنفسج", "flowers"), "primula": ("Primula", "زهرة الربيع", "flowers"),
    "primrose": ("Primrose", "زهرة الربيع", "flowers"), "auricula": ("Auricula", "أوريكولا", "flowers"), "azalea": ("Azalea", "أزاليا", "flowers"),
    "clematis": ("Clematis", "ياسمين البر", "flowers"), "morningglory": ("Morning glory", "مجد الصباح", "flowers"), "sweetpea": ("Sweet pea", "بازلاء عطرية", "flowers"),
    "forgetmenot": ("Forget-me-not", "لا تنسني", "flowers"), "bluebell": ("Bluebell", "جريس", "flowers"), "hibiscus": ("Hibiscus", "كركديه", "flowers"),
    "passion": ("Passionflower", "زهرة الآلام", "flowers"), "calla": ("Calla lily", "زنبق الكالا", "flowers"), "ranunculus": ("Ranunculus", "حوذان", "flowers"),
    "mallow": ("Mallow", "خبيزة", "flowers"), "myrtle": ("Myrtle", "آس", "greenery"), "cherry": ("Cherry", "كرز", "fruit"),
    "apple": ("Apple blossom", "زهر التفاح", "flowers"), "plum": ("Plum blossom", "زهر البرقوق", "flowers"), "orange": ("Orange", "برتقال", "fruit"),
    "sunflower": ("Sunflower", "دوار الشمس", "flowers"), "gaillardia": ("Blanket flower", "زهرة البطانية", "flowers"), "begonia": ("Begonia", "بيغونيا", "flowers"),
    "yellow": ("Yellow flowers", "أزهار صفراء", "flowers"), "balloon": ("Hot-air balloon", "منطاد", "sky"), "wild": ("Wildflower", "زهرة برية", "flowers"),
    "bouquet": ("Bouquet", "باقة", "bouquets"), "swag": ("Flower garland", "إكليل متدلٍّ", "bouquets"), "wreath": ("Flower wreath", "إكليل زهور", "bouquets"),
    "basket": ("Flower basket", "سلة زهور", "bouquets"),
    "fern": ("Fern", "سرخس", "greenery"), "olive": ("Olive", "زيتون", "greenery"), "laurel": ("Laurel", "غار", "greenery"), "bay": ("Bay laurel", "غار", "greenery"),
    "phillyrea": ("Mock privet", "زرود", "greenery"), "palm": ("Palm", "نخلة", "greenery"), "date": ("Date palm", "نخلة", "greenery"), "fig": ("Fig", "تين", "greenery"),
    "dates": ("Dates", "تمر", "fruit"), "pomegranate": ("Pomegranate", "رمان", "fruit"), "citrus": ("Citrus", "حمضيات", "fruit"), "lemon": ("Lemon", "ليمون", "fruit"),
    "lemons": ("Lemons", "ليمون", "fruit"), "strawberry": ("Strawberry", "فراولة", "fruit"), "strawberries": ("Strawberries", "فراولة", "fruit"), "cherries": ("Cherries", "كرز", "fruit"),
    "hummingbird": ("Hummingbird", "طائر طنان", "birds"), "robin": ("Robin", "أبو الحناء", "birds"), "bird": ("Bird", "طائر", "birds"), "birds": ("Birds", "طيور", "birds"),
    "cardinals": ("Cardinals", "طيور الكاردينال", "birds"), "bee": ("Bee-eater", "وروار", "birds"), "flycatcher": ("Flycatcher", "خاطف الذباب", "birds"),
    "parakeets": ("Parakeets", "ببغاوات", "birds"), "butterfly": ("Butterfly", "فراشة", "birds"), "butterflies": ("Butterflies", "فراشات", "birds"),
    "swallowtails": ("Swallowtail butterflies", "فراشات ذيل السنونو", "birds"), "nest": ("Nest", "عش", "birds"),
    "stork": ("Stork", "لقلق", "animals"), "lamb": ("Lamb", "حمل", "animals"), "sheep": ("Sheep", "خروف", "animals"), "owl": ("Owl", "بومة", "animals"),
    "peacock": ("Peacock", "طاووس", "animals"), "swan": ("Swan", "بجعة", "animals"), "giraffe": ("Giraffe", "زرافة", "animals"), "flamingo": ("Flamingo", "فلامنغو", "animals"),
    "rabbit": ("Rabbit", "أرنب", "animals"), "hare": ("Hare", "أرنب بري", "animals"), "camel": ("Camel", "جمل", "animals"),
    "birdshrike": ("Shrike", "صرد", "birds"), "birdwaxwing": ("Waxwing", "طائر شمعي الجناح", "birds"), "birdberries": ("Bird with berries", "طائر مع التوت", "birds"),
    "birdsyellow": ("Yellow birds", "طيور صفراء", "birds"), "bee-eater": ("Bee-eater", "وروار", "birds"),
    "toy": ("Toy", "لعبة", "toys"), "rocking": ("Rocking horse", "حصان هزاز", "toys"), "noah": ("Noah's ark", "سفينة نوح", "toys"), "pram": ("Pram", "عربة أطفال", "toys"),
    "baby": ("Baby shoes", "حذاء طفل", "toys"),
    "glass": ("Glass", "زجاج", "objects"), "candle": ("Candlestick", "شمعدان", "objects"), "lantern": ("Lantern", "فانوس", "objects"), "brass": ("Brass lamp", "قنديل نحاسي", "objects"),
    "pot": ("Coffee pot", "دلة", "objects"), "teapot": ("Teapot", "إبريق شاي", "objects"), "cup": ("Gilt cup", "كأس مذهبة", "objects"), "trophy": ("Silver trophy", "كأس فضية", "objects"),
    "globe": ("Globe", "كرة أرضية", "objects"), "fan": ("Fan", "مروحة يد", "objects"), "shell": ("Shell", "صدفة", "objects"), "shells": ("Shells", "أصداف", "objects"),
}
# Words after the base: colours and details.
MOD = {
    "pink": ("pink", "وردي"), "blush": ("blush", "وردي فاتح"), "red": ("red", "أحمر"), "white": ("white", "أبيض"), "whites": ("white", "أبيض"),
    "purple": ("purple", "بنفسجي"), "violet": ("violet", "بنفسجي"), "blue": ("blue", "أزرق"), "yellow": ("yellow", "أصفر"), "orange": ("orange", "برتقالي"),
    "cream": ("cream", "كريمي"), "pale": ("pale", "فاتح"), "soft": ("soft", "ناعم"), "deep": ("deep", "داكن"), "darkred": ("dark red", "أحمر داكن"),
    "crimson": ("crimson", "قرمزي"), "scarlet": ("scarlet", "قرمزي"), "coral": ("coral", "مرجاني"), "rose": ("rose", "وردي"), "black": ("black", "أسود"),
    "green": ("green", "أخضر"), "gold": ("gold", "ذهبي"), "silver": ("silver", "فضي"), "brown": ("brown", "بني"), "sky": ("sky blue", "سماوي"),
    "bud": ("bud", "برعم"), "cluster": ("cluster", "عنقود"), "spray": ("spray", "غصن"), "sprays": ("sprays", "أغصان"), "branch": ("branch", "غصن"),
    "bunch": ("bunch", "باقة"), "single": ("single", "مفرد"), "full": ("in bloom", "متفتح"), "bouquet": ("bouquet", "باقة"), "tricolor": ("tricolour", "ثلاثي الألوان"), "stem": ("stem", "ساق"),
    "vine": ("vine", "كرمة"), "frond": ("frond", "سعفة"), "tall": ("tall", "طويل"), "sprig": ("sprig", "غصين"), "leaf": ("on a leaf", "على ورقة"),
    "flower": ("flower", "زهرة"), "fruit": ("fruit", "ثمار"), "hanging": ("hanging", "متدلٍّ"), "plant": ("plant", "نبتة"), "small": ("small", "صغير"),
    "big": ("large", "كبير"), "long": ("long", "طويل"), "mix": ("mix", "تشكيلة"), "trio": ("trio", "ثلاثية"), "grand": ("grand", "كبير"),
    "japan": ("Japanese", "ياباني"), "striped": ("striped", "مخطط"), "stripe": ("striped", "مخطط"), "double": ("double", "مزدوج"),
    "cabbage": ("cabbage", "ملفوفي"), "centifolia": ("centifolia", "مئوي البتلات"), "gallica": ("gallica", "فرنسي"), "bengal": ("Bengal", "بنغالي"),
    "duchesse": ("duchesse", "دوقي"), "blushpink": ("blush pink", "وردي"), "pinkcluster": ("pink cluster", "عنقود وردي"), "pinkwhite": ("pink and white", "وردي وأبيض"),
    "light": ("light", "فاتح"), "peach": ("peach", "خوخي"), "cattleya": ("cattleya", "كاتليا"), "belladonna": ("belladonna", "بيلادونا"),
    "roots": ("with roots", "بجذورها"), "star": ("star", "نجمي"), "oxeye": ("oxeye", "عين الثور"), "japonica": ("japonica", "ياباني"),
    "columbine": ("columbine", "عصفورية"), "gentian": ("gentian", "جنطيانا"), "iris": ("iris", "سوسن"), "paintbrush": ("paintbrush", "فرشاة الرسام"),
    "penstemon": ("penstemon", "بنستمون"), "poppy": ("poppy", "خشخاش"), "oasis": ("oasis", "واحة"), "tree": ("tree", "شجرة"), "brown2": ("brown", "بني"),
    "shrike": ("shrike", "صرد"), "waxwing": ("waxwing", "شمعي الجناح"), "berries": ("with berries", "مع التوت"), "group": ("group", "مجموعة"),
    "rock": ("on a rock", "على صخرة"), "lying": ("lying down", "مستلقٍ"), "sketch": ("sketch", "رسم"), "eagle": ("eagle", "نسرية"), "horned": ("horned", "مقرّن"),
    "barred": ("barred", "مخطط"), "perch": ("on a branch", "على غصن"), "insects": ("with insects", "مع حشرات"), "painted": ("painted", "مرسوم"),
    "water": ("on water", "على الماء"), "angora": ("angora", "أنقورة"), "meadow": ("in a meadow", "في مرج"), "dromedary": ("dromedary", "وحيد السنام"),
    "train": ("train", "قطار"), "locomotive": ("locomotive", "قاطرة"), "carriage": ("carriage", "عربة"), "hen": ("hen", "دجاجة"), "clown": ("clown", "مهرج"),
    "top": ("spinning top", "دوامة"), "horse": ("horse", "حصان"), "wheels": ("on wheels", "بعجلات"), "dapple": ("dapple", "مرقط"), "elephant": ("elephant", "فيل"),
    "soldier": ("soldier", "جندي"), "ark": ("ark", "سفينة"), "shoes": ("shoes", "حذاء"), "boot": ("boot", "جزمة"), "tinware": ("tin", "صفيح"), "punched": ("pierced", "مخرّم"),
    "copper": ("copper", "نحاسي"), "tole": ("painted", "مزخرف"), "lustre": ("lustre", "لامع"), "pewter": ("pewter", "قصدير"), "nautilus": ("nautilus", "نوتي"),
    "scallop": ("scallop", "محار"), "scallop2": ("scallop", "محار"), "conch": ("conch", "محار حلزوني"), "flowers": ("flowers", "زهور"), "roses": ("of roses", "ورود"),
    "redroses": ("red roses", "ورود حمراء"), "spring": ("spring", "ربيعي"), "garden": ("garden", "حديقة"), "lamp": ("lamp", "قنديل"), "cone": ("cone", "مخروطي"),
    "pierced": ("pierced", "مخرّم"), "tin": ("tin", "صفيح"), "bunch2": ("bunch", "باقة"), "chrys": ("chrysanthemum", "أقحوان"), "camellia": ("camellia", "كاميليا"),
    "rosebud": ("rosebud", "برعم"), "lavender": ("lavender", "خزامى"), "tulip": ("tulip", "توليب"), "anemone": ("anemone", "شقائق"), "hydrangea": ("hydrangea", "هيدرانجيا"),
}

CATS = ["flowers", "bouquets", "greenery", "fruit", "birds", "animals", "toys", "objects", "gold", "celebration", "ramadan", "sky"]


COLOUR_WORDS = {"pink", "blush", "red", "white", "purple", "violet", "blue", "yellow", "orange", "cream", "pale", "soft", "deep", "dark red", "crimson",
                "scarlet", "coral", "rose", "black", "green", "gold", "silver", "brown", "sky blue", "light", "peach", "pink and white", "blush pink",
                # and other words that read before the noun: "Copper coffee pot", "Horned owl", "Hanging flower basket"
                "copper", "pewter", "tin", "lustre", "painted", "striped", "single", "double", "Japanese", "horned", "barred", "eagle", "cabbage",
                "cone", "hanging", "pierced", "grand", "small", "large", "long", "tall", "tricolour", "spring", "garden", "Bengal", "gallica", "centifolia", "duchesse"}


def painted_name(name):
    """English and Arabic names and a category for a painted piece, from its file name (e.g. rose-pink-bud)."""
    parts = name.split("-")
    if parts[0] == "wild" and len(parts) > 1:
        noun = BASE.get(parts[1])
        en = "Wild " + (noun[0].lower() if noun else MOD.get(parts[1], (parts[1], ""))[0])
        ar = (noun[1] if noun else "زهرة") + " برية"
        return en[0].upper() + en[1:], ar, "flowers"
    for n in range(len(parts), 0, -1):
        for key in ("-".join(parts[:n]), "".join(parts[:n])):
            if key not in BASE:
                continue
            en, ar, cat = BASE[key]
            mods = [MOD.get(m, (m, "")) for m in parts[n:] if m not in key]
            mods = [(e, a) for e, a in mods if e and e.lower() not in en.lower()]
            pre = [e for e, _ in mods if e in COLOUR_WORDS]
            post = [e for e, _ in mods if e not in COLOUR_WORDS]
            text = " ".join(pre + [en.lower() if pre and not en[0].isupper() or pre else en] + post)
            # Arabic: the noun, then its details after a dot (no gender agreement needed).
            ar_mods = [a for _, a in mods if a and a not in ar]
            return text[0].upper() + text[1:], ar + (" · " + "، ".join(ar_mods) if ar_mods else ""), cat
    return name.replace("-", " ").capitalize(), name, "flowers"


TONE = {"gold": ("gold", "ذهبي"), "silver": ("silver", "فضي"), "rose": ("rose gold", "ذهبي وردي"), "henna": ("henna", "حناء")}
GOLD_BASE = [
    (r"^g-crescent-r", ("Crescent moon (left)", "هلال (يسار)", "ramadan")),
    (r"^g-crescent", ("Crescent moon", "هلال", "ramadan")),
    (r"^g-star8", ("Eight-point star", "نجمة ثمانية", "gold")),
    (r"^g-sparkle", ("Sparkle", "بريق", "gold")),
    (r"^g-stars2", ("Scattered stars", "نجوم متناثرة", "gold")),
    (r"^g-stars", ("Starry sky", "سماء مرصعة بالنجوم", "gold")),
    (r"^g-dots", ("Gold dots", "نقاط ذهبية", "gold")),
    (r"^g-lantern\d-plain", ("Lantern", "فانوس", "ramadan")),
    (r"^g-lantern\d", ("Glowing lantern", "فانوس مضيء", "ramadan")),
    (r"^g-lan-", ("Hanging lantern", "فانوس معلّق", "ramadan")),
    (r"^g-arch", ("Arch frame", "إطار قوس", "gold")),
    (r"^g-band-thin", ("Thin pattern band", "شريط نقوش رفيع", "gold")),
    (r"^g-band", ("Pattern band", "شريط نقوش", "gold")),
    (r"^g-pattern", ("Star pattern", "نقش نجمي", "ramadan")),
    (r"^g-skyline", ("Domes and minarets", "قباب ومآذن", "ramadan")),
    (r"^g-laurel", ("Laurel wreath", "إكليل غار", "celebration")),
    (r"^g-cap", ("Graduation cap", "قبعة تخرج", "celebration")),
    (r"^g-crown", ("Crown", "تاج", "celebration")),
    (r"^g-mandala-sm", ("Small henna rosette", "نقش حناء صغير", "gold")),
    (r"^g-mandala", ("Henna rosette", "نقش حناء", "gold")),
    (r"^g-paisley", ("Paisley", "بوتة", "gold")),
    (r"^g-hearts-big", ("Hearts", "قلوب", "celebration")),
    (r"^g-hearts", ("Little hearts", "قلوب صغيرة", "celebration")),
    (r"^g-balloon", ("Balloon", "بالون", "celebration")),
    (r"^g-bunch", ("Balloon bunch", "باقة بالونات", "celebration")),
    (r"^g-bunting", ("Bunting", "رايات", "celebration")),
    (r"^g-confetti", ("Confetti", "قصاصات ملونة", "celebration")),
    (r"^g-rainbow", ("Rainbow", "قوس قزح", "sky")),
    (r"^g-cloud", ("Cloud", "غيمة", "sky")),
    (r"^g-string", ("Hanging thread", "خيط معلّق", "gold")),
]
COLOURS = {"blush": ("blush", "وردي"), "sky": ("sky", "سماوي"), "ivory": ("ivory", "عاجي"), "sage": ("sage", "أخضر"), "lilac": ("lilac", "ليلكي"),
           "butter": ("butter", "أصفر"), "coral": ("coral", "مرجاني"), "red": ("red", "أحمر"), "navy": ("navy", "كحلي"), "gold": ("gold", "ذهبي"),
           "silver": ("silver", "فضي"), "rose": ("rose", "وردي"), "pink": ("pink", "وردي"), "blue": ("blue", "أزرق")}


def gold_name(name):
    for pat, (en, ar, cat) in GOLD_BASE:
        if re.match(pat, name):
            words = name.split("-")
            tone = next((t for t in ("silver", "rose", "henna") if t in words[-2:] or name.endswith("-" + t)), None)
            if pat in (r"^g-balloon", r"^g-bunch", r"^g-bunting"):
                cols = [COLOURS[w] for w in words[2:] if w in COLOURS]
                if cols:
                    en += " · " + ", ".join(c[0] for c in cols)
                    ar += " · " + "، ".join(c[1] for c in cols)
            elif tone:
                en += f" · {TONE[tone][0]}"
                ar += f" · {TONE[tone][1]}"
            return en, ar, cat
    return name, name, "gold"


# The ornaments shown in the library (the many seeded variants stay template-only).
LIBRARY_GOLD = set()
for base in ("g-crescent", "g-crescent-r", "g-star8", "g-sparkle", "g-stars", "g-stars2", "g-dots", "g-band", "g-band-thin", "g-laurel", "g-cap", "g-skyline", "g-arch", "g-pattern"):
    for t in ("", "-silver", "-rose"):
        LIBRARY_GOLD.add(base + t)
LIBRARY_GOLD |= {"g-arch-henna", "g-crown", "g-mandala-gold", "g-mandala-henna", "g-mandala-silver", "g-mandala-sm-gold", "g-mandala-sm-henna",
                 "g-paisley-gold", "g-paisley-henna", "g-paisley-silver", "g-cloud", "g-cloud2", "g-cloud-blue", "g-cloud-pink", "g-string-150", "g-string-230",
                 "g-hearts-big-535-gold", "g-hearts-big-548-rose", "g-hearts-535-gold", "g-hearts-548-rose", "g-rainbow-115-75", "g-rainbow-284-75"}
for i in range(3):
    for t in ("", "-silver"):
        LIBRARY_GOLD |= {f"g-lantern{i}{t}", f"g-lantern{i}-plain{t}"}


def first(prefix):
    xs = sorted(f[:-4] for f in os.listdir(CUT) if f.startswith(prefix) and f.endswith(".png"))
    return xs[0] if xs else None


for colour in ("gold", "silver", "blush", "sky", "ivory", "sage", "lilac", "butter", "coral", "red", "navy"):
    x = first(f"g-balloon-{colour}-")
    if x: LIBRARY_GOLD.add(x)
for combo in ("blush-ivory-gold", "gold-ivory-blush", "gold-silver-ivory", "sky-ivory-silver", "lilac-blush-ivory", "sage-ivory-gold", "red-navy-ivory", "coral-sky-butter", "gold-ivory-gold"):
    x = first(f"g-bunch-{combo}-")
    if x: LIBRARY_GOLD.add(x)
for combo in ("gold", "blush-ivory-sage-butter-sky", "sky-ivory-blush", "lilac-blush-ivory-sky", "red-ivory-navy", "coral-butter-sky-sage"):
    x = first(f"g-bunting-{combo}-")
    if x: LIBRARY_GOLD.add(x)
for combo in ("1000x330-46-139-gold", "1000x330-46-149-gold-rose", "1000x330-46-14-gold-blush-sky-butter", "1000x110-18-818-gold"):
    if os.path.exists(f"{CUT}/g-confetti-{combo}.png"): LIBRARY_GOLD.add(f"g-confetti-{combo}")
for i in (0, 1, 2):
    x = first(f"g-lan-{i}-230-70-1-gold")
    if x: LIBRARY_GOLD.add(x)

# ─────────────────────────── which assets ───────────────────────────
recipes = {}
for d in ("artdata/recipes", "artdata/recipes2", "artdata/recipes3"):
    for f in sorted(os.listdir(d)):
        if f.endswith(".json"):
            recipes[f[:-5]] = json.load(open(f"{d}/{f}"))
used = {L["src"] for r in recipes.values() for L in r.get("layers", [])}
painted = {f[:-4] for f in os.listdir(CUT) if f.endswith(".png") and not f.startswith("g-")}
assets = sorted(used | painted | {g for g in LIBRARY_GOLD if os.path.exists(f"{CUT}/{g}.png")})


def silhouette(a):
    """The paper a piece is printed on: everything it covers, small holes (inside petals) filled, soft-edged."""
    m = ndi.binary_closing(a > 0.05, iterations=2)
    filled = ndi.binary_fill_holes(m)
    holes, n = ndi.label(filled & ~m)
    if n:
        sizes = ndi.sum(np.ones_like(holes), holes, index=np.arange(1, n + 1))
        big = np.isin(holes, np.where(sizes > m.size * 0.004)[0] + 1)
        filled &= ~big
    filled = ndi.binary_erosion(filled, iterations=1)
    return np.clip(ndi.gaussian_filter(filled.astype(np.float32), 0.9), 0, 1)


catalog = []
sizes = {}
for i, name in enumerate(assets):
    src = Image.open(f"{CUT}/{name}.png").convert("RGBA")
    gold = name.startswith("g-")
    edge = 1200 if gold else 900
    full = src.copy()
    full.thumbnail((edge, edge), Image.LANCZOS)
    full.save(f"{PUB}/a/{name}.webp", "WEBP", quality=76, alpha_quality=80, method=6)
    th = src.copy()
    th.thumbnail((220, 220), Image.LANCZOS)
    th.save(f"{PUB}/t/{name}.webp", "WEBP", quality=72, alpha_quality=75, method=6)
    if not gold:
        small = src.copy()
        small.thumbnail((420, 420), Image.LANCZOS)
        a = np.asarray(small.getchannel("A")).astype(np.float32) / 255
        sil = silhouette(a)
        rgba = np.dstack([np.ones_like(sil), np.ones_like(sil), np.ones_like(sil), sil])
        Image.fromarray((rgba * 255).round().astype(np.uint8), "RGBA").save(f"{PUB}/s/{name}.webp", "WEBP", quality=70, alpha_quality=70, method=6)
    sizes[name] = src.size
    en, ar, cat = gold_name(name) if gold else painted_name(name)
    lib = (name in LIBRARY_GOLD) if gold else True
    catalog.append([name, full.width, full.height, cat, en, ar, 1 if lib else 0])
    if i % 50 == 0: print(i, "/", len(assets), name, "→", en, "|", ar, cat)

# ─────────────────────────── templates ───────────────────────────
def r1(v): return round(float(v), 1)

for key, r in recipes.items():
    out = {"v": 1}
    p = r.get("paper", {})
    out["paper"] = {"c": p.get("color", "#F7F1E6"), "c2": p.get("color2", p.get("color", "#F7F1E6")), "m": p.get("mottle", 0.018), "g": p.get("grain", 0.012), "vig": p.get("vignette", 0.06)}
    out["washes"] = [{"c": w["color"], "x": w["cx"], "y": w["cy"], "r": w["r"], "sx": w.get("sx", 1), "sy": w.get("sy", 1), "o": round(w.get("opacity", 0.25), 3),
                      "glow": 1 if w.get("mode") == "glow" else 0} for w in r.get("washes", [])]
    out["frames"] = [{k: v for k, v in fr.items()} for fr in r.get("frames", [])]
    layers = []
    for L in r.get("layers", []):
        iw, ih = sizes[L["src"]]
        crop = L.get("crop")
        cw, ch = (iw * (crop[2] - crop[0]), ih * (crop[3] - crop[1])) if crop else (iw, ih)
        w = L["w"] if "w" in L else L["h"] * cw / ch
        h = w * ch / cw
        o = {"a": L["src"], "x": r1(L["cx"] - w / 2), "y": r1(L["cy"] - h / 2), "w": r1(w), "h": r1(h), "r": r1(-(L.get("rot") or 0))}
        if L.get("flip"): o["fx"] = 1
        if L.get("flipv"): o["fy"] = 1
        if crop: o["c"] = [round(c, 4) for c in crop]
        if L.get("opacity", 1) != 1: o["o"] = L["opacity"]
        blend = L.get("blend", "multiply")
        o["b"] = {"multiply": "m", "lift": "l", "normal": "n"}.get(blend, "m")
        layers.append(o)
    out["layers"] = layers
    c = r.get("content", {})
    out["box"] = [c.get("x", 170), c.get("w", 740), c.get("top", 330), r.get("bottomPad", 95)]
    json.dump(out, open(f"{PUB}/templates/{key}.json", "w"), separators=(",", ":"))

# ─────────────────────────── paper grain ───────────────────────────
rng = np.random.default_rng(7)
W, H = 1080, 1350
def noise(scale, amp):
    n = rng.standard_normal((H // scale + 2, W // scale + 2)).astype(np.float32)
    return np.asarray(Image.fromarray(n).resize((W, H), Image.BICUBIC)) * amp
fib = ndi.gaussian_filter(noise(40, 1) + noise(9, 0.6), 2); fib /= np.abs(fib).max() + 1e-6
grain = ndi.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), 0.6); grain /= grain.std() + 1e-6
# Multiplied over the paper colour: about ±2 % fibres and grain, as compose.py's paper (mean ≈ 0.99).
tex = np.clip(1 - (0.012 + 0.02 * fib + 0.008 * grain), 0.9, 1)
Image.fromarray((tex * 255).round().astype(np.uint8), "L").save(f"{PUB}/paper.jpg", quality=82, optimize=True)

# ─────────────────────────── catalog ───────────────────────────
def js(v): return json.dumps(v, ensure_ascii=False)
rows = "\n".join(f"  [{js(c[0])}, {c[1]}, {c[2]}, {js(c[3])}, {js(c[4])}, {js(c[5])}, {c[6]}]," for c in catalog)
open(os.path.join(REPO, "src/lib/canvas/assets-data.ts"), "w").write(
    "// Generated by scripts/stationery/studio.py — do not edit by hand.\n"
    "import type { AssetRow } from \"./assets\";\n\n"
    "/** id, width, height, category, English name, Arabic name, shown in the library (1) or used by templates only (0). */\n"
    f"export const ASSET_ROWS: AssetRow[] = [\n{rows}\n];\n")
print(len(catalog), "assets;", len(recipes), "templates;", sum(1 for c in catalog if c[6]), "in the library")
