"""Erzeugt die JSON-Dateien eines Pakets aus den ausgelesenen Wiki-Daten, auf Deutsch und Englisch.

Aufruf: python3 -I build_pack.py <texte-ordner> <wiki-raw-dir> <wiki-code> <pack-id> <texte-modul> <ziel-ordner>

Quellen:
- Englisch: Namen und Beschreibungen aus dem Vampire Survivors Wiki (Originaltext des Spiels).
- Deutsch: offizielle Namen und Texte aus poncles Lokalisierungs-Tabelle (loc_de.json), wo vorhanden;
  sonst eigene Texte aus texts/de_<paket>.py, in denen englische Namen durch offizielle deutsche ersetzt werden.
- Namen ohne offiziellen deutschen Namen bekommen ggf. eine eigene Übersetzung (nameDeHint),
  die die App in Klammern zeigt.

`verified` wird nur gesetzt, wenn die Angaben auf mehreren Wiki-Seiten übereinstimmen
(Entwicklungsseite, Waffenliste, Gegenstandsliste, Charakterseite).
"""
import importlib, json, os, re, sys, unicodedata

texts_dir, raw, code, pack_id, text_module, target = sys.argv[1:7]
sys.path.insert(0, texts_dir)
T = importlib.import_module(text_module)
N = importlib.import_module("names_de")
EN = importlib.import_module("en_texts")
PASSIVE_FLAGS = getattr(T, "PASSIVE_FLAGS", {})
CONSUMED = getattr(T, "CONSUMED", set())
GLIMMER_NOTE = getattr(T, "GLIMMER_NOTE", None)

def load(name, default=None):
    path = os.path.join(raw, name)
    if not os.path.exists(path):
        if default is not None: return default
        raise SystemExit(f"Fehlt: {path}")
    return json.load(open(path, encoding="utf-8"))

W_ALL = load("weapons_parsed.json")
P_ALL = load("passives_parsed.json")
E_ALL = load("evolutions_parsed.json")
C_ALL = load("chars_parsed.json")
IMAGES = load("images.json", {})
LOC = load("loc_de.json", {"weapons": {}, "characters": {}})

warnings = []
def warn(msg): warnings.append(msg)

