#!/bin/bash
# Downloads the current wiki data and builds all JSON files under src/data/packs/ from it.
# WARNING: overwrites manual changes to the generated JSON files.
# Run from the project folder: bash tools/wiki-import/run.sh
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(cd "$HERE/../.." && pwd)"
RAW="$(mktemp -d)"
API="https://vampire.survivors.wiki/api.php"
UA="Mozilla/5.0 (compatible; wiki-reader/1.0)"

echo "Downloading wiki pages to $RAW …"
for page in Evolution Weapons Passive_items Characters; do
  curl -fsS -A "$UA" "$API?action=parse&page=$page&prop=wikitext&format=json&redirects=1" \
    | python3 -I -c 'import json,sys; sys.stdout.write(json.load(sys.stdin)["parse"]["wikitext"]["*"])' > "$RAW/$page.wiki"
done
python3 -I -c '
import re, sys
t = open(sys.argv[1], encoding="utf-8").read()
names = list(dict.fromkeys(re.findall(r"\{\{CharacterSelect\|([^}|]+)", t)))
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(names))' "$RAW/Characters.wiki" "$RAW/char_titles.txt"
python3 -I "$HERE/fetch_pages.py" "$API" "$RAW/char_titles.txt" "$RAW/characters_pages.json"

echo "Parsing tables …"
python3 -I "$HERE/parse_weapons.py" "$HERE" "$RAW/Weapons.wiki" "$RAW/weapons_parsed.json" > /dev/null
python3 -I "$HERE/parse_passives.py" "$HERE" "$RAW/Passive_items.wiki" "$RAW/passives_parsed.json" > /dev/null
python3 -I "$HERE/parse_evolutions.py" "$HERE" "$RAW/Evolution.wiki" "$RAW/evolutions_parsed.json" > /dev/null
python3 -I "$HERE/parse_chars.py" "$RAW/Characters.wiki" "$RAW/characters_pages.json" "$RAW/chars_parsed.json" > /dev/null
python3 -I "$HERE/parse_chars2.py" "$RAW/characters_pages.json" "$RAW/chars_parsed.json" "$RAW/weapons_parsed.json" > /dev/null

echo "Checking images on the wiki …"
python3 -I "$HERE/resolve_images.py" "$API" "$RAW"

echo "Downloading poncle's public localisation sheet (official German names) …"
# Linked from github.com/Poncle/vampire-survivors-localisation
SHEET="https://docs.google.com/spreadsheets/d/1niekzGKaM08M9oYP0wLqHYg5WU7h1iy3nLJL1XGDdJM/export?format=xlsx"
curl -fsSL -A "$UA" -o "$RAW/localisation.xlsx" "$SHEET"
python3 -I "$HERE/read_xlsx.py" "$RAW/localisation.xlsx" "$RAW/sheets.json" > /dev/null
python3 -I "$HERE/parse_localisation.py" "$RAW/sheets.json" "$RAW/loc_de.json"

echo "Building packs …"
for pair in base:base lm:legacy-of-the-moonspell bm:legacy-of-the-bloodmoon tf:tides-of-the-foscari \
            em:emergency-meeting og:operation-guns oc:ode-to-castlevania ed:emerald-diorama ac:ante-chamber; do
  code=${pair%%:*}; id=${pair#*:}
  python3 -I "$HERE/build_pack.py" "$HERE/texts" "$RAW" "$code" "$id" "de_$code" "$PROJECT/src/data/packs/$id"
done
rm -rf "$RAW"
echo "Done. Now check with 'npm test'."
