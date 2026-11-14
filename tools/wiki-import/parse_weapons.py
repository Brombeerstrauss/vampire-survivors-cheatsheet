import json, re, sys
sys.path.insert(0, sys.argv[1])
from wikitable import tables, rows, names, plain, badge, strip_attr
wt = open(sys.argv[2], encoding="utf-8").read()
out = []
for path, tbl in tables(wt):
    sec = path[-1] if path else ""
    if sec not in ("Base Weapons", "Evolutions", "Unions", "Gifts", "Counterpart Weapons", "Special Weapons"): continue
    heads, rs = rows(tbl)
    heads = [plain(h) for h in heads]
    for cells in rs:
        cells = [strip_attr(c) for c in cells]
        rec = dict(zip(heads, cells))
        wname = names(rec.get("Weapon", ""))
        item = {"section": sec, "name": wname[0]["name"] if wname else plain(rec.get("Weapon", "")),
                "page": wname[0]["page"] if wname else None, "pack": badge(rec.get("Weapon", "")) or "base",
                "description": plain(rec.get("Description", "")), "maxLevel": plain(rec.get("Max Level", "")),
                "rarity": plain(rec.get("Rarity", "")), "info": plain(rec.get("General Information", "")),
                "unlock": plain(rec.get("Unlock Requirements", "")),
                "evolution": [n["name"] for n in names(rec.get("Evolution", ""))],
                "evolveFrom": [n["name"] for n in names(rec.get("Evolve From", ""))],
                "requirements": plain(rec.get("Requirements", "")),
                "starting": re.findall(r"[Ss]tarting weapon of ([^\n]*)", rec.get("General Information", ""))}
        out.append(item)
json.dump(out, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter((o["section"], o["pack"]) for o in out))