def slug(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()

W_BY = {}
for w in W_ALL:
    if w["section"] in ("Counterpart Weapons", "Special Weapons"): continue
    W_BY.setdefault(w["name"], w)
P_BY = {p["name"]: p for p in P_ALL}
PSEUDO = {"passives", "Treasure Chest", "evolutions"}

def norm(s): return re.sub(r"\s+", " ", s or "").strip()

# ---------- Deutsch: offizielle Namen und Ersetzung in eigenen Texten ----------
def fix(text): return N.OFFICIAL_FIXES.get(text, text)

OFFICIAL_DE = {}
for en, v in LOC["weapons"].items(): OFFICIAL_DE[en] = fix(v["name"])
for en, v in LOC["characters"].items(): OFFICIAL_DE[en] = fix(v["name"])

def de_name(en):
    """Name für deutsche Fließtexte: offizieller deutscher Name, sonst der englische."""
    return OFFICIAL_DE.get(en, en)

_replace = sorted((en for en, de in OFFICIAL_DE.items() if de and de != en), key=len, reverse=True)
_pattern = re.compile(r"(?<![\w'])(" + "|".join(re.escape(n) for n in _replace) + r")(?![\w'])") if _replace else None

def localize_de(text):
    """Ersetzt englische Namen in eigenen deutschen Texten durch die offiziellen deutschen."""
    if not text or not _pattern: return text
    return _pattern.sub(lambda m: OFFICIAL_DE[m.group(1)], text)

def lt(de, en):
    return {"de": de, "en": en}

def names_for(en_name):
    """Felder nameDe (offiziell) bzw. nameDeHint (eigene Übersetzung, in Klammern)."""
    official = OFFICIAL_DE.get(en_name)
    if official:
        return {"nameDe": official} if official != en_name else {}
    hint = N.HINTS.get(en_name)
    return {"nameDeHint": hint} if hint and hint != en_name else {}

def official_text(table, en_name, field, en_text):
    """Offizieller deutscher Text, wenn er wirklich übersetzt ist."""
    entry = LOC[table].get(en_name)
    text = entry.get(field) if entry else None
    if text and norm(text) != norm(en_text): return fix(text)
    return None

def image_for(file_name, label):
    """Adresse des Originalbilds im Wiki, falls die Datei existiert."""
    if not file_name:
        warn(f"Kein Bild in der Wiki-Tabelle: {label}"); return None
    key = file_name.replace("_", " ").strip()
    info = IMAGES.get(file_name) or IMAGES.get(key[:1].upper() + key[1:])
    if not info: warn(f"Bild fehlt im Wiki: {label} ({file_name})")
    return info["url"] if info else None

def unverified(problems):
    de = "Ungeprüft: " + "; ".join(p[0] for p in problems) + "."
    en = "Unverified: " + "; ".join(p[1] for p in problems) + "."
    return de, en

def join_notes(parts):
    """parts: Liste von (de, en); ergibt LocalizedText oder None."""
    parts = [p for p in parts if p and (p[0] or p[1])]
    if not parts: return None
    return lt(" ".join(p[0] for p in parts), " ".join(p[1] for p in parts))

# ---------- Entwicklungen ----------
evolutions = []
for e in [e for e in E_ALL if e["pack"] == code]:
    if not e.get("result"):
        warn(f"Entwicklung ohne Ergebnis übersprungen: {e}"); continue
    weapons_in = [w["name"] for w in e["weapons"]]
    results = [r["name"] for r in e["result"]]
    if e["kind"] == "evolution" and weapons_in and weapons_in[0] == "Penshin Fatcha":
        weapons_in, results = ["Penshin Fatcha"], ["Miracle of Multiplication"]
    result = results[0]
    passives, characters, conditions = [], [], []
    if e["kind"] == "morph":
        names = [p["name"] for p in e["passives"]]
        char_name, relic = names[0], names[1] if len(names) > 1 else None
        characters = [slug(char_name)]
        conditions = [lt(f"Relikt {relic} besitzen.", EN.MORPH_RELIC_EN.format(relic=relic)),
                      lt(T.MORPH_RELIC_LEVEL + ".", EN.MORPH_LEVEL_EN)]
    else:
        for p in e["passives"]:
            if p["name"] in P_BY:
                passives.append(p)
            elif p["name"] in PSEUDO:
                pass
            elif GLIMMER_NOTE:
                conditions.append(lt(GLIMMER_NOTE.format(tech=p["name"]), EN.GLIMMER_EN.format(tech=p["name"])))
            else:
                warn(f"{result}: unbekannte Zutat {p['name']}")
    extra_de = T.EVOLUTION_DE.get(result, {})
    extra_en = EN.EVOLUTION_EN.get(result, {})
    if extra_de.get("conditions"):
        de_list, en_list = extra_de["conditions"], extra_en.get("conditions", [])
        if len(de_list) != len(en_list): raise SystemExit(f"Englische Bedingungen fehlen oder passen nicht: {result}")
        override = [lt(localize_de(d), en) for d, en in zip(de_list, en_list)]
        conditions = override + [c for c in conditions if c["de"] not in de_list]

    # Gegenprüfung mit Waffen- und Gegenstandsliste: Liste von (deutsch, englisch)
    problems = []
    res = W_BY.get(result)
    if not res:
        problems.append((f"Ergebnis {result} fehlt in der Waffenliste", f"result {result} missing from the weapon list"))
    else:
        req = norm(res["requirements"]) + " " + norm(res["description"])
        if e["kind"] in ("evolution", "morph") and res["evolveFrom"] and weapons_in[0] not in res["evolveFrom"]:
            problems.append((f"Waffenliste nennt {res['evolveFrom']} als Ausgangswaffe", f"weapon list names {res['evolveFrom']} as base weapon"))
        for p in passives:
            if p["name"] not in req:
                problems.append((f"Waffenliste nennt {p['name']} nicht als Bedingung", f"weapon list doesn't list {p['name']} as a requirement"))
            listed_max = re.search(r"max(?:imum)? level[^.;*]*" + re.escape(p["name"]), req, re.I) is not None
            if p.get("max") and "max" not in req.lower():
                problems.append((f"Waffenliste nennt für {p['name']} keine Maximalstufe", f"weapon list doesn't require {p['name']} at max level"))
            if listed_max and not p.get("max"):
                problems.append((f"Waffenliste verlangt {p['name']} auf Maximalstufe, die Entwicklungsseite nicht",
                                 f"weapon list requires {p['name']} at max level, the evolution page doesn't"))
        if e["kind"] == "union":
            for w in weapons_in:
                if w not in req: problems.append((f"Union-Eintrag nennt {w} nicht", f"union entry doesn't list {w}"))
    for p in passives:
        pi = P_BY.get(p["name"])
        if pi and pi["evolvesWith"] and e["kind"] == "evolution" and not any(x.split("@")[0] == weapons_in[0] for x in pi["evolvesWith"]):
            problems.append((f"Gegenstandsliste nennt {weapons_in[0]} nicht bei {p['name']}", f"item list doesn't list {weapons_in[0]} for {p['name']}"))
    base = W_BY.get(weapons_in[0])
    if e["kind"] == "evolution" and base and base["evolution"] and result not in base["evolution"] and result != "Miracle of Multiplication":
        problems.append((f"Waffenliste nennt bei {weapons_in[0]} als Entwicklung {base['evolution']}", f"weapon list names {base['evolution']} as evolution of {weapons_in[0]}"))

    def preq(p):
        r = {"id": slug(p["name"])}
        if p.get("max"): r["level"] = "max"
        if p["name"] in CONSUMED: r["consumed"] = True
        return r

    entry = {"id": slug(result), "kind": e["kind"], "source": pack_id, "result": slug(result),
             "weapons": [dict({"id": slug(w)}, **({"level": "any"} if e["kind"] == "morph" else {})) for w in weapons_in],
             "passives": [preq(p) for p in passives]}
    if characters: entry["characters"] = characters
    if conditions: entry["conditions"] = conditions
    entry["verified"] = not problems
    note_parts = []
    if extra_de.get("note"): note_parts.append((localize_de(extra_de["note"]), extra_en["note"]))
    if problems:
        note_parts.append(unverified(problems))
        warn(f"{result}: " + "; ".join(p[0] for p in problems))
    note = join_notes(note_parts)
    if note: entry["note"] = note
    evolutions.append(entry)

# ---------- Waffen ----------
weapons, seen_w = [], set()
for w in W_ALL:
    if w["pack"] != code or w["section"] in ("Counterpart Weapons", "Special Weapons"): continue
    name = w["name"]
    if name in seen_w: continue
    seen_w.add(name)
    if name not in T.WEAPONS:
        warn(f"Waffe ohne deutschen Text übersprungen: {name}"); continue
    emoji, desc_de = T.WEAPONS[name]
    desc_en = EN.DESCRIPTION_EN.get(name) or w["description"]
    desc_de = official_text("weapons", name, "description", w["description"]) or localize_de(desc_de)
    kind = "base" if w["section"] == "Base Weapons" else "evolved"
    m = re.search(r"max Level of (\d+)", w["info"])
    ml = (int(w["maxLevel"]) if w["maxLevel"].isdigit() else None) if kind == "base" else (int(m.group(1)) if m else 1)
    problems = []
    if ml is None:
        problems.append(("Maximalstufe fehlt im Wiki", "max level missing from the wiki")); ml = 8
    entry = {"id": slug(name), "name": name, **names_for(name), "source": pack_id, "kind": kind,
             "description": lt(desc_de, desc_en), "maxLevel": ml, "emoji": emoji}
    image = image_for(w.get("iconFile"), f"Waffe {name}")
    if image: entry["image"] = image
    entry["verified"] = not problems
    if problems:
        entry["note"] = join_notes([unverified(problems)])
        warn(f"Waffe {name}: " + "; ".join(p[0] for p in problems))
    weapons.append(entry)
missing_w = set(T.WEAPONS) - seen_w
if missing_w: warn(f"Deutsche Texte ohne Wiki-Waffe: {sorted(missing_w)}")

# ---------- Passive Gegenstände ----------
passives = []
for p in P_ALL:
    if p["name"] not in T.PASSIVES: continue
    name = p["name"]
    emoji, desc_de = T.PASSIVES[name]
    desc_en = EN.DESCRIPTION_EN.get(name) or p["description"]
    desc_de = official_text("weapons", name, "description", p["description"]) or localize_de(desc_de)
    problems = []
    ml = int(p["maxLevel"]) if p["maxLevel"].isdigit() else None
    if ml is None: problems.append(("Maximalstufe fehlt im Wiki", "max level missing from the wiki")); ml = 5
    entry = {"id": slug(name), "name": name, **names_for(name), "source": pack_id,
             "description": lt(desc_de, desc_en), "maxLevel": ml}
    if name in getattr(T, "STAGE_ONLY", set()): entry["stageOnly"] = True
    entry.update(PASSIVE_FLAGS.get(name, {}))
    entry["emoji"] = emoji
    image = image_for(p.get("iconFile"), f"Gegenstand {name}")
    if image: entry["image"] = image
    entry["verified"] = not problems
    if problems:
        entry["note"] = join_notes([unverified(problems)])
        warn(f"Gegenstand {name}: " + "; ".join(p[0] for p in problems))
    passives.append(entry)
missing_p = set(T.PASSIVES) - {p["name"] for p in P_ALL}
if missing_p: warn(f"Gegenstände ohne Wiki-Eintrag: {missing_p}")

# ---------- Charaktere ----------
def base_start(c):
    """Basisspiel: Infobox-Feld `weapon`, gegengeprüft mit der Waffenliste."""
    if c["name"] in T.CHARACTER_WEAPON_OVERRIDES:
        return T.CHARACTER_WEAPON_OVERRIDES[c["name"]], [], []
    start = [s.strip() for s in re.split(r";|<br\s*/?>", c["weapon"] or "") if s.strip() and s.strip() not in ("N/A", "None")]
    problems = []
    for s in start:
        wi = W_BY.get(s)
        if not wi or (c["name"].split()[0] not in wi["info"] and c["name"] not in wi["info"]):
            problems.append((f"Waffenliste nennt {c['name']} nicht bei {s}", f"weapon list doesn't name {c['name']} for {s}"))
    return start, problems, []

def dlc_start(c):
    """DLCs: Infobox-Waffen, bestätigt durch „Starting weapon of …“ in der Waffenliste."""
    if c["name"] in T.CHARACTER_WEAPON_OVERRIDES:
        return T.CHARACTER_WEAPON_OVERRIDES[c["name"]], [], []
    ib = [w for w in c.get("infoboxWeapons", [])]
    mentions = c.get("weaponPageMentions", [])
    confirmed = {w for k, w, s in mentions if k in ("start", "also")}
    optional = [w for k, w, s in mentions if k == "optional"]
    notes, problems = [], []
    if confirmed:
        start = [w for w in ib if w in confirmed] + [w for w in confirmed if w not in ib]
    elif optional:
        start = [optional[0]]
        others = [w for w in dict.fromkeys(optional) if w != optional[0]]
        if others:
            notes.append(("Alternativ wählbare Startwaffe: " + ", ".join(de_name(o) for o in others) + ".",
                          "Alternative starting weapon: " + ", ".join(others) + "."))
    else:
        start = ib
        if ib: problems.append(("Startwaffe nur auf der Charakterseite genannt", "starting weapon only named on the character page"))
    unknown = [w for w in start if w not in W_BY]
    if unknown:
        notes.append(("Startet zusätzlich mit: " + ", ".join(unknown) + ".", "Also starts with: " + ", ".join(unknown) + "."))
        start = [w for w in start if w in W_BY]
    if c.get("hiddenWeapon"):
        hw = c["hiddenWeapon"]
        notes.append((f"Versteckte Waffe: {de_name(hw)}.", f"Hidden weapon: {hw}."))
    return list(dict.fromkeys(start)), problems, notes

characters = []
for c in [c for c in C_ALL if c["pack"] == code]:
    wiki_name = c["name"]
    if wiki_name not in T.CHARACTERS:
        warn(f"Charakter ohne deutschen Text übersprungen: {wiki_name}"); continue
    emoji, bonus_de = T.CHARACTERS[wiki_name]
    start, problems, auto_notes = (base_start if code == "base" else dlc_start)(c)
    secret = c["group"] in ("Secret", "Hidden") or (c.get("secret") or "").lower() == "yes"
    shown = getattr(T, "NAME_OVERRIDES", {}).get(wiki_name, wiki_name)  # Name im Spiel, falls der Seitentitel abweicht
    bonus_en = EN.BONUS_EN.get(wiki_name) or c.get("description") or ""
    if not bonus_en: warn(f"Charakter {wiki_name}: keine englische Beschreibung")
    bonus_de = official_text("characters", shown, "bonus", bonus_en) or localize_de(bonus_de)
    entry = {"id": slug(shown), "name": shown, **names_for(shown), "source": pack_id,
             "startingWeapons": [slug(s) for s in start], "bonus": lt(bonus_de, bonus_en),
             "secret": secret, "emoji": emoji}
    image = image_for(c.get("imageFile"), f"Charakter {wiki_name}")
    if image: entry["image"] = image
    entry["verified"] = not problems
    note_parts = []
    if wiki_name in T.CHARACTER_NOTES:
        note_parts.append((localize_de(T.CHARACTER_NOTES[wiki_name]), EN.CHARACTER_NOTES_EN[wiki_name]))
    note_parts += auto_notes
    if problems:
        note_parts.append(unverified(problems))
        warn(f"Charakter {wiki_name}: " + "; ".join(p[0] for p in problems))
    note = join_notes(note_parts)
    if note: entry["note"] = note
    characters.append(entry)
missing_c = set(T.CHARACTERS) - {c["name"] for c in C_ALL if c["pack"] == code}
if missing_c: warn(f"Deutsche Texte ohne Wiki-Charakter: {sorted(missing_c)}")

# ---------- Empfehlungen ----------
ALL_EVOS = [e for e in E_ALL if e.get("result")]
def auto_recommendation(c_entry):
    """Grundempfehlung: Startwaffe plus die Partner für ihre Entwicklungen."""
    weapons_r, passives_r = [], []
    names = {slug(n): n for n in W_BY}
    for wid in c_entry["startingWeapons"]:
        wname = names.get(wid, wid)
        evos = [e for e in ALL_EVOS if wname in [w["name"] for w in e["weapons"]] and e["kind"] in ("evolution", "union", "gift")]
        if not evos:
            weapons_r.append({"id": wid, "reason": lt("Startwaffe.", "Starting weapon."), "priority": 1}); continue
        e = evos[0]
        res = e["result"][0]["name"]
        real_p = [p["name"] for p in e["passives"] if p["name"] in P_BY]
        others = [w["name"] for w in e["weapons"] if w["name"] != wname]
        if e["kind"] == "union":
            reason = lt(f"Startwaffe; zusammen mit {', '.join(de_name(o) for o in others)} entsteht die Union {de_name(res)}.",
                        f"Starting weapon; together with {', '.join(others)} it forms the union {res}.")
        elif real_p:
            reason = lt(f"Startwaffe; mit {' und '.join(de_name(p) for p in real_p)} wird sie zu {de_name(res)}.",
                        f"Starting weapon; with {' and '.join(real_p)} it becomes {res}.")
        else:
            reason = lt(f"Startwaffe; entwickelt sich zu {de_name(res)}.", f"Starting weapon; evolves into {res}.")
        weapons_r.append({"id": wid, "reason": reason, "priority": 1})
        for pn in real_p:
            if pn in CONSUMED: continue
            passives_r.append({"id": slug(pn), "reason": lt(f"Nötig für {de_name(res)}.", f"Needed for {res}."), "priority": 1})
        for wn in others:
            weapons_r.append({"id": slug(wn), "reason": lt(f"Partner für die Union {de_name(res)}.", f"Partner for the union {res}."), "priority": 1})
    if not weapons_r and not passives_r: return None
    dedup = lambda items: list({i["id"]: i for i in items}.values())
    return {"character": c_entry["id"], "source": pack_id, "weapons": dedup(weapons_r), "passives": dedup(passives_r)}

recs, manual = [], set()
for cname, (summary, rw, rp) in T.RECOMMENDATIONS.items():
    manual.add(slug(cname))
    summary_en, reasons_en = EN.RECOMMENDATIONS_EN[cname]
    def item(n, why, prio):
        if n not in reasons_en: raise SystemExit(f"Englische Begründung fehlt: {cname} / {n}")
        return {"id": slug(n), "reason": lt(localize_de(why), reasons_en[n]), "priority": prio}
    recs.append({"character": slug(cname), "source": pack_id, "summary": lt(localize_de(summary), summary_en),
                 "weapons": [item(*x) for x in rw], "passives": [item(*x) for x in rp]})
if code != "base":
    for c_entry in characters:
        if c_entry["id"] in manual: continue
        r = auto_recommendation(c_entry)
        if r: recs.append(r)

os.makedirs(target, exist_ok=True)
def dump(fname, key, items):
    with open(os.path.join(target, fname + ".json"), "w", encoding="utf-8") as f:
        json.dump({"$schema": f"../../schema/{fname}.schema.json", key: items}, f, ensure_ascii=False, indent=2)
        f.write("\n")
dump("characters", "characters", characters)
dump("weapons", "weapons", weapons)
dump("passives", "passives", passives)
dump("evolutions", "evolutions", evolutions)
dump("recommendations", "recommendations", recs)

official = sum(1 for x in characters + weapons + passives if "nameDe" in x or x["name"] in OFFICIAL_DE)
print(f"[{pack_id}] {len(characters)} Charaktere, {len(weapons)} Waffen, {len(passives)} Gegenstände, "
      f"{len(evolutions)} Entwicklungen, {len(recs)} Empfehlungen; offizielle deutsche Namen: {official}")
unv = [x["id"] for x in characters + weapons + passives + evolutions if not x["verified"]]
print("  verified:false ->", unv)
print("\n".join("  WARN " + w for w in warnings))
