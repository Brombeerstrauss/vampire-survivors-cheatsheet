"""Erzeugt die JSON-Dateien eines Pakets aus den ausgelesenen Wiki-Daten.

Aufruf: python3 -I build_pack.py <tools-dir> <wiki-raw-dir> <wiki-code> <pack-id> <texte-modul> <ziel-ordner>

`verified` wird nur gesetzt, wenn die Angaben auf mehreren Wiki-Seiten
übereinstimmen (Entwicklungsseite, Waffenliste, Gegenstandsliste, Charakterseite).
"""
import importlib, json, os, re, sys, unicodedata

tools, raw, code, pack_id, text_module, target = sys.argv[1:7]
sys.path.insert(0, tools)
T = importlib.import_module(text_module)
PASSIVE_FLAGS = getattr(T, "PASSIVE_FLAGS", {})
CONSUMED = getattr(T, "CONSUMED", set())
GLIMMER_NOTE = getattr(T, "GLIMMER_NOTE", None)

W_ALL = json.load(open(os.path.join(raw, "weapons_parsed.json"), encoding="utf-8"))
P_ALL = json.load(open(os.path.join(raw, "passives_parsed.json"), encoding="utf-8"))
E_ALL = json.load(open(os.path.join(raw, "evolutions_parsed.json"), encoding="utf-8"))
C_ALL = json.load(open(os.path.join(raw, "chars_parsed.json"), encoding="utf-8"))

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
        conditions = [f"Relikt {relic} besitzen." if relic else "Relikt besitzen.", T.MORPH_RELIC_LEVEL + "."]
    else:
        for p in e["passives"]:
            if p["name"] in P_BY:
                passives.append(p)
            elif p["name"] in PSEUDO:
                pass
            elif GLIMMER_NOTE:
                conditions.append(GLIMMER_NOTE.format(tech=p["name"]))
            else:
                warn(f"{result}: unbekannte Zutat {p['name']}")
    extra = T.EVOLUTION_DE.get(result, {})
    conditions = extra.get("conditions", []) + [c for c in conditions if c not in extra.get("conditions", [])]

    # Gegenprüfung mit Waffen- und Gegenstandsliste
    problems = []
    res = W_BY.get(result)
    if not res:
        problems.append(f"Ergebnis {result} fehlt in der Waffenliste")
    else:
        req = norm(res["requirements"]) + " " + norm(res["description"])
        if e["kind"] in ("evolution", "morph") and res["evolveFrom"] and weapons_in[0] not in res["evolveFrom"]:
            problems.append(f"Waffenliste nennt {res['evolveFrom']} als Ausgangswaffe")
        for p in passives:
            if p["name"] not in req:
                problems.append(f"Waffenliste nennt {p['name']} nicht als Bedingung")
            listed_max = re.search(r"max(?:imum)? level[^.;*]*" + re.escape(p["name"]), req, re.I) is not None
            if p.get("max") and "max" not in req.lower():
                problems.append(f"Waffenliste nennt für {p['name']} keine Maximalstufe")
            if listed_max and not p.get("max"):
                problems.append(f"Waffenliste verlangt {p['name']} auf Maximalstufe, die Entwicklungsseite nicht")
        if e["kind"] == "union":
            for w in weapons_in:
                if w not in req: problems.append(f"Union-Eintrag nennt {w} nicht")
    for p in passives:
        pi = P_BY.get(p["name"])
        if pi and pi["evolvesWith"] and e["kind"] == "evolution" and not any(x.split("@")[0] == weapons_in[0] for x in pi["evolvesWith"]):
            problems.append(f"Gegenstandsliste nennt {weapons_in[0]} nicht bei {p['name']}")
    base = W_BY.get(weapons_in[0])
    if e["kind"] == "evolution" and base and base["evolution"] and result not in base["evolution"] and result != "Miracle of Multiplication":
        problems.append(f"Waffenliste nennt bei {weapons_in[0]} als Entwicklung {base['evolution']}")

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
    notes = [extra["note"]] if extra.get("note") else []
    if problems:
        notes.append("Ungeprüft: " + "; ".join(problems) + ".")
        warn(f"{result}: " + "; ".join(problems))
    if notes: entry["note"] = " ".join(notes)
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
    emoji, desc = T.WEAPONS[name]
    kind = "base" if w["section"] == "Base Weapons" else "evolved"
    m = re.search(r"max Level of (\d+)", w["info"])
    if kind == "base":
        ml = int(w["maxLevel"]) if w["maxLevel"].isdigit() else None
    else:
        ml = int(m.group(1)) if m else 1
    problems = []
    if ml is None:
        problems.append("Maximalstufe fehlt im Wiki"); ml = 8
    entry = {"id": slug(name), "name": name, "source": pack_id, "kind": kind, "description": desc,
             "maxLevel": ml, "emoji": emoji, "verified": not problems}
    if problems:
        entry["note"] = "Ungeprüft: " + "; ".join(problems) + "."
        warn(f"Waffe {name}: " + "; ".join(problems))
    weapons.append(entry)
