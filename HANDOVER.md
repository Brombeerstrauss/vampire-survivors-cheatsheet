# Übergabe: Vampire Survivors Cheatsheet

Stand: 24.11.2026. Für die Weiterarbeit mit einer anderen KI (z. B. in Mammouth AI) oder von Hand.
Abschnitt 1 ist zum Einfügen als erste Nachricht oder Projektanweisung gedacht, der Rest ist
Nachschlagewerk. Lade diese Datei bei jeder neuen Unterhaltung mit hoch.

---

## 1. Start-Anweisung (zum Einfügen)

```text
Du hilfst mir bei meinem Projekt "vampire-survivors-cheatsheet" (GitHub: Brombeerstrauss/vampire-survivors-cheatsheet).
Die Datei HANDOVER.md beschreibt Projekt, Regeln, Stand und offene Punkte. Lies sie zuerst vollständig.

So arbeiten wir:
- Antworte auf Deutsch, duze mich, kurz und präzise, faktenbasiert, ohne Floskeln.
- Sag "weiß ich nicht", statt zu raten. Hinterfrage Annahmen, auch meine.
- Stell am Ende höchstens eine Frage, und nur wenn sie wirklich nötig ist.
- Biete Open-Source-Alternativen an, wenn sie passen.
- Du kannst keinen Code ausführen und nicht auf GitHub zugreifen: Sag mir genau, welche Dateien du
  sehen musst, und welche Befehle ich ausführen soll. Gib Änderungen als vollständige Dateien oder als
  eindeutige Ersetzungen (alter Text -> neuer Text) aus, nie als "...rest bleibt gleich" ohne Ort.
- Erfinde keine Spiel-Interna (Feld- oder Methodennamen des Spiels). Wenn unbekannt: per Reflection mit
  Fallback-Namen lesen und Log-Zeilen bzw. /debug-Ausgabe einbauen, damit ich nachsehen kann.
- Code, Kommentare, Commit-Messages und READMEs auf Englisch. Oberflächentexte immer Deutsch und Englisch.
- Halte dich an die Regeln in HANDOVER.md Abschnitt 4 (Git, Tests, Daten).
```

---

## 2. Was das Projekt ist

Zwei Teile in einem Repo:

1. **Web-App (PWA)**: inoffizieller Begleiter für Vampire Survivors, Deutsch und Englisch. Charaktere,
   Waffen, Items, Entwicklungen, Run-Tracker, Empfehlungen, DLC-Filter, sortierbar ("wie im Spiel" oder A–Z).
   Live: https://brombeerstrauss.github.io/vampire-survivors-cheatsheet/ (wird bei jedem Push auf `main`
   automatisch über GitHub Actions gebaut und veröffentlicht, `.github/workflows/deploy.yml`).
2. **Mod `VSCheatsheetBridge`** (`mod/`): BepInEx-6-Plugin (IL2CPP) mit einem Overlay im Spiel:
   - fehlende Teile für die nächste Entwicklung jeder Waffe,
   - Noten A+ bis D für die Karten auf dem Level-up-Bildschirm (passend zu Charakter und Build),
   - Minimap (Prototyp) mit Gegenständen, Truhen, Gegnern und Bossen,
   - lokaler Server `http://127.0.0.1:47321` (`/state`, `/events`, `/debug`), über den die App den Run
     übernehmen kann.

Ich spiele meist auf dem **Steam Deck** (Proton). Viele Mod-Funktionen sind dort noch nicht bestätigt.

---

## 3. Aufbau des Repos

