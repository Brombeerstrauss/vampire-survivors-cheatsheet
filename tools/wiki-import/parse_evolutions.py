import json, re, sys
sys.path.insert(0, sys.argv[1])
from wikitable import tables, rows, names, plain, strip_attr
wt = open(sys.argv[2], encoding="utf-8").read()
PACKS = {"Base game": "base", "Legacy of the Moonspell": "lm", "Legacy of the Bloodmoon": "bm", "Tides of the Foscari": "tf",
         "Emergency Meeting": "em", "Operation Guns": "og", "Ode to Castlevania": "oc", "Emerald Diorama": "ed", "Ante Chamber": "ac"}
KIND = {"Evolutions": "evolution", "Union": "union", "Unions": "union", "Gifts": "gift", "Morphs": "morph"}
out = []
for path, tbl in tables(wt):
    if len(path) < 3 or path[0] != "List of Evolutions, Unions, Gifts and Morphs": continue
    pack = PACKS.get(path[1]); kind = KIND.get(path[2])
    heads, rs = rows(tbl)
    for cells in rs:
        cells = [strip_attr(c) for c in cells]
        try: eq = next(i for i, c in enumerate(cells) if plain(c) == "=")
        except StopIteration:
            out.append({"pack": pack, "kind": kind, "raw": cells, "error": "no ="}); continue
        left = [c for c in cells[:eq] if plain(c) not in ("+", "") or names(c)]
        result = names(cells[eq + 1]) if eq + 1 < len(cells) else []
        weapons = names(left[0]) if left else []
        extra = left[1:]
        passives, conds = [], []
        for c in extra:
            maxlvl = bool(re.search(r"max level", c, re.I))
            for n in names(c): passives.append({"name": n["name"], "page": n["page"], "dlc": n["dlc"], "max": maxlvl})
            txt = plain(re.sub(r"\{\{\s*Sprite[^}]*\}\}", "", c)).replace("Max level:", "").strip()
            if txt: conds.append(txt)
        out.append({"pack": pack, "kind": kind,
                    "weapons": [{"name": n["name"], "dlc": n["dlc"]} for n in weapons],
                    "weaponText": plain(left[0]) if left else "",
                    "passives": passives, "conditions": conds,
                    "result": [{"name": n["name"], "dlc": n["dlc"]} for n in result],
                    "resultText": plain(cells[eq + 1]) if eq + 1 < len(cells) else "",
                    "after": [plain(c) for c in cells[eq + 2:]]})
json.dump(out, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter((o["pack"], o["kind"]) for o in out))
for o in out:
    if o["pack"] == "base":
        print("%-9s| %s + %s %s = %s %s" % (o["kind"], "/".join(w["name"] for w in o["weapons"]), ", ".join(p["name"] + ("(max)" if p["max"] else "") for p in o["passives"]), ("[" + " | ".join(o["conditions"]) + "]") if o["conditions"] else "", "/".join(r["name"] for r in o["result"]), o["after"] if o["after"] else ""))