missing_w = set(T.WEAPONS) - seen_w
if missing_w: warn(f"Deutsche Texte ohne Wiki-Waffe: {sorted(missing_w)}")

# ---------- Passive Gegenstände ----------
passives = []
for p in P_ALL:
    if p["name"] not in T.PASSIVES: continue
    emoji, desc = T.PASSIVES[p["name"]]
    problems = []
    ml = int(p["maxLevel"]) if p["maxLevel"].isdigit() else None
    if ml is None: problems.append("Maximalstufe fehlt im Wiki"); ml = 5
    entry = {"id": slug(p["name"]), "name": p["name"], "source": pack_id, "description": desc, "maxLevel": ml}
    if p["name"] in getattr(T, "STAGE_ONLY", set()): entry["stageOnly"] = True
    entry.update(PASSIVE_FLAGS.get(p["name"], {}))
    entry.update({"emoji": emoji, "verified": not problems})
    if problems:
        entry["note"] = "Ungeprüft: " + "; ".join(problems) + "."
        warn(f"Gegenstand {p['name']}: " + "; ".join(problems))
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
            problems.append(f"Waffenliste nennt {c['name']} nicht bei {s}")
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
        if others: notes.append("Alternativ wählbare Startwaffe: " + ", ".join(others) + ".")
    else:
        start = ib
        if ib: problems.append("Startwaffe nur auf der Charakterseite genannt")
    unknown = [w for w in start if w not in W_BY]
    if unknown:
        notes.append("Startet zusätzlich mit: " + ", ".join(unknown) + ".")
        start = [w for w in start if w in W_BY]
    if c.get("hiddenWeapon"):
        notes.append(f"Versteckte Waffe: {c['hiddenWeapon']}.")
    return list(dict.fromkeys(start)), problems, notes

characters = []
for c in [c for c in C_ALL if c["pack"] == code]:
    name = c["name"]
    if name not in T.CHARACTERS:
        warn(f"Charakter ohne deutschen Text übersprungen: {name}"); continue
    emoji, bonus = T.CHARACTERS[name]
    start, problems, auto_notes = (base_start if code == "base" else dlc_start)(c)
    secret = c["group"] in ("Secret", "Hidden") or (c.get("secret") or "").lower() == "yes"
    entry = {"id": slug(name), "name": name, "source": pack_id, "startingWeapons": [slug(s) for s in start],
             "bonus": bonus, "secret": secret, "emoji": emoji, "verified": not problems}
    notes = ([T.CHARACTER_NOTES[name]] if name in T.CHARACTER_NOTES else []) + auto_notes
    if problems:
        notes.append("Ungeprüft: " + "; ".join(problems) + ".")
        warn(f"Charakter {name}: " + "; ".join(problems))
    if notes: entry["note"] = " ".join(notes)
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
            weapons_r.append({"id": wid, "reason": "Startwaffe.", "priority": 1}); continue
        e = evos[0]
        res = e["result"][0]["name"]
        real_p = [p["name"] for p in e["passives"] if p["name"] in P_BY]
        others = [w["name"] for w in e["weapons"] if w["name"] != wname]
        if e["kind"] == "union":
            reason = f"Startwaffe; zusammen mit {', '.join(others)} entsteht die Union {res}."
        elif real_p:
            reason = f"Startwaffe; mit {' und '.join(real_p)} wird sie zu {res}."
        else:
            reason = f"Startwaffe; entwickelt sich zu {res}."
        weapons_r.append({"id": wid, "reason": reason, "priority": 1})
        for pn in real_p:
            if pn in CONSUMED: continue
            passives_r.append({"id": slug(pn), "reason": f"Nötig für {res}.", "priority": 1})
        for wn in others:
            weapons_r.append({"id": slug(wn), "reason": f"Partner für die Union {res}.", "priority": 1})
    if not weapons_r and not passives_r: return None
    dedup = lambda items: list({i["id"]: i for i in items}.values())
    return {"character": c_entry["id"], "source": pack_id, "weapons": dedup(weapons_r), "passives": dedup(passives_r)}

recs = []
manual = set()
for cname, (summary, rw, rp) in T.RECOMMENDATIONS.items():
    manual.add(slug(cname))
    recs.append({"character": slug(cname), "source": pack_id, "summary": summary,
                 "weapons": [{"id": slug(n), "reason": why, "priority": prio} for n, why, prio in rw],
                 "passives": [{"id": slug(n), "reason": why, "priority": prio} for n, why, prio in rp]})
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

print(f"[{pack_id}] {len(characters)} Charaktere, {len(weapons)} Waffen, {len(passives)} Gegenstände, {len(evolutions)} Entwicklungen, {len(recs)} Empfehlungen")
unv = [x["id"] for x in characters + weapons + passives + evolutions if not x["verified"]]
print("  verified:false ->", unv)
print("\n".join("  WARN " + w for w in warnings))
