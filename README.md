# Vampire Survivors Cheatsheet

Inoffizielle Begleit-App für **Vampire Survivors** als Web-App (PWA). Sie läuft im Browser
am PC und auf dem iPhone, lässt sich dort auf den Home-Bildschirm legen und funktioniert
danach auch offline.

Die App gibt es auf **Deutsch und Englisch**. Sie startet in der Sprache des Geräts; in den
Einstellungen lässt sich umschalten.

*Unofficial companion app for Vampire Survivors, in English and German. Open it, add it to
your home screen, and it works offline.*

**App öffnen:** https://brombeerstrauss.github.io/vampire-survivors-cheatsheet/

## Funktionen

- **Charaktere**: alle Charaktere aus Basisspiel und DLCs mit Suche, Startwaffe, Entwicklung
  und Empfehlungen. Geheime Charaktere lassen sich ausblenden.
- **Lauf-Tracker**: Waffen und passive Gegenstände des aktuellen Laufs eintragen (je 6
  Slots). Die App zeigt pro Waffe, was für die Entwicklung noch fehlt. Sind alle Teile da,
  sagt sie, was noch auf Maximalstufe gebracht werden muss, bevor die nächste Truhe die
  Entwicklung bringt. Stufen trägst du nicht ein. Unions, Geschenke, Morphs und
  Entwicklungen mit mehreren Gegenständen sind berücksichtigt.
- **Originalbilder**: Charaktere, Waffen und Gegenstände erscheinen mit den Grafiken aus dem
  Spiel. Die App lädt sie direkt vom Wiki und enthält selbst keine Kopien; in den
  Einstellungen lässt sich das abschalten, dann erscheinen Emojis.
- **Vorschläge**: fehlende Entwicklungs-Partner zuerst, dann Waffen, die zu deinen
  Gegenständen passen, dann Empfehlungen für den Charakter. Warnt, wenn die Slots für die
  geplanten Entwicklungen nicht mehr reichen.
- **Waffen und Gegenstände**: alles durchsuchen, mit Beschreibung, Entwicklung, Herkunft und
  passenden Charakteren.
- **DLC-Filter**: In den Einstellungen wählst du, welche DLCs du besitzt. Entwicklungen über
  DLC-Grenzen hinweg erscheinen nur, wenn alle beteiligten Inhalte aktiv sind.
- **Zurücksetzen** des Laufs mit einem Tippen, mit Rückgängig-Knopf.
- **Zwei Sprachen**: Auf Englisch stehen die Namen und Beschreibungen aus dem Spiel. Auf
  Deutsch die offiziellen deutschen Namen, soweit es sie gibt (siehe „Deutsche Namen“).
- **Version** der App mit Datum und Code-Stand steht in den Einstellungen.

Lauf und Einstellungen werden im Browser gespeichert (`localStorage`), es gibt keinen Server.

## Lokal starten

Voraussetzung ist [Node.js](https://nodejs.org/) ab Version 22.12 (LTS empfohlen).

```bash
npm install
```

```bash
npm run dev
```

Die App läuft dann unter http://localhost:5173. Weitere Befehle:

| Befehl | Zweck |
|---|---|
| `npm test` | Tests: Evolutions-Logik sowie alle JSON-Dateien gegen Schema und Verweise prüfen |
| `npm run build` | Fertige App in den Ordner `dist` bauen |
| `npm run preview` | Den gebauten Stand aus `dist` lokal ansehen |
| `npm run lint` | Code auf typische Fehler prüfen |
| `npm run icons` | App-Icons aus `public/logo.svg` neu erzeugen |

## Veröffentlichen

Damit die App ohne deinen Rechner erreichbar ist, kommt der Inhalt von `dist` zu einem
kostenlosen Anbieter für statische Webseiten. Alle drei Varianten brauchen ein (kostenloses)
Konto beim jeweiligen Anbieter. Die App nutzt relative Pfade und Hash-Adressen
(`#/lauf`), deshalb ist keine weitere Einstellung nötig.

Die Menünamen der Anbieter ändern sich gelegentlich; die Schritte bleiben im Kern gleich.

### Variante A: Netlify Drop (am einfachsten)

1. `npm run build` ausführen.
2. https://app.netlify.com/drop öffnen und anmelden oder ein Konto anlegen.
3. Den Ordner `dist` in das Browserfenster ziehen.
4. Netlify zeigt eine Adresse wie `https://irgendein-name.netlify.app`. Den Namen kannst du
   unter *Site configuration → Change site name* ändern.

**Aktualisieren:** erneut `npm run build`, dann im Netlify-Projekt unter *Deploys* den neuen
`dist`-Ordner in das Feld ziehen.

### Variante B: Cloudflare Pages

1. `npm run build` ausführen.
2. Im Cloudflare-Dashboard *Workers & Pages → Erstellen → Pages → Assets hochladen* wählen.
3. Projektnamen vergeben und den Ordner `dist` hochladen.
4. Die Adresse lautet dann `https://<projektname>.pages.dev`.

**Aktualisieren:** im Projekt *Neue Bereitstellung erstellen* und `dist` erneut hochladen.

### Variante C: GitHub Pages (aktualisiert sich automatisch)

Lohnt sich, wenn du den Code ohnehin auf GitHub ablegen willst. Der Workflow liegt bereits
unter `.github/workflows/deploy.yml`.

1. Auf GitHub ein neues Repository anlegen (öffentlich, sonst braucht Pages ein Bezahl-Abo).
2. Dieses Projekt dorthin hochladen (`git remote add origin …`, dann `git push -u origin main`).
3. Im Repository unter *Settings → Pages → Build and deployment → Source* „GitHub Actions“
   wählen.
4. Nach jedem Push baut GitHub die App neu. Die Adresse lautet
   `https://<benutzername>.github.io/<repository>/`.

## Auf dem iPhone installieren

1. Die veröffentlichte Adresse in **Safari** öffnen (andere Browser auf dem iPhone können
   Web-Apps je nach iOS-Version nicht immer auf den Home-Bildschirm legen).
2. Unten auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben).
3. Nach unten scrollen und **„Zum Home-Bildschirm“** wählen.
4. Namen bestätigen und **„Hinzufügen“** tippen.

