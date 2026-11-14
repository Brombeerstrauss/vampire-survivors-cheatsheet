# Wiki-Import

Werkzeug, mit dem die Spieldaten unter `src/data/packs/` aus dem
[Vampire Survivors Wiki](https://vampire.survivors.wiki/) erzeugt wurden. Für normale
Änderungen an den Daten brauchst du es nicht: Die JSON-Dateien lassen sich direkt bearbeiten.

Nützlich ist es, wenn das Wiki aktualisiert wurde oder ein neues DLC dazukommt:

```bash
bash tools/wiki-import/run.sh
```

Das Skript lädt die Wiki-Seiten, wertet die Tabellen aus und schreibt alle Pakete neu.
**Handänderungen an den erzeugten JSON-Dateien gehen dabei verloren**, also vorher committen
und danach mit `git diff` vergleichen.

- `texts/de_<kürzel>.py`: deutsche Beschreibungen, Platzhalter-Emojis und Sonderregeln je
  Paket. Neue Wiki-Einträge ohne deutschen Text meldet das Skript als `WARN` und lässt sie weg.
- `build_pack.py`: setzt `verified` nur, wenn Entwicklungsliste, Waffenliste und
  Gegenstandsliste übereinstimmen; Abweichungen landen im Feld `note`.

Voraussetzung: `python3` (auf macOS vorhanden) und `curl`.