| Pfad | Inhalt |
|---|---|
| `src/data/packs/<pack>/*.json` | Spieldaten je Pack (base + 8 DLCs): characters, weapons, passives, evolutions, recommendations |
| `src/data/packs.json` | Liste der Packs |
| `src/data/community-tiers.json` | Stärke aus Community-Tierlisten (Tier 1–3), Quellen stehen in der Datei |
| `src/data/stat-items.json` | Stat -> passives Item (z. B. might -> spinach) |
| `src/data/schema/` | JSON-Schemas; `src/data/data.test.ts` prüft Schema und Verweise |
| `src/data/types.ts` | TypeScript-Typen mit Beschreibung jedes Felds |
| `src/logic/` | Entwicklungslogik, Run, Vorschläge, Mod-Anbindung (mit Tests) |
| `src/state/` | Einstellungen (`localStorage`), Navigation, Mod-Verbindung |
| `src/i18n/` | UI-Texte de/en, Namensanzeige, Sortierung (`names.ts`) |
| `src/views/` | Ansichten: Characters, Run, Library (Waffen/Items), Settings |
| `src/components/` | UI-Bausteine (`ui.tsx`: Card, Pill, SortToggle, …) |
| `tools/wiki-import/` | Python-Werkzeuge, die die Daten aus dem Wiki erzeugt haben (`run.sh`, `weapon_effects.py`, `wiki_tips.py`, Texte in `texts/`) |
| `scripts/export-mod-data.mjs` | erzeugt `cheatsheet-data.json` für den Mod aus den App-Daten (eine Datenquelle) |
| `mod/VSCheatsheetBridge/` | Quellcode des Plugins (siehe Abschnitt 6) |
| `mod/harness/` | Test ohne Spiel: kompiliert das Plugin gegen Attrappen (siehe Abschnitt 5) |
| `mod/build-linux.sh` | baut das Plugin auf Linux/Steam Deck und kopiert es ins Spiel |
| `mod/README.md` | Mod-Doku: Installation, Bauen, Steam Deck, Testen, alle Einstellungen |
| `README.md` | App-Doku: Funktionen, Daten, Regeln, Quellen, Lizenzen |

Lizenzen: Code MIT, Spieldaten CC BY-NC-SA 3.0 (aus dem Vampire Survivors Wiki), Bilder gehören poncle
und werden nur vom Wiki eingebunden, nie kopiert.

---

## 4. Regeln für die Arbeit

**Git**
- Änderungen an der **Web-App** (alles außer `mod/`) gehen **direkt auf `main`**, damit die App sofort
  aktualisiert wird.
- Änderungen am **Mod** gehen auf einen Branch und per **Pull Request**. Gemergt wird erst, wenn ich es
  sage (meist nach meinem Test im Spiel).
- Nach dem Merge löscht GitHub den Branch automatisch.
- Commit-Messages: Englisch, erste Zeile kurz ("Minimap: drag with the mouse, show enemies and bosses"),
  darunter ein kurzer Absatz, was und warum.

**Vor jedem Commit**
- App: `npm test` (Logik + alle JSON-Dateien gegen Schema und Verweise), `npm run build` (inkl. TypeScript),
  `npm run lint`.
- Mod: `dotnet run -- minimap`, `grading` und `stagemap` in `mod/harness/` (Abschnitt 5). Der echte
  Build braucht die Spieldateien und läuft nur bei mir.

**Daten**
- IDs: Kleinbuchstaben mit Bindestrich (`magic-wand`). Verweise nur über IDs.
- `gameIds`: die internen Spiel-IDs (`WHIP`, `MAXHEALTH`) aus dem Wiki-Infobox-Feld `id`.
- Texte immer zweisprachig `{ "de": "…", "en": "…" }`. `name` = englischer Spielname, `nameDe` = offizieller
  deutscher Name, `nameDeHint` = eigene Übersetzung.
- `verified: false`, wenn nicht sicher gegen das Wiki geprüft.
- Neues DLC: Ordner unter `src/data/packs/` mit den fünf Dateien + Eintrag in `packs.json`, kein Code nötig.
- Quellen nennen (Wiki, Tierlisten); keine Daten erfinden.

**Mod-Technik (wichtig, sonst stürzt das Spiel ab oder es geht kaputt)**
- **Kein `OnGUI`/IMGUI**: führte unter BepInEx be.788 + Unity 6 zu Abstürzen in `coreclr.dll`. Overlay und
  Minimap bestehen aus normalen Unity-UI-Objekten (Canvas, Image, TextMeshProUGUI), die nur bei Änderungen
  neu aufgebaut bzw. ein paar Mal pro Sekunde verschoben werden.
- Spiel nur im **Hauptthread** lesen (`BridgeBehaviour.Update`). Der Server bekommt fertige JSON-Strings.
- Spielobjekte per **Reflection mit Fallback-Namen** lesen (`RunReader.Get`/`GetMember`), keine direkte
  Referenz auf die Spiel-Assemblies. Il2Cpp-Listen sind keine .NET-Enumerables: `RunReader.Items()`.
- Neue gelesene Objekte mit `RunReader.AddDebugEntry` in `/debug` aufnehmen, damit umbenannte Felder
  auffindbar sind; einmalige Log-Zeilen mit Präfix (`[Minimap] …`) für die Fehlersuche.
- Tasten und Maus über `user32.dll` (`GetAsyncKeyState`, `GetCursorPos`), nicht über Unity Input.
  Unter Proton nicht bestätigt.

---

## 5. Befehle

