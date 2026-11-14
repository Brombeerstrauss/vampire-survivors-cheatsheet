# Extends chars_parsed.json with all weapon fields and the starting weapon hints from the weapon list.
import json, re, sys
pages = json.load(open(sys.argv[1], encoding="utf-8"))
chars = json.load(open(sys.argv[2], encoding="utf-8"))
weapons = json.load(open(sys.argv[3], encoding="utf-8"))
def clean(v):
    v = re.sub(r"\{\{[Ss]link\|([^}|]*)[^}]*\}\}", r"\1", v)
    v = re.sub(r"\{\{(?:[Ss]tat|sic)\|([^}|]*)[^}]*\}\}", r"\1", v)
    v = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", v)
    v = re.sub(r"<br\s*/?>", "; ", v)
    v = re.sub(r"\{\{[^}]*\}\}", "", v)
    return v.replace("'''", "").replace("''", "").strip()
for c in chars:
    t = pages[c["name"]]["text"]
    m = re.search(r"\{\{Infobox Character(.*?)\n\}\}", t, re.S)
    ib = dict((k.strip(), v.strip()) for k, v in re.findall(r"^\|\s*([^=\n]+?)\s*=\s*(.*)$", m.group(1), re.M)) if m else {}
    ws = []
    for k in ["weapon", "weapon1", "weapon2", "weapon3", "weapon4", "weapon5", "weapon6"]:
        v = clean(ib.get(k, ""))
        if v.startswith("|") or "=" in v: v = ""
        for part in re.split(r";|,| / ", v):
            part = part.strip()
            if part and part not in ("N/A", "None", "none") and part not in ws: ws.append(part)
    c["infoboxWeapons"] = ws
    c["hiddenWeapon"] = clean(ib.get("hidden weapon", ""))
    desc = ib.get("description") or ib.get("description1") or ""
    c["description"] = clean(desc) if not desc.startswith("|") else ""
    c["secretField"] = ib.get("secret", "")
    img = re.search(r"\[\[File:([^|\]]+)", ib.get("image1") or ib.get("image") or "")
    c["imageFile"] = img.group(1).strip() if img else f"Select-{c['name']}.png"
# Starting weapons according to the weapon list
mentions = {}
for w in weapons:
    for kind, rx in (("start", r"(?<!optional )(?<!One of the )[Ss]tarting weapons? of ([^\n*]+)"), ("also", r"One of the starting weapons of ([^\n*]+)"), ("optional", r"(?:One of )?(?:the )?optional starting weapons? of ([^\n*]+)|[Pp]ossible starting weapon of ([^\n*]+)")):
        for mm in re.finditer(rx, w["info"]):
            text = next(g for g in mm.groups() if g)
            for name in re.split(r",| and ", text):
                name = re.sub(r"\(.*?\)", "", name).strip(" .")
                if name: mentions.setdefault(name, []).append((kind, w["name"], w["section"]))
for c in chars:
    first = c["name"].split()[0]
    c["weaponPageMentions"] = mentions.get(c["name"], []) or [m for k, v in mentions.items() if k == first for m in v]
json.dump(chars, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", len(chars))
