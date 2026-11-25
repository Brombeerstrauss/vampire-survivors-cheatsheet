# Vampire Survivors mod: evolution overlay, level-up grades and minimap

**VS Cheatsheet Bridge** is a free, open-source BepInEx 6 (IL2CPP) mod for Vampire Survivors on
Steam, for Windows and the Steam Deck (Proton). Overview page:
https://brombeerstrauss.github.io/vampire-survivors-cheatsheet/mod/ (German:
[mod/de/](https://brombeerstrauss.github.io/vampire-survivors-cheatsheet/mod/de/)).

During a run it reads the character, weapons and passive items of every player and

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
  left mouse button anywhere on the panel moves it (the position is saved). **F8** switches in
  turn between overlay and minimap, nothing, only the overlay, only the minimap; **F9** resets
  both to the default position; **F7** opens the minimap's menu (see below).
- Co-op: one block per player. Other players' passive items count toward your own
  evolutions and are then tagged with their origin ("P2"). Can be turned off with `ShareCoopPassives`.
- **Level-up grades:** while the level-up screen is open, the overlay lists its choices, best
  first, each with a grade from A+ to D and the main reasons. The ranking follows what decides a
  level-up in the game: evolutions are the biggest power spike, slots are scarce (6 weapons, 6
  items), and an item helps every weapon whose stats it raises.
  1. **Evolution first.** A choice that brings an evolution closer always ranks above choices
     that don't and gets at least an A: a missing ingredient ("for Bloody Tear"), a level a
     weapon needs while all ingredients are there ("max for ..."), or a new weapon whose
     evolution items you already have ("pairs with Bracer"). **A+** if it also fits your
     current build or is recommended for the character.
  2. **Within each group, points** (per check only its best finding counts):
     - *Evolution:* ingredient or max level with all ingredients 3, max level with ingredients
       still missing 2. *Pairing:* evolves with items you have 2, with items your build still
       wants 1.
     - *Character:* the app's recommendation, priority 1/2/3 = 3/2/1.
     - *Build:* a weapon is affected by stats your items raise (the wiki's "Stats and passive
       items" table, the app's `affectedBy`; otherwise the stats its level-ups raise in the
       game's data): 1 per item you have ("uses Bracer, Duplicator"), 0.5 per item your build
       still wants ("fits the build: Spellbinder"), half that for Spinach and Empty Tome,
       because Might and Cooldown affect almost every weapon. An item raises a stat that affects
       your weapons: 1 per weapon you have ("boosts Knife"), 0.5 per recommended weapon. At most
       3. "Your build still wants" means the character's recommended items and the partners for
       your weapons' evolutions, so with few items the plan counts, and the more you have, the
       more your actual build counts. Which stat an item raises comes from the app's data
       (`src/data/stat-items.json`) and the game's data.
     - *Community* tier lists (`src/data/community-tiers.json`): tier 1/2/3 = 2/1.5/1. A weapon
       also counts with the tier of what it evolves into, unless that evolution already counted.
     - *Slots:* a new item that would leave no room for the items your weapons still need for
       their next evolution: -2 ("no room left for Hollow Heart"); a new weapon whose own
       evolution item would find no room: -1; upgrading something you have when that kind has
       at most one slot left: +1 ("no new slot"). Characters with extra slots aren't known yet,
       the check assumes 6.

     From 3 points A, from 2 B, from 1 C, below D.
  3. Where the wiki clearly advises against a choice for the character (the app's "Better
     avoid", e.g. Empty Tome for Babi-Onna, who ignores Cooldown), it gets a D with the reason
     ("avoid: ...") and comes last.

  **D** otherwise means the data knows no fit, which doesn't make it a bad choice. **?** means
  the game offers something the app's data doesn't have yet. Collapsed, the overlay doesn't show
  the grades. Can be turned off with `LevelUpGrades`. The stats are read together with the
  images a few seconds into a run, also when `Icons` is off.
- **Minimap (prototype):** a small map in the top right corner with you in the middle and the
  stage items, relics, chests and other pickups around you, with their own sprites from the game
  (coloured squares if a sprite can't be read: chests gold, relics violet, others blue). Enemies
  are small red dots, bosses have their own sprite and are drawn larger. A faint frame marks the visible screen. Items and bosses beyond the
  map's range sit faded at its edge, so their direction stays visible; enemies there are left out.
  Experience gems are left out too. Like the game's own pause map (relic Milky Way Map), it shows
  no walls or paths. The items come from the game's
  `MapManager.GetAllWorldItems()`, the treasure chests in the scene and, searched every three
  seconds, all other pickups lying in the scene: the items a stage starts with and portals are
  not in that list. Where the pause map has its own symbol for a pickup (e.g. portals), that
  symbol is drawn. The enemies come from the stage's list of spawned enemies. Drag the map with the mouse like the overlay (the position is
  saved), F9 puts both back. F8 shows and hides it (see above). **F7** opens and closes its menu below
  the map (and shows the map if F8 had hidden it). A click on a button (mouse, touch or
  trackpad) changes the setting right away and saves it:
  `Gegner: alle/Bosse/aus` (enemies: all, only bosses, none), `Truhen` (chests), `Relikte/Items`
  (relics and stage items such as weapons, coffins, merchants), `Kleinkram` (small pickups:
  coins, food, rosaries, vacuums... per the game's own list for its pause map, plus a list of
  our own), `Größe -/+` (size), `Reichweite -/+` (range), `Kartenbild` (stage map image, see
  below) and `Position zurücksetzen` (reset the map's position).
- **Stage map image on the minimap:** on stages where the game's pause map shows a picture of
  the stage (e.g. after picking up the stage's map), the minimap shows the part of it around
  you, behind the symbols. Where the world lies on that picture is computed by the game and
  can't be read, so the plugin learns it: open the pause menu's map twice, at places at least
  half a screen apart both left/right and up/down (e.g. once far top left, once far bottom right),
  and stand still for a moment while it is open. Each opening gives one sample: your position and
  where the game puts your marker on the picture. This also works in online co-op, where the game
  keeps running behind the menu; if you move while the map is open, that opening doesn't count.
  In online co-op the minimap follows your own character (the one the camera follows), not
  player 1. The
  samples are saved per picture in `BepInEx/config/de.cheatsheet.vs.bridge.stagemaps.json`, so
  each stage is learned only once; more pauses make it more precise, a wrong sample is left out.
  In the F7 menu the button says `Kartenbild (lernt)` while learning and `Kartenbild (keins)` if
  the stage has no picture (yet). Delete the file to learn again. Section `Minimap` in the
  settings. The minimap shows even without the Milky Way Map relic; turn it off with
  `Enabled = false` if that feels like cheating.
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

## Steam Deck and Linux with Proton

The plugin runs on the Steam Deck: overlay, minimap and stage map image were used there in the
game. Whether every step below fits every setup is not confirmed, and `mod/build-linux.sh` may
still need fixes. The steps assume that Steam runs the Windows version of the game through
Proton, which is the case if the game folder contains `VampireSurvivors.exe`. Then the
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

- The overlay is visible by default, so it needs no key. F7, F8 and F9 need a keyboard, or a
  button bound to these keys in Steam's controller settings (e.g. the back buttons L4, R4, L5). The position can also be set with `X` and
  `Y` in the config file.
- Keys, clicking and dragging use Windows functions (`user32.dll`). Proton provides them, but
  whether they behave the same there is not confirmed. If they fail, the overlay and the server
  keep working and only F8, F9, collapsing and dragging stop. `Collapsed` in the config file
  collapses the overlay without a mouse.
- The app can only take the run from the game in a browser on the same device, because the
  plugin only listens on `127.0.0.1`.

## Testing

Without the game: `mod/harness/` compiles the plugin against stand-ins and tests the minimap
reader and the level-up grades on any PC, see [`harness/README.md`](harness/README.md).

In the game: start it, begin a run, then:

```bash
curl http://127.0.0.1:47321/state
```

| Path | Content |
|---|---|
| `/state` | current run as JSON |
| `/events` | Server-Sent Events: new state on every change |
| `/debug` | field names of the game objects, in case something stays empty after an update (`levelUpPage` and `levelUpItem` appear once a level-up screen was open, `mapManager` and `worldItem` once the minimap found the game's map data, `stage` and `enemy` once it read the enemies) |

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

Testing the minimap: during a run the log should show `[Minimap] MapManager: ...` (the types
found), `[Minimap] found the game's MapManager` and a line like `[Minimap] 12 world items,
1 chests: RELIC 1, ...`. Once there are 20 enemies, once per run: `[Minimap] 85 enemies, 0 bosses:
BAT 60, ...` (the most common enemy types), and `[Minimap] boss on the stage: ...` for each boss.
`[Minimap] small pickups per the game: ...` lists what the game counts as small pickups.
15 seconds into each run: `[Minimap] pickups from the map's list: ...; more in the scene: ...`
(which pickups come from where) and the stage's, pause map's and game manager's members with
names like item, pickup, portal, token or event. If something is still missing on the map, these
lines show where the game keeps it.
Stage map image: `[StageMap] map image <name>@<size>, ...` once the stage has one, then
`[StageMap] shown by image ...` when the pause map is open, `[StageMap] sample 1: world (x, y)
-> image (u, v)` per pause and `[StageMap] ... learned from 2 of 2 samples, largest error ...`.
Warnings with `stagemap:` say where it stops (no image found in the pause map, marker missing). If the map
or the enemies stay empty, these lines and `/debug` show where it stops.

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
- Section `Minimap`: `Enabled` (default on), `Size` (fraction of the screen height, default 0.24),
  position `X`/`Y` (fractions of the screen, default top right), `Range` (from you to the map's
  edge in half screen widths, default 4), `Opacity`, `Enemies` (`all`, `bosses` or `off`, default
  `all`), `Chests`, `Relics`, `Minor` (small pickups; all three default on), `IconSize` (size of
  the symbols as a fraction of the map, default 0.13), `StageMap` (stage
  map image behind the map, default on), `MenuKey` (default
  `F7`), `Visible` (switched with F8), `IntervalMs` (how often it updates, default 200). Size,
  range, position and what the map shows can also be changed in the F7 menu.

Older versions of the plugin wrote `Language = de` or `Language = en` into the config file. Set
it to `auto` if the overlay should follow the game's language.
