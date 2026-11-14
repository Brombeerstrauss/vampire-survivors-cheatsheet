import json, re, sys
listing = open(sys.argv[1], encoding="utf-8").read()
pages = json.load(open(sys.argv[2], encoding="utf-8"))
PACKS = {"Base game": "base", "Legacy of the Moonspell": "lm", "Legacy of the Bloodmoon": "bm", "Tides of the Foscari": "tf",
         "Emergency Meeting": "em", "Operation Guns": "og", "Ode to Castlevania": "oc", "Emerald Diorama": "ed", "Ante Chamber": "ac"}
pack = None; sub = None; where = {}
for line in listing.splitlines():
    m = re.match(r"^===\s*(?:'')?([^'=]+?)(?:'')?\s*===$", line)
    if m and m.group(1).strip() in PACKS: pack = PACKS[m.group(1).strip()]; sub = None; continue
    m = re.match(r"^====\s*([^=]+?)\s*====$", line)
    if m: sub = m.group(1); continue
    if line.startswith("==") and not line.startswith("==="): 
        if "List of characters" not in line: pack = None
    m = re.match(r"\{\{CharacterSelect\|([^}|]+)", line)
    if m and pack and m.group(1) not in where: where[m.group(1)] = (pack, sub)

def infobox(text):
    m = re.search(r"\{\{Infobox Character(.*?)\n\}\}", text, re.S)
    if not m: return {}
    fields = {}
    for fm in re.finditer(r"^\|\s*([^=\n]+?)\s*=\s*(.*)$", m.group(1), re.M):
        fields[fm.group(1).strip()] = fm.group(2).strip()
    return fields

out = []
for name, (pk, sub) in where.items():
    p = pages.get(name)
    ib = infobox(p["text"]) if p else {}
    out.append({"name": name, "page": p["title"] if p else None, "pack": pk, "group": sub,
                "dlc": ib.get("dlc"), "weapon": ib.get("weapon"), "description": ib.get("description"),
                "unlock": ib.get("unlock"), "secret": ib.get("secret"), "name1": ib.get("name1")})
json.dump(out, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter
print(Counter((o["pack"], o["group"]) for o in out))
print("no infobox:", [o["name"] for o in out if o["weapon"] is None and o["description"] is None])