```bash
# App
npm install
npm run dev          # http://localhost:5173
npm test
npm run build
npm run lint

# Mod-Daten aus den App-Daten erzeugen (macht der Mod-Build selbst)
node scripts/export-mod-data.mjs <ziel.json>

# Mod bauen, Windows
dotnet build mod/VSCheatsheetBridge -c Release -p:GameDir="<Spielordner>"
# Mod bauen, Linux/Steam Deck (findet das Spiel selbst, lädt .NET/Node bei Bedarf nach ~/.cache)
bash mod/build-linux.sh

# Test ohne Spiel (.NET SDK 8+)
cd mod/harness
dotnet run -- minimap
node ../../scripts/export-mod-data.mjs cheatsheet-data.json   # einmal und nach Datenänderungen
dotnet run -- grading
dotnet run -- stagemap

# Wiki-Import (Python, braucht Netz zum Wiki)
bash tools/wiki-import/run.sh
```

Im Spiel testen: Log `BepInEx/LogOutput.log`, Einstellungen `BepInEx/config/de.cheatsheet.vs.bridge.cfg`
(nur bei geschlossenem Spiel bearbeiten), `curl http://127.0.0.1:47321/state` bzw. `/debug`.

Vorausgesetzt: Vampire Survivors 1.16.x (Unity 6, IL2CPP), BepInEx 6.0.0-be.788
(`BepInEx-Unity.IL2CPP-win-x64`), auf dem Deck Startoption `WINEDLLOVERRIDES="winhttp=n,b" %command%`.

---

## 6. Mod im Detail

| Datei | Aufgabe |
|---|---|
| `Plugin.cs` | Einstieg, alle Einstellungen (`Config.Bind`), `BridgeBehaviour.Update`: Tasten (F7/F8/F9), Ziehen mit der Maus, Klicks im Minimap-Menü, Takt für Lesen/Overlay/Minimap |
| `RunReader.cs` | liest Run, Charaktere, Ausrüstung, Level-up-Bildschirm per Reflection; `/debug`-Einträge; Helfer `GetMember`, `Items`, `FindGameType`, `FirstCharacter`, `WarnOnce` |
| `RunSnapshot.cs` | Datenmodell des Runs + JSON für `/state` |
| `StateServer.cs` | lokaler HTTP-Server (`/state`, `/events`, `/debug`), erlaubte Origins |
| `EvolutionAdvisor.cs` | Entwicklungen je Waffe, Level-up-Noten, Sprache (de/en/auto) |
| `UiOverlay.cs` | Overlay-Panel (Titelleiste klappt ein, ziehbar), Level-up-Noten oben |
| `GameSprites.cs`, `WeaponStats.cs`, `GameText.cs` | Bilder, Waffenwerte und Namen aus den Spieldaten |
| `MinimapReader.cs` | Punkte für die Minimap (Gegenstände, Truhen, Gegner, Bosse) |
| `MinimapOverlay.cs` | Zeichnet Minimap und F7-Menü |
| `StageMap.cs` | Kartenbild der Stage: lesen, Umrechnung aus der Pausenkarte lernen, speichern |
| `VSCheatsheetBridge.csproj` | Version (`<Version>0.10.0</Version>`), Build, Daten-Export, Release-ZIP |

**Level-up-Noten** (`EvolutionAdvisor.GradeOffers`): Punkte je Karte aus
- Entwicklung (3 bzw. 2) und Partner für eine Entwicklung (2 vorhanden, 1 geplant),
- Charakter-Empfehlung (Priorität 1/2/3 -> 3/2/1 Punkte),
- Build: Waffe profitiert von vorhandenen Items (1 je Item, 0,5 geplant, Might/Cooldown halb) bzw. Item
  verstärkt vorhandene Waffen (1 je Waffe, 0,5 je empfohlener Waffe), höchstens 3,
- Community-Tier (2 / 1,5 / 1),
- Slots: −2 neues Item blockiert nötige Entwicklungspartner, −1 neue Waffe ohne Platz für ihren Partner,
  +1 Upgrade wenn höchstens 1 Slot frei (6 Slots, `noSlot`-Items zählen nicht).

A ab 3, B ab 2, C ab 1, sonst D. Bringt die Karte eine Entwicklung näher: mindestens A, A+ wenn sie
zusätzlich zum aktuellen Build oder zum Charakter passt; diese Karten stehen oben. Klare Wiki-Warnung
(`avoid` in `recommendations.json`): immer D, ganz unten.

