# Merges the hand-checked tips from the wiki's character pages (texts/wiki_tips.py) into the
# recommendations of each character's pack:
# - TIPS add a weapon or item. If the recommendation already has it, the better priority wins
#   and the wiki's reason is added to the existing one.
# - AVOID lists a weapon or item under "avoid" (clear advice against picking it).
# Characters without a recommendation get one. Running it twice changes nothing.
#
# Runs at the end of run.sh (build_pack.py rewrites the recommendations), and on its own:
#   python3 -I tools/wiki-import/wiki_tips.py src/data/packs
import importlib, json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "texts"))
TIPS_MODULE = importlib.import_module("wiki_tips")
packs_dir = sys.argv[1]

pack_of, kind_of = {}, {}
recs_by_pack = {}
for pack in sorted(os.listdir(packs_dir)):
    folder = os.path.join(packs_dir, pack)
    if not os.path.isdir(folder):
        continue
    for c in json.load(open(os.path.join(folder, "characters.json"), encoding="utf-8"))["characters"]:
        pack_of[c["id"]] = pack
    for kind in ("weapons", "passives"):
        for e in json.load(open(os.path.join(folder, kind + ".json"), encoding="utf-8"))[kind]:
            kind_of[e["id"]] = kind
    recs_by_pack[pack] = json.load(open(os.path.join(folder, "recommendations.json"), encoding="utf-8"))

problems = []


def recommendation(character):
    pack = pack_of.get(character)
    if pack is None:
        problems.append(f"unknown character {character}")
        return None
    recs = recs_by_pack[pack]["recommendations"]
    for r in recs:
        if r["character"] == character and r["source"] == pack:
            return r
    r = {"character": character, "source": pack, "weapons": [], "passives": []}
    recs.append(r)
    return r


def joined(old, new):
    return old if new in old else f"{old} {new}"


added = updated = avoided = 0
for character, item, priority, de, en in TIPS_MODULE.TIPS:
    r = recommendation(character)
    kind = kind_of.get(item)
    if r is None or kind is None:
        if kind is None:
            problems.append(f"unknown weapon or item {item} ({character})")
        continue
    existing = next((x for x in r[kind] if x["id"] == item), None)
    if existing is None:
        r[kind].append({"id": item, "reason": {"de": de, "en": en}, "priority": priority})
        added += 1
        continue
    reason = {"de": joined(existing["reason"]["de"], de), "en": joined(existing["reason"]["en"], en)}
    if reason != existing["reason"] or priority < existing["priority"]:
        existing["reason"] = reason
        existing["priority"] = min(priority, existing["priority"])
        updated += 1

for character, item, de, en in TIPS_MODULE.AVOID:
    r = recommendation(character)
    if r is None or item not in kind_of:
        if item not in kind_of:
            problems.append(f"unknown weapon or item {item} ({character})")
        continue
    avoid = r.setdefault("avoid", [])
    entry = {"id": item, "reason": {"de": de, "en": en}}
    if not any(x["id"] == item for x in avoid):
        avoid.append(entry)
        avoided += 1

for r in (r for doc in recs_by_pack.values() for r in doc["recommendations"]):
    for kind in ("weapons", "passives"):
        r[kind].sort(key=lambda x: x["priority"])

for pack, doc in recs_by_pack.items():
    with open(os.path.join(packs_dir, pack, "recommendations.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(f"wiki tips: {added} added, {updated} merged into existing ones, {avoided} to avoid")
for p in problems:
    print("  WARN", p)
