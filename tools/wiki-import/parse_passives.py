import json, re, sys
sys.path.insert(0, sys.argv[1])
from wikitable import tables, rows, names, plain, badge, strip_attr
wt = open(sys.argv[2], encoding="utf-8").read()
out = []
for path, tbl in tables(wt):
    heads, rs = rows(tbl)
    heads = [plain(h) for h in heads]
    if "Item" not in heads and "Name" not in heads: 
        print("skip table", path, heads[:6]); continue
    for cells in rs:
        cells = [strip_attr(c) for c in cells]
        if len(cells) < 3: continue
        rec = dict(zip(heads, cells))
        key = "Item" if "Item" in rec else "Name"
        n = names(rec.get(key, ""))
        icon = re.search(r"\[\[File:([^|\]]+)", rec.get("Icon", ""))
        out.append({"path": "/".join(path), "name": n[0]["name"] if n else plain(rec.get(key, "")),
                    "iconFile": icon.group(1).strip() if icon else None,
                    "pack": badge(rec.get(key, "")) or None, "description": plain(rec.get("Description", "")),
                    "maxLevel": plain(rec.get("Max level", rec.get("Max Level", ""))), "rarity": plain(rec.get("Rarity", "")),
                    "effects": plain(rec.get("Effects", "")), "unlock": plain(rec.get("Unlock by", "")),
                    "evolvesWith": [x["name"] + ("@" + x["dlc"] if x["dlc"] else "") for x in names(rec.get("Evolves with", ""))],
                    "heads": heads})
json.dump(out, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for o in out:
    print("%-18s|%-40s|pk=%-4s|L%-3s R%-4s| %s | evo-with: %s" % (o["name"], o["path"][:40], o["pack"], o["maxLevel"], o["rarity"], o["description"][:70], ",".join(w for w in o["evolvesWith"] if "@" not in w)[:80]))
