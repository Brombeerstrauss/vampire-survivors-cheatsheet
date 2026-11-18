# VS Cheatsheet Bridge (prototype)

BepInEx plugin for Vampire Survivors (PC, Steam, Windows). During a run it reads the
character, weapons and passive items of every player and

- shows an **in-game** overlay with the game's own images. Per weapon: the ingredients of the
  next evolution (faded = missing) and the result. The weapon name is red (ingredients
  missing), yellow (everything there, but a level is still missing; below it "Needed to evolve"
  with current/required level), green (ready, next chest) or white (evolved or no
  evolution). If the evolved weapon can evolve again (e.g. a union with it), a faded "then:"
  line shows that step too, up to two steps ahead; steps with content from DLCs that are not
  installed are left out. At the very bottom a "missing:" line lists all missing ingredients.
- Language: by default the overlay follows the game's language (German or English). Weapon and
  item names then come from the game itself, exactly as it shows them. If the game's texts
  can't be read, the names come from the app's data: in German the official name or the app's
  own translation.
- Width: the panel grows by itself for long names; names that are still too long wrap.
- Controls: a **click on the title bar** (`[-] Evolutions`) collapses the overlay to that bar
  and expands it again; collapsed, it shows how many evolutions are ready. **Dragging** with the
  left mouse button anywhere on the panel moves it (the position is saved). **F8** shows and
  hides it, **F9** resets it to the default position.
- Co-op: one block per player. Other players' passive items count toward your own
  evolutions and are then tagged with their origin ("P2"). Can be turned off with `ShareCoopPassives`.
- **Level-up grades:** while the level-up screen is open, the overlay lists its choices in the
  game's order, each with a grade from A (best fit) to D and a short reason. Each choice gets
  the best grade of these checks; with equal grades the reason of the earlier check is shown:
  1. **Evolutions** of your weapons: a missing ingredient (A, "for Bloody Tear"); your weapon
     or item still needs max level (A if all ingredients are there, otherwise B, "max for ...").
  2. **Pairing:** a new weapon that evolves with items you already have (B, "pairs with ...").
  3. **Character:** the app's recommendation, priority 1/2/3 = A/B/C ("recommended"). Only the
     34 regular base game characters have hand-written recommendations; DLC characters have
     their starting weapon and its evolution partners.
  4. **Stats** from the game's own weapon data: an item raises area, amount, duration or speed
     of two or more of your weapons (B) or one (C, "boosts Knife"); a weapon scales with two or
     more of your items (B) or one (C, "uses Duplicator"). A weapon scales with a stat when its
     level-ups raise it. Might and cooldown help every weapon and are left to the next check.
  5. **Community** tier lists (`src/data/community-tiers.json`): tier 1/2/3 = A/B/C. A weapon
     also counts with the tier of what it evolves into ("community: Holy Wand").

  **D** means none of these apply: the data knows no fit, which doesn't make it a bad choice.
  **?** means the game offers something the app's data doesn't have yet. Collapsed, the
  overlay doesn't show the grades. Can be turned off with `LevelUpGrades`. The stats are read
  together with the images a few seconds into a run, also when `Icons` is off.
- also serves the run locally at `http://127.0.0.1:47321` so the
  cheatsheet app can pick it up.

The names and evolutions in the overlay come from the app's data
(`scripts/export-mod-data.mjs` writes `cheatsheet-data.json` next to the DLL during the build).

The plugin does not change anything in the game. It only reads and only listens on `127.0.0.1`,
so it cannot be reached from outside. Websites in your browser can only read the run if they
are on the `AllowedOrigins` list (by default the published app) or are served by this PC, such
as the app's dev server.