Die App startet dann vom Home-Bildschirm im Vollbild, ohne Safari-Leisten. Nach dem ersten
Öffnen funktioniert sie auch ohne Internet. Neue Versionen lädt sie automatisch, sobald du
sie mit Internetverbindung öffnest; eventuell musst du sie einmal schließen und neu öffnen.

Lauf und Einstellungen liegen pro Gerät: Am iPhone und am PC hast du jeweils einen eigenen
Lauf.

## Daten

Alle Spieldaten liegen als JSON unter `src/data/`:

```
src/data/
├── packs.json                 Liste der Pakete (Basisspiel und DLCs)
├── packs/<paket>/
│   ├── characters.json        Charaktere
│   ├── weapons.json           Basiswaffen und entwickelte Waffen
│   ├── passives.json          passive Gegenstände
│   ├── evolutions.json        Entwicklungen, Unions, Geschenke, Morphs
│   └── recommendations.json   Empfehlungen pro Charakter
├── schema/                    JSON-Schemas für alle Dateien
└── types.ts                   TypeScript-Typen (mit Erklärung jedes Felds)
```

Wichtige Regeln:

- Jeder Eintrag hat eine Kennung (`id`) aus Kleinbuchstaben und Bindestrichen, z. B.
  `magic-wand`. Verweise zwischen den Dateien laufen über diese Kennungen.
- `source` ist die Kennung des Pakets und muss dem Ordnernamen entsprechen.
- `verified: false` heißt: noch nicht sicher gegen das Wiki geprüft. Die App zeigt solche
  Einträge mit dem Hinweis „ungeprüft“.
- Eine Entwicklung braucht die Waffe standardmäßig auf Maximalstufe; bei Gegenständen reicht
  standardmäßig der Besitz. Mit `"level": "max"` oder `"level": "any"` lässt sich das pro
  Zutat ändern. Die App nennt das nur als Hinweis, Stufen werden im Lauf nicht erfasst.
- `image` ist die Adresse des Originalbilds im Wiki, `emoji` der Platzhalter, falls das Bild
  nicht lädt oder Bilder abgeschaltet sind.
- Texte stehen in beiden Sprachen, z. B. `"description": { "de": "…", "en": "…" }`. Das gilt
  für Beschreibungen, Boni, Bedingungen, Hinweise und Empfehlungen.
- `name` ist der englische Name aus dem Spiel. `nameDe` ist der offizielle deutsche Name,
  `nameDeHint` eine eigene Übersetzung für Namen ohne offiziellen deutschen Namen.
- Empfehlungen werden aus allen aktiven Paketen zusammengeführt. Ein DLC kann also
  Empfehlungen für einen Charakter aus dem Basisspiel ergänzen.

Nach jeder Änderung prüft `npm test`, ob alle Dateien dem Schema entsprechen und alle
Verweise auf vorhandene Einträge zeigen.

**Neues DLC hinzufügen:** einen Ordner unter `src/data/packs/` mit den fünf Dateien anlegen
und das Paket in `packs.json` eintragen. Code muss dafür nicht geändert werden.

### Deutsche Namen

