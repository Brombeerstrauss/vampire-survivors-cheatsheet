# Adds "effects" and "affectedBy" to the weapons, from each weapon's wiki page:
# - effects: how the weapon works and what triggers it. The first one or two paragraphs of the
#   page's "Effects" section (without its subsections such as Arcanas), as plain text. English
#   from the wiki, German from texts/effects_de.py. A weapon without a German text is reported
#   as WARN and keeps what it has.
# - affectedBy: the stats that directly affect the weapon, from the page's "Stats and passive
#   items" table (value 1; 2 = only with an Arcana, 0 = not affected).
#
# Works on its own without rebuilding the packs (manual edits are kept) and runs at the end of
# run.sh:
#   python3 -I tools/wiki-import/weapon_effects.py https://vampire.survivors.wiki/api.php src/data/packs
# With --english it only writes the English texts to stdout as JSON (to translate new ones).
import importlib, json, os, re, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "texts"))
EFFECTS_DE = importlib.import_module("effects_de").EFFECTS_DE

api, packs_dir = sys.argv[1], sys.argv[2]
english_only = "--english" in sys.argv
UA = "Mozilla/5.0 (compatible; wiki-reader/1.0)"


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
        time.sleep(0.5)
    return result

# Stat keys of the wiki's {{Combos/stats}} table -> the app's stat IDs. Other keys are passive
# items (silver, box, badge, ...) and are left out.
STATS = {
    "might": "might", "area": "area", "speed": "speed", "duration": "duration", "amount": "amount",
    "cooldown": "cooldown", "luck": "luck", "health": "maxHealth", "recovery": "recovery", "armor": "armor",
    "movespeed": "moveSpeed", "magnet": "magnet", "growth": "growth", "greed": "greed", "curse": "curse",
    "revival": "revival",
}
# Longer than this, the second paragraph is left out.
MAX_CHARS = 700


def section(text, names=("Effects", "Effect")):
    """Body of the first section with one of the names, without its subsections."""
    for name in names:
        m = re.search(r"^==\s*" + name + r"\s*==\s*$", text, re.M)
        if m:
            break
    else:
        return None
    rest = text[m.end():]
    n = re.search(r"^==[^=]", rest, re.M)
    body = rest[:n.start()] if n else rest
    sub = re.search(r"^===", body, re.M)
    return body[:sub.start()] if sub else body


def template(m):
    parts = [p.strip() for p in m.group(1).split("|")]
    name = parts[0].lower()
    args = [p for p in parts[1:] if "=" not in p]
    kw = {k.strip().lower(): v.strip() for k, v in (p.split("=", 1) for p in parts[1:] if "=" in p)}
    if name in ("slink", "stat", "sprite link", "cost"):
        return kw.get("txt") or (args[0] if args else "")
    if name == "vs":
        return "Vampire Survivors"
    return ""


def plain(s):
    """Wikitext -> plain text: link and template texts, no markup, references or comments."""
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    for _ in range(3):
        s = re.sub(r"\{\{([^{}]*)\}\}", template, s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"'''?", "", s)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"^\*+\s*", "• ", s, flags=re.M)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def without_lead_in(p):
    """Drops a last sentence that ends with a colon: it announced a table or formula that is
    left out."""
    if not p.endswith(":"):
        return p
    sentences = re.split(r"(?<=[.!?])\s+", p)
    return " ".join(sentences[:-1]).strip()


def effects(text):
    body = section(text or "")
    if not body:
        return None
    paragraphs = []
    for raw in re.split(r"\n\s*\n", body.strip()):
        if "{|" in raw or "\\" in raw:  # tables and formulas don't read well as plain text
            break
        p = plain(raw)
        if p:
            paragraphs.append(p)
    if not paragraphs:
        return None
    out = paragraphs[:1]
    if len(paragraphs) > 1 and len(paragraphs[0]) + len(paragraphs[1]) <= MAX_CHARS:
        out.append(paragraphs[1])
    out = [p for p in (without_lead_in(p) for p in out) if p]
    return "\n\n".join(out) or None


def affected_by(text):
    m = re.search(r"\{\{\s*Combos/stats(.*?)\}\}", text or "", re.S)
    if not m:
        return None
    found = []
    for part in m.group(1).split("|"):
        if "=" not in part:
            continue
        key, value = (x.strip() for x in part.split("=", 1))
        value = re.sub(r"<!--.*", "", value).strip()
        if key.lower() in STATS and value == "1":
            found.append(STATS[key.lower()])
    order = list(STATS.values())
    return sorted(set(found), key=order.index)


def with_fields(entry, fields):
    """Puts effects and affectedBy right after description, so the files stay readable."""
    out = {}
    for k, v in entry.items():
        if k in fields:
            continue
        out[k] = v
        if k == "description":
            out.update({f: fields[f] for f in ("effects", "affectedBy") if fields.get(f) is not None})
    return out


files = {}
for pack in sorted(os.listdir(packs_dir)):
    path = os.path.join(packs_dir, pack, "weapons.json")
    if os.path.exists(path):
        files[path] = json.load(open(path, encoding="utf-8"))
weapons = [w for doc in files.values() for w in doc["weapons"]]

# Page title = name, otherwise with the suffixes the wiki uses for pages with the same name.
pages = {}
for suffix in ("", " (weapon)", " (Weapon)"):
    todo = [w for w in weapons if w["id"] not in pages]
    got = fetch([w["name"] + suffix for w in todo])
    for w in todo:
        text = got.get(w["name"] + suffix)
        if text and re.search(r"\{\{\s*Infobox Weapon", text, re.I):
            pages[w["id"]] = text

english = {w["id"]: effects(pages.get(w["id"])) for w in weapons}
if english_only:
    json.dump({k: v for k, v in english.items() if v}, sys.stdout, ensure_ascii=False, indent=1)
    sys.exit(0)

with_effects, no_german, no_page = 0, [], []
for path, doc in files.items():
    updated = []
    for w in doc["weapons"]:
        fields = {"effects": w.get("effects"), "affectedBy": w.get("affectedBy")}
        en = english.get(w["id"])
        if w["id"] not in pages:
            no_page.append(w["name"])
        elif en and w["id"] in EFFECTS_DE:
            fields["effects"] = {"de": EFFECTS_DE[w["id"]], "en": en}
        elif en:
            no_german.append(w["id"])
        stats = affected_by(pages.get(w["id"]))
        if stats:
            fields["affectedBy"] = stats
        if fields["effects"]:
            with_effects += 1
        updated.append(with_fields(w, fields))
    doc["weapons"] = updated
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

print(f"effects: {with_effects} of {len(weapons)} weapons")
for n in no_page:
    print("  NOTE no wiki page found:", n)
for i in no_german:
    print("  WARN no German text in texts/effects_de.py, left out:", i)
