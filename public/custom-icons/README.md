# Eigene Icons

Die App bringt aus Urheberrechtsgründen keine Grafiken aus dem Spiel mit und zeigt
stattdessen Emojis als Platzhalter. Hier kannst du eigene Bilder ablegen.

So geht's:

1. Bild in diesen Ordner legen, z. B. `whip.png` (quadratisch, 64×64 bis 128×128 Pixel
   reicht; erlaubt sind `.png`, `.webp`, `.svg`, `.jpg`, `.gif`).
2. Im passenden JSON-Eintrag unter `src/data/packs/<paket>/` das Feld `icon` setzen:

   ```json
   { "id": "whip", "name": "Whip", "icon": "whip.png" }
   ```

3. App neu bauen bzw. Seite neu laden. Fehlt das Feld `icon` oder die Datei, wird
   weiter das Emoji aus dem Feld `emoji` gezeigt.

Unterordner sind erlaubt (`"icon": "weapons/whip.png"`).

Bitte nur Bilder verwenden, die du selbst erstellt hast oder nutzen darfst.