Die offiziellen deutschen Namen und Texte stammen aus poncles
[öffentlicher Lokalisierungs-Tabelle](https://github.com/Poncle/vampire-survivors-localisation).
Sie ist von 2022 und deckt nur einen Teil des Basisspiels ab (98 von 613 Namen); für die
DLCs enthält sie nichts. Deshalb gilt auf Deutsch:

- Gibt es einen offiziellen deutschen Namen, steht er da: „Peitsche“, „Blutige Träne“,
  „Hohlherz“.
- Sonst steht der englische Name aus dem Spiel. Lässt er sich sinnvoll übersetzen, folgt
  eine eigene Übersetzung in Klammern: „Unearthly Bolt (Überirdischer Blitz)“.
- Eigennamen wie „Pako Battiliar“ bleiben ohne Klammer.

Die eigenen Übersetzungen stehen in `tools/wiki-import/texts/names_de.py`.

### Bilder

Die Grafiken aus dem Spiel gehören poncle. Die App liefert sie nicht mit, sondern lädt sie
zur Laufzeit vom Wiki (Feld `image`). Einmal angezeigte Bilder speichert der Service Worker
auf dem Gerät, sodass sie auch offline erscheinen; Bilder, die du noch nie gesehen hast,
fehlen offline und werden durch das Emoji ersetzt.

Eigene Bilder haben Vorrang: unter `public/custom-icons/` ablegen und den Dateinamen im
passenden Eintrag als `"icon"` eintragen. Details stehen in `public/custom-icons/README.md`.

## Projektaufbau

| Ordner | Inhalt |
|---|---|
| `src/data/` | Spieldaten, Schemas, Typen, Lader und Datenprüfung |
| `src/logic/` | Evolutions-Logik, Lauf, Vorschläge (ohne Oberfläche, mit Tests) |
| `src/state/` | Gespeicherter Zustand, Einstellungen, Navigation |
| `src/i18n/` | Texte der Oberfläche auf Deutsch und Englisch, Namensanzeige |
| `src/components/` | Wiederverwendbare Bausteine der Oberfläche |
| `src/views/` | Die vier Ansichten: Charaktere, Lauf, Waffen, Einstellungen |

Technik: Vite, React, TypeScript, Tailwind CSS, vite-plugin-pwa (Service Worker für den
Offline-Betrieb), Vitest und Ajv für Tests. Alles Open Source.

## Stand der Daten

Stand: 14. November 2026. Enthalten sind das Basisspiel und alle acht bis dahin
erschienenen DLCs: Legacy of the Moonspell, Tides of the Foscari, Emergency Meeting,
Operation Guns, Ode to Castlevania, Emerald Diorama, Ante Chamber und Legacy of the
Bloodmoon. Zusammen 225 Charaktere, 352 Waffen, 36 passive Gegenstände und 165
Entwicklungen.

Jede Entwicklung wurde automatisch gegen drei Seiten des Wikis abgeglichen
(Entwicklungsliste, Waffenliste, Gegenstandsliste), jede Startwaffe gegen Charakterseite und
Waffenliste. Wo das nicht eindeutig war, steht `verified: false`:

| Paket | Eintrag | Grund |
|---|---|---|
| Emerald Diorama | Falconwind | Waffenliste verlangt Skull O'Maniac auf Maximalstufe, die Entwicklungsliste nicht |
| Legacy of the Moonspell | Megalo Miang Moonspell, Spiritosa | Startwaffe nur auf der Charakterseite genannt |
| Legacy of the Bloodmoon | Jaman Jato ★ | Startwaffe nur auf der Charakterseite genannt |
| Ode to Castlevania | Jonathan & Charlotte, Charlotte & Jonathan, Stella & Loretta Lecarde, Loretta & Stella Lecarde, Brauner, Dmitrii Blinov, Stone Skull, Astarte, Fake Trio, Megalo Elizabeth Bartley | Startwaffe nur auf der Charakterseite genannt |

Weitere Hinweise:

- Die Empfehlungen für die 34 regulären Charaktere des Basisspiels sind von Hand
  geschrieben. Für DLC-Charaktere gibt es eine Grundempfehlung (Startwaffe und die Partner
  für ihre Entwicklung), die sich in `recommendations.json` ausbauen lässt.
- Englische Namen und Beschreibungen sind die Originaltexte aus dem Spiel (laut Wiki).
  Deutsche Beschreibungen sind offizielle Texte, wo poncles Tabelle sie hat, sonst eigene
  Übersetzungen.
- Spezialwaffen (z. B. Gegenstücke der Arcana Gemini) und Arcanas sind nicht enthalten.

## Quellen und Lizenz

Das Projekt hat zwei Lizenzen:

- **Programmcode:** [MIT-Lizenz](LICENSE). Jeder darf ihn nutzen, ändern und weitergeben.
- **Spieldaten** (`src/data/packs/` und die deutschen Texte unter `tools/wiki-import/texts/`):
  [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/deed.de), weil sie aus
  dem offiziellen [Vampire Survivors Wiki](https://vampire.survivors.wiki/) stammen. Sie
  dürfen nur nicht-kommerziell, mit Quellenangabe und unter derselben Lizenz weitergegeben
  werden. Einzelheiten stehen in [LICENSE-DATA.md](LICENSE-DATA.md).

Der Programmcode wurde mit Claude Code geschrieben, einem KI-Werkzeug von Anthropic.

Die Bilder von Charakteren, Waffen und Gegenständen sind Grafiken aus dem Spiel und gehören
poncle. Eine Erlaubnis von poncle für ihre Nutzung in Fan-Projekten liegt nicht vor; die App
bindet sie deshalb nur vom Wiki ein, statt Kopien zu verbreiten.

Inoffizielles Fan-Projekt, nicht verbunden mit poncle. Vampire Survivors ist eine Marke von
poncle.
