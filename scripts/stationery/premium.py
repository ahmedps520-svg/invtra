"""Settle which generated designs are Premium (about a third): gold-architecture layouts, most dark papers, a few others.
Deterministic per key, so regenerating doesn't reshuffle it."""
import hashlib, json
rows = json.load(open("artdata/collection.json"))
def u(k, salt): return int(hashlib.sha1(f"{salt}:{k}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
for r in rows:
    m = r["meta"]
    dark = m["paper"] in ("navy", "midnight", "emerald", "forest", "plum", "burgundy", "teal", "onyx")
    prem = m["tpl"] in ("arch", "skyline", "archflor") or (dark and u(r["k"], "d") < 0.45) or u(r["k"], "p") < 0.12
    if prem: r["p"] = 1
    else: r.pop("p", None)
json.dump(rows, open("artdata/collection.json", "w"), indent=1, ensure_ascii=False)
from collections import Counter
print("premium", sum(1 for r in rows if r.get("p")), "of", len(rows), Counter(r["meta"]["occ"] for r in rows if r.get("p")))
