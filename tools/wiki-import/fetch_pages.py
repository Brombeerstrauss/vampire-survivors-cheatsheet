# Holt Seiten-Wikitext gebündelt (50 Titel pro Anfrage) und speichert ihn als JSON.
import json, sys, time, urllib.parse, urllib.request
api, titles_file, out_file = sys.argv[1], sys.argv[2], sys.argv[3]
titles = [t.strip() for t in open(titles_file, encoding="utf-8") if t.strip()]
result = {}
for i in range(0, len(titles), 50):
    chunk = titles[i:i+50]
    q = urllib.parse.urlencode({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
                                "titles": "|".join(chunk), "redirects": 1, "format": "json", "formatversion": 2})
    req = urllib.request.Request(f"{api}?{q}", headers={"User-Agent": "Mozilla/5.0 (compatible; wiki-reader/1.0)"})
    data = json.load(urllib.request.urlopen(req, timeout=60))
    redirects = {r["to"]: r["from"] for r in data["query"].get("redirects", [])}
    norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
    for p in data["query"]["pages"]:
        title = p["title"]
        asked = redirects.get(title, title); asked = norm.get(asked, asked)
        if p.get("missing"):
            result[asked] = None; continue
        result[asked] = {"title": title, "text": p["revisions"][0]["slots"]["main"]["content"]}
    time.sleep(0.5)
json.dump(result, open(out_file, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(result), "pages,", sum(1 for v in result.values() if v is None), "missing")
