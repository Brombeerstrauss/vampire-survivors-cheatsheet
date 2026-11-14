"""Reads the official German names and texts from poncle's public localisation sheet.

Usage: python3 -I parse_localisation.py <sheets.json> <loc_de.json>

Result, keyed by English name:
  {"weapons": {"Whip": {"name": "Peitsche", "description": "..."}},
   "characters": {"Antonio Belpaese": {"name": "Antonio Belpaese", "bonus": "..."}}}
In the game, passive items are listed with the weapons, so they end up under "weapons" too.
"""
import json, re, sys

sheets = json.load(open(sys.argv[1], encoding="utf-8"))

def table(name):
    rows = sheets[name]; head = rows[0]; out = {}
    for r in rows[1:]:
        if r and r[0]:
            out[r[0]] = {head[i]: (r[i] if i < len(r) else "").strip() for i in range(len(head)) if head[i]}
    return out

def clean(text):
    text = re.sub(r"<[^>]+>", "", text or "")          # the game's formatting tags
    return re.sub(r"\s+", " ", text).strip()

result = {"weapons": {}, "characters": {}}

weapons = {}
for key, row in table("weaponLang").items():
    m = re.match(r"\{(.+)\}(name|description)$", key)
    if m: weapons.setdefault(m.group(1), {})[m.group(2)] = row
for parts in weapons.values():
    en = clean(parts.get("name", {}).get("en"))
    de = clean(parts.get("name", {}).get("de"))
    if en and de:
        result["weapons"][en] = {"name": de, "description": clean(parts.get("description", {}).get("de"))}

chars = {}
for key, row in table("characterLang").items():
    m = re.match(r"\{(.+)\}(charName|surname|description)$", key)
    if m: chars.setdefault(m.group(1), {})[m.group(2)] = row
for parts in chars.values():
    first_en, last_en = clean(parts.get("charName", {}).get("en")), clean(parts.get("surname", {}).get("en"))
    first_de, last_de = clean(parts.get("charName", {}).get("de")), clean(parts.get("surname", {}).get("de"))
    en = f"{first_en} {last_en}".strip()
    de = f"{first_de or first_en} {last_de or last_en}".strip()
    if en:
        result["characters"][en] = {"name": de, "bonus": clean(parts.get("description", {}).get("de"))}

json.dump(result, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(result['weapons'])} weapons/items, {len(result['characters'])} characters with German texts")