*Prototype: the field names come from community documentation and other mods and have not yet
been confirmed in the game. This applies above all to the level-up screen (`LevelUpPage`,
`LevelUpItemUI`), whose names come from the decompiled code used by the mods
[VSEvolutionHelperEx](https://github.com/n3rdyguy/VSEvolutionHelperEx) and
[jev_vampire_survivors](https://github.com/oldmoldycake/jev_vampire_survivors).*

## Requirements

- Vampire Survivors 1.16.x (Unity 6, IL2CPP)
- [BepInEx 6.0.0-be.788](https://builds.bepinex.dev/projects/bepinex_be), package
  `BepInEx-Unity.IL2CPP-win-x64`. Older MelonLoader guides no longer apply since game version
  1.16.
- .NET SDK 6 or newer and Node.js (only if you build the plugin yourself; on Linux the build
  script downloads them if they are missing)

## Installing BepInEx

1. Extract the ZIP into the game folder (where `VampireSurvivors.exe` is).
2. Start the game once. The first start takes a few minutes because BepInEx generates the
   interop files in `BepInEx/interop`. Then close the game.

**Uninstall:** delete `BepInEx/`, `dotnet/`, `winhttp.dll`, `doorstop_config.ini`,
`.doorstop_version` and `changelog.txt` from the game folder.

## Installing the plugin from a release

No build tools needed. Releases are on the project's
[Releases page](https://github.com/Brombeerstrauss/vampire-survivors-cheatsheet/releases).

1. Download `VSCheatsheetBridge-<version>.zip` from the newest release. Its notes say which
   game version it was built for.
2. Close the game and extract the ZIP into the game folder (where `VampireSurvivors.exe` is).
   The files land in `BepInEx/plugins/VSCheatsheetBridge/`.
3. Start the game and begin a run.

**Update:** extract the new ZIP over the old files. **Remove the plugin only:** delete the
folder `BepInEx/plugins/VSCheatsheetBridge/`.

If there is no release for your game version, build the plugin yourself as described below.

## Building

On Linux and the Steam Deck, use the build script, see "Building on Linux or the Steam Deck"
below. On Windows, pass the game folder if the game is not in the default Steam library:

```bash
dotnet build mod/VSCheatsheetBridge -c Release -p:GameDir="D:\SteamLibrary\steamapps\common\Vampire Survivors"
```

Alternatively set the environment variable `VS_GAME_DIR`. The build copies the DLL straight to
`BepInEx/plugins/VSCheatsheetBridge/`. While the game is running the DLL is locked, and the build
only reports a warning. Close the game, build again, start the game.

### Building on Linux or the Steam Deck

`mod/build-linux.sh` builds the plugin on Linux, for example on the Steam Deck itself, and
copies it into the game. No Windows PC is needed. It has not been run on a Steam Deck yet.

1. Set up the game first: steps 1 to 4 under "Steam Deck and Linux with Proton" (BepInEx
   installed, launch option set, game started once).
2. Download the project from GitHub (Code → Download ZIP) and extract it, for example into
   `Downloads`.
3. Open a terminal (on the Steam Deck in Desktop Mode: Konsole) and run:

   ```bash
   cd ~/Downloads/vampire-survivors-cheatsheet-main
   bash mod/build-linux.sh
   ```

The script finds the game in your Steam libraries, also on an SD card. Otherwise pass the game
folder: `bash mod/build-linux.sh "/path/to/Vampire Survivors"`. Before building it checks that
BepInEx is set up and says what is missing.

It needs an internet connection. If the .NET SDK or Node.js are not installed, it downloads them
into `~/.cache/vs-cheatsheet-build`: the .NET SDK with Microsoft's install script, Node.js from
nodejs.org, checked against its published checksum. Together with the build's caches this takes
about 1 GB. .NET telemetry is turned off. Nothing is installed system-wide: delete that folder
to remove all of it.

At the end the plugin is in the game and the release ZIP in `mod/release/`.

### Making a release

The build needs files from a game installation, so GitHub cannot build the plugin by itself.
A release is built on a PC with the game and uploaded by hand:

1. Set the new version in `<Version>` in `VSCheatsheetBridge.csproj`. The plugin and the name
   of the ZIP take it from there.
2. Build with `-c Release` as shown above, or with `mod/build-linux.sh` on Linux. Besides
   copying the plugin into the game, this writes `mod/release/VSCheatsheetBridge-<version>.zip`.
3. Start the game and check that the overlay works.
4. On GitHub, open Releases → Draft a new release. Create the tag `mod-v<version>`, upload the
   ZIP, name the game version in the notes and publish.

## Steam Deck and Linux with Proton (untested)

Nobody has tried this yet. The steps assume that Steam runs the Windows version of the game
through Proton, which is the case if the game folder contains `VampireSurvivors.exe`. Then the
same `win-x64` BepInEx package and the same plugin files are used as on Windows.

1. On the Steam Deck, switch to Desktop Mode. In Steam, right-click the game → Manage → Browse
   local files to open the game folder.
2. Extract the BepInEx ZIP into the game folder, as on Windows.
3. Let Proton load BepInEx: right-click the game → Properties → General → Launch Options, and
   enter `WINEDLLOVERRIDES="winhttp=n,b" %command%`
4. Start the game once and wait for BepInEx to generate the interop files, then close it.
5. Install the plugin in one of these ways:
   - Extract the release ZIP into the game folder, see "Installing the plugin from a release".
   - Build it on the Deck itself with `mod/build-linux.sh`, see "Building on Linux or the Steam
     Deck".
   - Build it on a Windows PC and copy the folder `BepInEx/plugins/VSCheatsheetBridge/` to the
     same place in the game folder on the Deck. Use the same game version on both devices,
     because the plugin is built against the game's files.

Things to know:

- The overlay is visible by default, so it needs no key. F8 and F9 need a keyboard, or a button
  bound to these keys in Steam's controller settings. The position can also be set with `X` and
  `Y` in the config file.
- Keys, clicking and dragging use Windows functions (`user32.dll`). Proton provides them, but
  whether they behave the same there is not confirmed. If they fail, the overlay and the server
  keep working and only F8, F9, collapsing and dragging stop. `Collapsed` in the config file
  collapses the overlay without a mouse.
- The app can only take the run from the game in a browser on the same device, because the
  plugin only listens on `127.0.0.1`.

## Testing

Start the game, begin a run, then:

```bash
curl http://127.0.0.1:47321/state
```

| Path | Content |
|---|---|
| `/state` | current run as JSON |
| `/events` | Server-Sent Events: new state on every change |
| `/debug` | field names of the game objects, in case something stays empty after an update (`levelUpPage` and `levelUpItem` appear once a level-up screen was open) |

Example for `/state`:

```json
{"v":1,"plugin":"0.6.0","inRun":true,"time":1731600000000,
 "players":[{"index":0,"character":"ANTONIO",
   "weapons":[{"type":"WHIP","level":3}],
   "passives":[{"type":"MAXHEALTH","level":1}]}]}
```

While the level-up screen is open, the player it belongs to also has `"offers":["POWER","GARLIC"]`:
the weapons and items on its cards. The first three level-ups of a game session are also
written to the log (`[LevelUp] P1 offered: ...`).

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
- Section `Overlay`: `Language` (`auto` = like the game, `de` or `en`; default `auto`), `Visible`,
  `Collapsed` (only the title bar), `ToggleKey` (default `F8`), `ResetKey` (default `F9`), `Icons`,
  position `X`/`Y` and `Width` as a fraction of the screen (the width grows by itself for long
  names, up to 0.26), `Opacity`, `FontScale`, `ShareCoopPassives`, `LevelUpGrades` (grades on the
  level-up screen, default on)

Older versions of the plugin wrote `Language = de` or `Language = en` into the config file. Set
it to `auto` if the overlay should follow the game's language.
