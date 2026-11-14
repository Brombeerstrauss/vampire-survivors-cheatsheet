"""Checks which image files exist on the wiki and writes their URLs to images.json.

Usage: python3 -I resolve_images.py <api-url> <wiki-raw-dir>
"""
import json, os, sys, time, urllib.parse, urllib.request

api, raw = sys.argv[1], sys.argv[2]
load = lambda f: json.load(open(os.path.join(raw, f), encoding="utf-8"))
files = set()
for w in load("weapons_parsed.json"):
    if w.get("iconFile"): files.add(w["iconFile"])
for p in load("passives_parsed.json"):
    if p.get("iconFile"): files.add(p["iconFile"])
for c in load("chars_parsed.json"):
    if c.get("imageFile"): files.add(c["imageFile"])

def norm(title):
    t = title.replace("_", " ").strip()
    return t[:1].upper() + t[1:]

urls = {}
names = sorted(files)
for i in range(0, len(names), 50):
    chunk = names[i:i + 50]
    q = urllib.parse.urlencode({"action": "query", "prop": "imageinfo", "iiprop": "url|size", "format": "json",
                                "formatversion": 2, "titles": "|".join("File:" + n for n in chunk)})
    req = urllib.request.Request(f"{api}?{q}", headers={"User-Agent": "Mozilla/5.0 (compatible; wiki-reader/1.0)"})
    data = json.load(urllib.request.urlopen(req, timeout=60))["query"]
    renamed = {n["to"]: n["from"] for n in data.get("normalized", [])}
    for page in data["pages"]:
        asked = renamed.get(page["title"], page["title"]).removeprefix("File:")
        info = (page.get("imageinfo") or [None])[0]
        if info:
            urls[asked] = {"url": info["url"].split("?")[0], "width": info["width"], "height": info["height"]}
    time.sleep(0.3)
# Also make them findable by normalized name (spaces/underscores, capitalization)
for name in list(urls):
    urls.setdefault(norm(name), urls[name])
json.dump(urls, open(os.path.join(raw, "images.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
missing = [n for n in names if n not in urls and norm(n) not in urls]
print(f"{len(names)} image files requested, {len(names) - len(missing)} found, {len(missing)} missing")
for n in missing[:30]: print("  missing:", n)