**Minimap**
- Gegenstände wie die Pausenkarte des Spiels: `MapManager.GetAllWorldItems()` (privat, per Reflection;
  der MapManager wird mit `Resources.FindObjectsOfTypeAll` gesucht, auch inaktiv), Truhen per
  `FindObjectsOfType(TreasureChest)`. Erfahrungs-Edelsteine (`GEM`) ausgelassen.
- Zusätzlich alle aktiven `Pickup`-Objekte der Szene (`FindObjectsOfType`, alle 3 s, ohne `GEM`):
  Stage-Gegenstände vom Start und Portale stehen nicht in `GetAllWorldItems`. Doppelte werden über
  den nativen Zeiger erkannt. Hat ein Pickup ein Kartensymbol (`HasMapTokenData`, `MapTokenFrameName`,
  `MapTokenTexture`), wird das gezeichnet. 15 s nach Laufbeginn einmal Log `[Minimap] pickups from the
  map's list … more in the scene …` und Mitglieder von Stage/MapManager/GameManager mit passenden Namen.
  Bei zu vielen Punkten fällt Kleinkram zuerst weg (max. 150).
- Gruppen: Truhen (`CHEST`, `*TREASURE*`), Kleinkram (Liste des Spiels `MapManager._minorItemTypes`
  + eigene Liste in `MinimapReader.MinorKinds`), Rest = Relikte/Items.
- Gegner: `GameManager.Stage._spawnedEnemies` (bzw. `SpawnedEnemies`), Boss über `IsBoss`, Typ über
  `EnemyType`. Normale Gegner rote Punkte (nur in Reichweite, max. 250), Bosse mit eigenem Bild (max. 20).
- Bedienung: F8 schaltet der Reihe nach beide → nichts → nur Overlay → nur Karte; mit der Maus ziehen
  (Position wird gespeichert); F9 setzt Overlay und Karte zurück; **F7** öffnet das Menü unter der Karte:
  Gegner (alle/Bosse/aus), Truhen, Relikte/Items, Kleinkram, Größe −/+, Reichweite −/+, Kartenbild,
  Position zurücksetzen.
- Einstellungen `[Minimap]`: `Enabled`, `Visible`, `Size`, `X`, `Y`, `Range`, `Opacity`, `Enemies`,
  `Chests`, `Relics`, `Minor`, `IconSize`, `StageMap`, `MenuKey`, `IntervalMs`.
- **Kartenbild** (`StageMap.cs`): Hat die Stage ein Kartenbild in der Pausenkarte
  (`MapManager._detailedMapSprite`), zeigt die Minimap den Ausschnitt um den Spieler dahinter. Die
  Umrechnung Welt -> Bild rechnet das Spiel intern (Formel unbekannt), deshalb lernt der Mod sie:
  Bei sichtbarer Pausenkarte (MapManager aktiv, nicht ausgeblendet; im Online-Koop läuft das Spiel
  dabei weiter, deshalb zählt eine Messung nur, solange der Spieler stillsteht und die Markierung
  zwei Lesungen lang gleich bleibt) wird die Position der Spieler-Markierung
  `MapManager._Player` auf dem Bild (`Image` mit diesem Sprite, per `InverseTransformPoint` in 0..1
  umgerechnet) mit der Weltposition gepaart. Fit je Achse per kleinsten Quadraten
  (`u = Ax*x + Bx`, `v = Ay*y + By`), mind. eine halbe Bildschirmbreite Abstand je Achse,
  Ausreißer werden verworfen. Gespeichert je Bild in `BepInEx/config/de.cheatsheet.vs.bridge.stagemaps.json`.
  Gezeichnet als `RawImage` mit `uvRect` (nur der Teil, der auf dem Bild liegt). Einstellung `StageMap`,
  Schalter "Kartenbild" im F7-Menü. **Im Spiel ungetestet**: ob `_Player` wirklich die Markierung auf
  dem Bild ist und ob das Bild ein `Image` unter dem MapManager ist, zeigen die `[StageMap]`-Logzeilen.
- Online-Koop: Die Minimap folgt der Figur, die der Kamera am nächsten ist (die eigene), sonst Spieler 1
  (`MinimapReader.OwnCharacter`, `GameManager.IsOnlineMultiplayer`). Im Spiel ungetestet.
- Joker (Ante Chamber) sind laut Wiki Gegner (z. B. Spectral Joker, ID `LEM_SPECTRAL`); ob sie als Boss
  zählen, ist unbekannt.

---

## 7. Aktueller Stand

