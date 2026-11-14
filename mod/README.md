# VS Cheatsheet Bridge (Prototyp)

BepInEx-Plugin für Vampire Survivors (PC, Steam, Windows). Es liest während eines Laufs
Charakter, Waffen und passive Gegenstände aller Spieler aus und

- zeigt **im Spiel** ein Overlay mit den Bildern aus dem Spiel. Pro Waffe: Zutaten der
  nächsten Entwicklung (blass = fehlt) und das Ergebnis. Der Waffenname ist rot (Zutaten
  fehlen), gelb (alles da, aber eine Stufe fehlt noch; darunter "Für Entwicklung" mit
  aktueller/benötigter Stufe), grün (bereit, nächste Truhe) oder weiß (entwickelt oder ohne
  Entwicklung). Ganz unten eine Zeile "fehlt:" mit allen fehlenden Zutaten.
- Bedienung: **F8** blendet ein und aus, **linke Maustaste** auf dem Panel verschiebt es (die
  Position bleibt gespeichert), **F9** setzt es auf die Standardposition zurück.
- Koop: ein Block pro Spieler. Passive Gegenstände der Mitspieler zählen für die eigenen
  Entwicklungen mit und tragen dann ihre Herkunft ("P2"). Abschaltbar mit `ShareCoopPassives`.
- stellt den Lauf zusätzlich lokal unter `http://127.0.0.1:47321` bereit, damit die
  Cheatsheet-App ihn übernehmen kann.

Die Namen und Entwicklungen im Overlay stammen aus den Daten der App
(`scripts/export-mod-data.mjs` erzeugt beim Bauen `cheatsheet-data.json` neben der DLL).

Das Plugin verändert nichts am Spiel. Es liest nur und lauscht nur auf `127.0.0.1`, ist also
von außen nicht erreichbar.

*Prototyp: Die Feldnamen stammen aus Community-Dokumentation und anderen Mods und sind im
Spiel noch nicht bestätigt.*

## Voraussetzungen

- Vampire Survivors 1.16.x (Unity 6, IL2CPP)
- [BepInEx 6.0.0-be.788](https://builds.bepinex.dev/projects/bepinex_be), Paket
  `BepInEx-Unity.IL2CPP-win-x64`. Ältere MelonLoader-Anleitungen gelten seit Spielversion
  1.16 nicht mehr.
- .NET SDK 6 oder neuer und Node.js (nur zum Bauen)

## BepInEx installieren

1. Das ZIP in den Spielordner entpacken (dort, wo `VampireSurvivors.exe` liegt).
2. Das Spiel einmal starten. Der erste Start dauert einige Minuten, weil BepInEx die
   Interop-Dateien in `BepInEx/interop` erzeugt. Danach das Spiel schließen.

**Rückgängig machen:** `BepInEx/`, `dotnet/`, `winhttp.dll`, `doorstop_config.ini`,
`.doorstop_version` und `changelog.txt` aus dem Spielordner löschen.

## Bauen

Den Spielordner angeben, falls das Spiel nicht in der Standard-Steam-Bibliothek liegt:

```bash
dotnet build mod/VSCheatsheetBridge -c Release -p:GameDir="D:\SteamLibrary\steamapps\common\Vampire Survivors"
```

Alternativ die Umgebungsvariable `VS_GAME_DIR` setzen. Der Build kopiert die DLL direkt nach
`BepInEx/plugins/VSCheatsheetBridge/`. Solange das Spiel läuft, ist die DLL gesperrt: Der Build
meldet dann nur eine Warnung. Spiel beenden, erneut bauen, Spiel starten.

## Testen

Spiel starten, einen Lauf beginnen, dann:

```bash
curl http://127.0.0.1:47321/state
```

| Adresse | Inhalt |
|---|---|
| `/state` | aktueller Lauf als JSON |
| `/events` | Server-Sent Events: neuer Stand bei jeder Änderung |
| `/debug` | Feldnamen der Spielobjekte, falls nach einem Update etwas leer bleibt |

Beispiel für `/state`:

```json
{"v":1,"plugin":"0.1.0","inRun":true,"time":1731600000000,
 "players":[{"index":0,"character":"ANTONIO",
   "weapons":[{"type":"WHIP","level":3}],
   "passives":[{"type":"MAXHEALTH","level":1}]}]}
```

Die Namen sind die internen Kennungen des Spiels (`WHIP`, `MAXHEALTH` für Hollow Heart). Sie
stehen im Wiki in der Infobox jeder Seite (Feld `id`). Die App führt sie in ihren Daten als
`gameIds` (siehe `tools/wiki-import/game_ids.py`) und ordnet darüber `MAXHEALTH` ihrem Eintrag
`hollow-heart` zu.

Meldungen des Plugins stehen in `BepInEx/LogOutput.log`.

## Einstellungen

`BepInEx/config/de.cheatsheet.vs.bridge.cfg` (entsteht beim ersten Start mit dem Plugin):

- `Port`: Standard `47321`
- `IntervalMs`: wie oft der Lauf ausgelesen wird, Standard `500`
- Abschnitt `Overlay`: `Language` (`de`/`en`), `Visible`, `ToggleKey` (Standard `F8`), `ResetKey` (Standard `F9`), `Icons`, Position
  `X`/`Y` und `Width` als Anteil des Bildschirms, `Opacity`, `FontScale`, `ShareCoopPassives`
