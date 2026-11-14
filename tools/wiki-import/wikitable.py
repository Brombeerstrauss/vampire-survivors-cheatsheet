import re
DLC = {"lm": "lm", "bm": "bm", "tf": "tf", "em": "em", "og": "og", "oc": "oc", "ed": "ed", "ac": "ac"}

def tables(text):
    """Liefert (Abschnittspfad, Tabellentext) für jede Tabelle."""
    out, path, i = [], [], 0
    lines = text.split("\n")
    buf, depth = None, 0
    for line in lines:
        m = re.match(r"^(=+)\s*(.*?)\s*\1\s*$", line)
        if m and buf is None:
            lvl = len(m.group(1)); path = path[:lvl-2] + [m.group(2).strip("' ")]
            continue
        if line.startswith("{|"):
            depth += 1
            if depth == 1: buf = []; continue
        if line.startswith("|}"):
            depth -= 1
            if depth == 0: out.append((list(path), "\n".join(buf))); buf = None; continue
        if buf is not None: buf.append(line)
    return out

def rows(table):
    chunks = re.split(r"^\|-.*$", table, flags=re.M)
    header, result = chunks[0], []
    head_lines = [l for l in "\n".join(chunks[:2]).split("\n") if l.startswith("!") and "colspan" not in l]
    heads = [h.strip() for h in re.findall(r"^!+(?:[^|\n]*\|)?\s*(.*)$", "\n".join(head_lines), re.M)]
    for ch in chunks[1:]:
        cells, cur = [], None
        for line in ch.split("\n"):
            if line.startswith("!"):
                cur = None; continue
            if line.startswith("|") and not line.startswith("|+"):
                parts = line[1:].split("||")
                for p in parts:
                    cur = [p]; cells.append(cur)
            elif cur is not None:
                cur.append(line)
        cells = ["\n".join(c).strip() for c in cells]
        if cells: result.append(cells)
    return heads, result

def strip_attr(cell):
    # "style=... | inhalt" -> "inhalt" (nur wenn vor dem ersten | kein [[ oder {{ steht)
    m = re.match(r"^([^\[\{|]*=[^\[\{|]*)\|(.*)$", cell, re.S)
    return m.group(2).strip() if m else cell

def names(cell):
    found = []
    for m in re.finditer(r"\{\{\s*(?:Sprite|slink|Slink)\s*\|([^}]*)\}\}|\[\[(?!File:|Category:)([^\]|]+)(?:\|([^\]]+))?\]\]", cell):
        if m.group(1) is not None:
            parts = m.group(1).split("|")
            name = parts[0].strip()
            kv = dict(p.split("=", 1) for p in parts[1:] if "=" in p)
            found.append({"name": kv.get("alttext", kv.get("txt", name)).strip(), "page": kv.get("link", name).strip(), "dlc": kv.get("dlc")})
        else:
            found.append({"name": (m.group(3) or m.group(2)).strip(), "page": m.group(2).strip(), "dlc": None})
    return found

def plain(cell):
    s = re.sub(r"\{\{\s*(?:Sprite|slink|Slink)\s*\|([^}|]*)[^}]*\}\}", r"\1", cell)
    s = re.sub(r"\{\{\s*stat\s*\|([^}|]*)[^}]*\}\}", r"\1", s, flags=re.I)
    s = re.sub(r"\{\{DLCBadge\|([a-z]+)\}\}", "", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    s = re.sub(r"\[\[File:[^\]]*\]\]", "", s)
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("'''", "").replace("''", "")
    return re.sub(r"[ \t]+", " ", s).strip()

def badge(cell):
    m = re.search(r"\{\{DLCBadge\|([a-z]+)\}\}|dlc=([a-z]+)", cell)
    return (m.group(1) or m.group(2)) if m else None