- Alles ist auf `main`: App aktuell und live; Mod mit Minimap (Gegner, Ziehen, F8-Reihenfolge,
  F7-Menü, Kartenbild der Stage, größere Symbole über `IconSize`), Test-Harness in `mod/harness/` und
  diese Datei. Rückmeldung zum Kartenbild nach dem Test: "klappt so".

**Auffindbarkeit (Suchmaschinen):** statische Mod-Seiten `public/mod/index.html` (Englisch) und
`public/mod/de/index.html` (Deutsch) mit Beschreibung, `hreflang`, Open Graph und JSON-LD
(`SoftwareApplication`); `index.html` der App mit Beschreibung, JSON-LD (`WebApplication`) und einem
lesbaren Grundtext in `#root`, den React beim Start ersetzt; `public/sitemap.xml`. Der Service Worker
beantwortet `/mod/` und die Sitemap nicht mit der App (`navigateFallbackDenylist` in `vite.config.ts`).
Eine `robots.txt` wirkt nur im Wurzelverzeichnis der Domain (`brombeerstrauss.github.io/`), nicht im
Projektpfad, deshalb gibt es keine.

## 8. Offene Punkte

1. **Im Spiel noch nicht ausdrücklich bestätigt** (Steam Deck): Ziehen der Karte, Gegner/Bosse,
   F8-Reihenfolge, F7-Menü per Touch/Trackpad, Online-Koop (folgt die Minimap der eigenen Figur?),
   Größe der Symbole. Wenn Ziehen oder Klicks nicht gehen: prüfen, ob sich das Overlay ziehen lässt;
   wenn nicht, kommen Maus-Eingaben unter Proton nicht an.
2. **Joker**: aus dem Log die Zeilen `[Minimap] … enemies …` und `[Minimap] boss on the stage …` in der
   Ante Chamber auswerten; danach ggf. bestimmte Gegnertypen mit Bild statt als Punkt zeigen.
3. **Leistung** auf dem Deck mit vielen Gegnern prüfen (alle 200 ms per Reflection). Notfalls
   `IntervalMs` erhöhen oder Gegner-Getter weiter optimieren.
4. **Kleinkram-Liste** mit der Log-Zeile `[Minimap] small pickups per the game: …` abgleichen.
5. **Auffindbarkeit, nur mit deinen Konten möglich:** Repo-Beschreibung und Topics auf GitHub setzen,
   Google Search Console und Bing Webmaster Tools (Sitemap einreichen), Release `mod-v0.10.0` mit ZIP,
   Seite auf Nexus Mods, Beitrag auf r/VampireSurvivors.
6. Möglich, aber nicht begonnen: Steuerung des F7-Menüs per Controller (heute nur Klick).
   Release-Ablauf: `mod/README.md` "Making a release".

## 9. Unsicherheiten

- Ob Mammouth AI Repositories direkt lesen oder Code ausführen kann, weiß ich nicht. Diese Anleitung geht
  davon aus, dass du Dateien hochlädst und Befehle selbst ausführst.
- Steam-Deck-Betrieb (Proton, Eingaben, `build-linux.sh`) ist kaum bestätigt.
- Feldnamen des Spiels stammen aus dekompiliertem Code anderer Mods (VSEvolutionHelperEx, jev_vampire_survivors,
  vampiresurvivors-modding) und können sich mit Spiel-Updates ändern; `/debug` zeigt die echten Namen.

## 10. Welche Dateien du der KI je Aufgabe gibst

| Aufgabe | Dateien |
|---|---|
| Immer | `HANDOVER.md` |
| Minimap | `mod/VSCheatsheetBridge/MinimapReader.cs`, `MinimapOverlay.cs`, `StageMap.cs`, `Plugin.cs`, `RunReader.cs`, `mod/harness/FakeGame.cs`, `MinimapTest.cs`, `StageMapTest.cs`, passende Log-Zeilen |
| Level-up-Noten / Overlay | `EvolutionAdvisor.cs`, `UiOverlay.cs`, `RunSnapshot.cs`, `scripts/export-mod-data.mjs`, `mod/harness/GradingTest.cs` |
| App-Ansicht | die View aus `src/views/`, `src/components/ui.tsx`, `src/i18n/strings.ts`, ggf. `src/data/types.ts` |
| Spieldaten | die JSON-Datei, das Schema aus `src/data/schema/`, `src/data/types.ts`, Wiki-Quelle |
| Fehler im Spiel | `BepInEx/LogOutput.log` (Zeilen des Plugins), Ausgabe von `/debug`, betroffene `.cs`-Datei |
