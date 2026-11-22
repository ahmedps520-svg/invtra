"""Download chosen search results at full size and record their credits.
usage: dl.py <searchdir> <outdir> idx[:name] ..."""
import json, sys, os, urllib.request
UA = {"User-Agent": "invtra-design-sourcing/1.0 (contact@invtra.store)"}
sd, od = sys.argv[1], sys.argv[2]; os.makedirs(od, exist_ok=True)
meta = json.load(open(os.path.join(sd, "results.json")))
credits_path = os.path.join(od, "credits.json")
credits = json.load(open(credits_path)) if os.path.exists(credits_path) else {}
for spec in sys.argv[3:]:
    idx, _, name = spec.partition(":")
    r = meta[int(idx)]
    name = name or f"{os.path.basename(sd)}-{idx}"
    ext = ".png" if r["url"].lower().endswith(".png") else ".jpg"
    path = os.path.join(od, name + ext)
    if not os.path.exists(path):
        with urllib.request.urlopen(urllib.request.Request(r["url"], headers=UA), timeout=60) as resp:
            open(path, "wb").write(resp.read())
    credits[name] = {k: r[k] for k in ("title", "creator", "license", "license_version", "source", "foreign_landing_url", "url")}
    print(name, os.path.getsize(path) // 1024, "KB", r["license"], r["source"])
json.dump(credits, open(credits_path, "w"), indent=1, ensure_ascii=False)
