# VS Cheatsheet Bridge (prototype)

BepInEx plugin for Vampire Survivors (PC, Steam, Windows). During a run it reads the
character, weapons and passive items of every player and

- shows an **in-game** overlay with the game's own images. Per weapon: the ingredients of the
  next evolution (faded = missing) and the result. The weapon name is red (ingredients
  missing), yellow (everything there, but a level is still missing; below it "Needed to evolve"
  with current/required level), green (ready, next chest) or white (evolved or no
  evolution). At the very bottom a "missing:" line lists all missing ingredients. Labels are
  shown in German or English depending on the `Language` setting.
- Controls: **F8** shows and hides it, the **left mouse button** on the panel moves it (the
  position is saved), **F9** resets it to the default position.
- Co-op: one block per player. Other players' passive items count toward your own
  evolutions and are then tagged with their origin ("P2"). Can be turned off with `ShareCoopPassives`.
- also serves the run locally at `http://127.0.0.1:47321` so the
  cheatsheet app can pick it up.

The names and evolutions in the overlay come from the app's data
(`scripts/export-mod-data.mjs` writes `cheatsheet-data.json` next to the DLL during the build).

The plugin does not change anything in the game. It only reads and only listens on `127.0.0.1`,
so it cannot be reached from outside. Websites in your browser can only read the run if they
are on the `AllowedOrigins` list (by default the published app) or are served by this PC, such
as the app's dev server.

*Prototype: the field names come from community documentation and other mods and have not yet
been confirmed in the game.*

## Requirements

- Vampire Survivors 1.16.x (Unity 6, IL2CPP)
- [BepInEx 6.0.0-be.788](https://builds.bepinex.dev/projects/bepinex_be), package
  `BepInEx-Unity.IL2CPP-win-x64`. Older MelonLoader guides no longer apply since game version
  1.16.
- .NET SDK 6 or newer and Node.js (only for building)

## Installing BepInEx

1. Extract the ZIP into the game folder (where `VampireSurvivors.exe` is).
2. Start the game once. The first start takes a few minutes because BepInEx generates the
   interop files in `BepInEx/interop`. Then close the game.

**Uninstall:** delete `BepInEx/`, `dotnet/`, `winhttp.dll`, `doorstop_config.ini`,
`.doorstop_version` and `changelog.txt` from the game folder.

## Building

Pass the game folder if the game is not in the default Steam library:

```bash
dotnet build mod/VSCheatsheetBridge -c Release -p:GameDir="D:\SteamLibrary\steamapps\common\Vampire Survivors"
```

Alternatively set the environment variable `VS_GAME_DIR`. The build copies the DLL straight to
`BepInEx/plugins/VSCheatsheetBridge/`. While the game is running the DLL is locked, and the build
only reports a warning. Close the game, build again, start the game.

## Testing

Start the game, begin a run, then:

```bash
curl http://127.0.0.1:47321/state
```

| Path | Content |
|---|---|
| `/state` | current run as JSON |
| `/events` | Server-Sent Events: new state on every change |
| `/debug` | field names of the game objects, in case something stays empty after an update |

Example for `/state`:

```json
{"v":1,"plugin":"0.1.0","inRun":true,"time":1731600000000,
 "players":[{"index":0,"character":"ANTONIO",
   "weapons":[{"type":"WHIP","level":3}],
   "passives":[{"type":"MAXHEALTH","level":1}]}]}
```

The names are the game's internal IDs (`WHIP`, `MAXHEALTH` for Hollow Heart). They are listed
in the infobox of every wiki page (field `id`). The app stores them in its data as
`gameIds` (see `tools/wiki-import/game_ids.py`) and uses them to map `MAXHEALTH` to its entry
`hollow-heart`.

Plugin messages are written to `BepInEx/LogOutput.log`.

## Settings

`BepInEx/config/de.cheatsheet.vs.bridge.cfg` (created on the first start with the plugin):

- `Port`: default `47321`
- `AllowedOrigins`: websites that may read the run, separated by commas, default
  `https://brombeerstrauss.github.io` (the published app). Add your own address here if you
  host the app somewhere else. Pages served by this PC (`localhost`) are always allowed.
- `IntervalMs`: how often the run is read, default `500`
- Section `Overlay`: `Language` (`en`/`de`, default `en`), `Visible`, `ToggleKey` (default `F8`), `ResetKey` (default `F9`), `Icons`, position
  `X`/`Y` and `Width` as a fraction of the screen, `Opacity`, `FontScale`, `ShareCoopPassives`
