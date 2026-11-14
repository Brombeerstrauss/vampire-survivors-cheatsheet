# Eigene Icons

Die App zeigt die Originalbilder aus dem Spiel, lädt sie aber vom Wiki und enthält selbst
keine Kopien. Hier kannst du eigene Bilder ablegen; sie haben Vorrang vor den Wiki-Bildern.

So geht's:

1. Bild in diesen Ordner legen, z. B. `whip.png` (quadratisch, 64×64 bis 128×128 Pixel
   reicht; erlaubt sind `.png`, `.webp`, `.svg`, `.jpg`, `.gif`).
2. Im passenden JSON-Eintrag unter `src/data/packs/<paket>/` das Feld `icon` setzen:

   ```json
   { "id": "whip", "name": "Whip", "icon": "whip.png" }
   ```

3. App neu bauen bzw. Seite neu laden.

Welches Bild erscheint: zuerst `icon` (dieser Ordner), sonst `image` (Wiki), sonst das Emoji
aus dem Feld `emoji`. Lädt ein Bild nicht, kommt automatisch das nächste dran.

Unterordner sind erlaubt (`"icon": "weapons/whip.png"`).

Bitte nur Bilder verwenden, die du selbst erstellt hast oder nutzen darfst.

Hinweis: Das Import-Werkzeug (`tools/wiki-import/run.sh`) schreibt die JSON-Dateien neu und
entfernt dabei von Hand eingetragene `icon`-Felder.
