# Adds "gameIds" to characters, weapons and passive items: the game's internal IDs
# (e.g. MAGIC_MISSILE for Magic Wand; some weapons have several). They are in the infobox of
# each wiki page (field "id") and are exactly what the BepInEx plugin in mod/ reports.
#
# Runs after build_pack.py in run.sh, but also works on its own without rebuilding the packs
# (manual edits are kept). An entry the wiki gives no ID for keeps the IDs it already has:
#   python3 -I tools/wiki-import/game_ids.py https://vampire.survivors.wiki/api.php src/data/packs
import json, os, re, sys, time, urllib.parse, urllib.request

api, packs_dir = sys.argv[1], sys.argv[2]
UA = "Mozilla/5.0 (compatible; wiki-reader/1.0)"

# Which infobox belongs to which file, and which title suffixes the wiki uses for pages
# with the same name (e.g. "Death (character)").
KINDS = {
    "characters": ("Infobox Character", ["", " (character)", " (Character)"]),
    "weapons": ("Infobox Weapon", ["", " (weapon)", " (Weapon)"]),
    "passives": ("Infobox Passive item", ["", " (passive item)", " (item)", " (Passive item)"]),
}
# Entries whose wiki page has a different name than in the app.
TITLE_OVERRIDES = {}


def fetch(titles):
    """Wikitext for many titles, 50 per request, redirects resolved. Key = requested title."""
    result = {}
    titles = list(dict.fromkeys(titles))
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        q = urllib.parse.urlencode({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main",
                                    "titles": "|".join(chunk), "redirects": 1, "format": "json", "formatversion": 2})
        req = urllib.request.Request(f"{api}?{q}", headers={"User-Agent": UA})
        data = json.load(urllib.request.urlopen(req, timeout=60))
        back = {}
        for r in data["query"].get("normalized", []) + data["query"].get("redirects", []):
            back[r["to"]] = back.get(r["from"], r["from"])
        for p in data["query"]["pages"]:
            if p.get("missing") or "revisions" not in p:
                continue
            asked = back.get(p["title"], p["title"])
            result[asked] = p["revisions"][0]["slots"]["main"]["content"]
            result.setdefault(p["title"], result[asked])
        time.sleep(0.5)
    return result


def infobox_fields(text, infobox):
    """Fields of an infobox. Counts braces, because some fields share a line and values
    contain templates themselves."""
    m = re.search(r"\{\{\s*" + re.escape(infobox) + r"\s*[|\n]", text or "", re.I)
    if not m:
        return {}
    i, depth, parts, cur, square = m.end() - 1, 2, [], "", 0
    while i < len(text) and depth > 0:
        two = text[i:i + 2]
        if two == "{{": depth += 2; cur += two; i += 2; continue
        if two == "}}":
            depth -= 2
            if depth > 0: cur += two
            i += 2; continue
        if two == "[[": square += 1; cur += two; i += 2; continue
        if two == "]]": square -= 1; cur += two; i += 2; continue
        c = text[i]
        if c == "|" and depth == 2 and square == 0:
            parts.append(cur); cur = ""
        else:
            cur += c
        i += 1
    parts.append(cur)
    fields = {}
    for part in parts:
        if "=" in part:
            k, v = part.split("=", 1)
            fields[k.strip().lower()] = v.strip()
    return fields


def infobox_ids(text, infobox):
    """Game IDs from the id field; some pages list several (separated by <br/>)."""
    raw = re.sub(r"<[^>]*>", " ", infobox_fields(text, infobox).get("id", ""))
    return [t for t in re.split(r"[\s,;/]+", raw) if re.fullmatch(r"[A-Z][A-Z0-9_]*", t)]


def load_packs():
    files = {}
    for pack in sorted(os.listdir(packs_dir)):
        for kind in KINDS:
            path = os.path.join(packs_dir, pack, kind + ".json")
            if os.path.exists(path):
                files[path] = (kind, json.load(open(path, encoding="utf-8")))
    return files


def with_game_ids(entry, gids):
    """Put gameIds right after id so the files stay readable. Without IDs from the wiki
    (page not found, renamed, or without an id field) the entry keeps the ones it has."""
    gids = gids or entry.get("gameIds")
    out = {}
    for k, v in entry.items():
        if k in ("gameId", "gameIds"):
            continue
        out[k] = v
        if k == "id" and gids:
            out["gameIds"] = gids
    return out


files = load_packs()
entries = [(kind, e) for kind, doc in files.values() for e in doc[kind]]
found, kept, missing = {}, [], []

# Round 1: page title = name; later rounds: with the suffixes from KINDS.
for round_ in range(max(len(s) for _, s in KINDS.values())):
    todo = [(k, e) for k, e in entries if (k, e["id"]) not in found and round_ < len(KINDS[k][1])]
    if not todo:
        break
    titles = {(k, e["id"]): TITLE_OVERRIDES.get(e["name"], e["name"]) + KINDS[k][1][round_] for k, e in todo}
    pages = fetch(titles.values())
    for k, e in todo:
        gids = infobox_ids(pages.get(titles[(k, e["id"])]), KINDS[k][0])
        if gids:
            found[(k, e["id"])] = gids

for path, (kind, doc) in files.items():
    doc[kind] = [with_game_ids(e, found.get((kind, e["id"]))) for e in doc[kind]]
    for e in doc[kind]:
        if "gameIds" not in e:
            missing.append(f"{kind}: {e['name']} ({e['id']})")
        elif (kind, e["id"]) not in found:
            kept.append(f"{kind}: {e['name']} ({e['id']})")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

# The same game ID on two entries of the same kind would be a mapping error.
seen = {}
for kind, doc in files.values():
    for e in doc[kind]:
        for gid in e.get("gameIds", []):
            seen.setdefault((kind, gid), []).append(e["id"])
dupes = {k: v for k, v in seen.items() if len(v) > 1}

print(f"gameIds: {len(found)} found, {len(kept)} kept, {len(missing)} missing")
for m in kept:
    print("  NOTE not in the wiki, kept as is:", m)
for m in missing:
    print("  WARN without gameIds:", m)
for (kind, gid), ids in dupes.items():
    print(f"  WARN {kind}: {gid} used by {ids}")
