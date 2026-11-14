# Vampire Survivors Cheatsheet

Unofficial companion app for **Vampire Survivors**, built as a web app (PWA). It runs in the
browser on desktop and on the iPhone, can be added to the home screen and then works offline.

The app is available in **English and German**. It starts in English; you can switch to
German in the settings.

**Open the app:** https://brombeerstrauss.github.io/vampire-survivors-cheatsheet/

## Features

- **Characters**: every character from the base game and all DLCs, with search, starting
  weapon, evolution and recommendations. Secret characters can be hidden.
- **Run tracker**: add the weapons and passive items of your current run (6 slots each). For
  each weapon, the app shows what is still missing for its evolution. Once all parts are
  there, it tells you what needs max level before the next chest brings the evolution. You
  don't enter levels. Unions, gifts, morphs and evolutions with several items are covered.
- **Original images**: characters, weapons and items appear with the artwork from the game.
  The app loads it straight from the wiki and contains no copies itself; you can turn this
  off in the settings to get emojis instead.
- **Suggestions**: missing evolution partners first, then weapons that pair with your items,
  then recommendations for the character. Warns when the slots won't be enough for the
  evolutions you are planning.
- **Weapons and items**: browse everything with description, evolution, origin and matching
  characters.
- **DLC filter**: choose the DLCs you own in the settings. Evolutions across DLC boundaries
  only appear when all the content involved is enabled.
- **Reset** the run with one tap, with an undo button.
- **Two languages**: English shows the names and descriptions from the game. German shows the
  official German names where they exist (see "German names").
- **Version**: the app version, build date and commit are shown in the settings.

Your run and settings are stored in the browser (`localStorage`). There is no server.

## Run locally

You need [Node.js](https://nodejs.org/) 22.12 or newer (LTS recommended).

```bash
npm install
```

```bash
npm run dev
```

The app then runs at http://localhost:5173. Other commands:

| Command | Purpose |
|---|---|
| `npm test` | Tests: evolution logic, plus all JSON files checked against schema and references |
| `npm run build` | Build the finished app into `dist` |
| `npm run preview` | Serve the build from `dist` locally |
| `npm run lint` | Check the code for common mistakes |
| `npm run icons` | Regenerate the app icons from `public/logo.svg` |


## Install on the iPhone

1. Open the app's address in **Safari** (depending on the iOS version, other iPhone browsers
   can't always add web apps to the home screen).
2. Tap the **Share** icon (square with an arrow pointing up).
3. Scroll down and choose **"Add to Home Screen"**.
4. Confirm the name and tap **"Add"**.

The app then starts from the home screen in full screen, without Safari's toolbars. After the
first launch it also works without internet. It picks up new versions automatically when you
open it with a connection: it reloads once. The running version is shown at the bottom of the
settings.

Runs and settings are per device: your iPhone and your computer each have their own run.

## Data

All game data lives as JSON under `src/data/`:

```
src/data/
├── packs.json                 list of packs (base game and DLCs)
├── packs/<pack>/
│   ├── characters.json        characters
│   ├── weapons.json           base and evolved weapons
│   ├── passives.json          passive items
│   ├── evolutions.json        evolutions, unions, gifts, morphs
│   └── recommendations.json   recommendations per character
├── schema/                    JSON schemas for all files
└── types.ts                   TypeScript types (with a description of every field)
```

Key rules:

- Every entry has an ID (`id`) made of lowercase letters and hyphens, e.g. `magic-wand`.
  References between files use these IDs.
- `source` is the ID of the pack and must match the folder name.
- `verified: false` means: not yet reliably checked against the wiki. The app marks these
  entries as "unverified".
- By default, an evolution needs the weapon at max level, while for items owning them is
  enough. `"level": "max"` or `"level": "any"` changes this per ingredient. The app only
  shows this as a hint; levels are not tracked in the run.
- `image` is the URL of the original image on the wiki, `emoji` the placeholder used when the
  image doesn't load or images are turned off.
- Texts exist in both languages, e.g. `"description": { "de": "…", "en": "…" }`. This applies
  to descriptions, bonuses, conditions, notes and recommendations.
- `name` is the English name from the game. `nameDe` is the official German name,
  `nameDeHint` an own translation for names without an official German name.
- Recommendations from all enabled packs are merged, so a DLC can add recommendations for a
  base game character.

After every change, `npm test` checks that all files match their schema and that all
references point to existing entries.

**Adding a new DLC:** create a folder under `src/data/packs/` with the five files and add the
pack to `packs.json`. No code changes are needed.

### German names

The official German names and texts come from poncle's
[public localisation sheet](https://github.com/Poncle/vampire-survivors-localisation). It dates
from 2022 and only covers part of the base game (98 of 613 names); it has nothing for the
DLCs. So in German:

- If there is an official German name, it is used: "Peitsche", "Blutige Träne", "Hohlherz".
- Otherwise the English name from the game is shown. If it translates sensibly, an own
  translation follows in parentheses: "Unearthly Bolt (Überirdischer Blitz)".
- Proper names like "Pako Battiliar" stay without parentheses.

The own translations are in `tools/wiki-import/texts/names_de.py`.

### Images

The artwork from the game belongs to poncle. The app doesn't ship it; it loads it from the
wiki at runtime (field `image`). The service worker stores images on the device once they
have been shown, so they also appear offline. Images you have never seen are missing offline
and replaced by the emoji.

Custom images take precedence: put them in `public/custom-icons/` and add the file name to the
matching entry as `"icon"`. Details are in `public/custom-icons/README.md`.

## Project structure

| Folder | Contents |
|---|---|
| `src/data/` | Game data, schemas, types, loader and data checks |
| `src/logic/` | Evolution logic, run, suggestions (no UI, with tests) |
| `src/state/` | Stored state, settings, navigation |
| `src/i18n/` | UI texts in English and German, name display |
| `src/components/` | Reusable UI building blocks |
| `src/views/` | The four views: characters, run, weapons, settings |
| `tools/wiki-import/` | The tool that generated the game data from the wiki |

Tech: Vite, React, TypeScript, Tailwind CSS, vite-plugin-pwa (service worker for offline
use), Vitest and Ajv for tests. All open source.

## State of the data

As of 14 November 2026. Included are the base game and all eight DLCs released by then:
Legacy of the Moonspell, Tides of the Foscari, Emergency Meeting, Operation Guns, Ode to
Castlevania, Emerald Diorama, Ante Chamber and Legacy of the Bloodmoon. Together that is 225
characters, 352 weapons, 36 passive items and 165 evolutions.

Every evolution was checked automatically against three pages of the wiki (evolution list,
weapon list, item list), and every starting weapon against the character page and the weapon
list. Where this was not clear, the entry has `verified: false`:

| Pack | Entry | Reason |
|---|---|---|
| Emerald Diorama | Falconwind | The weapon list requires Skull O'Maniac at max level, the evolution list doesn't |
| Legacy of the Moonspell | Megalo Miang Moonspell, Spiritosa | Starting weapon only named on the character page |
| Legacy of the Bloodmoon | Jaman Jato ★ | Starting weapon only named on the character page |
| Ode to Castlevania | Jonathan & Charlotte, Charlotte & Jonathan, Stella & Loretta Lecarde, Loretta & Stella Lecarde, Brauner, Dmitrii Blinov, Stone Skull, Astarte, Fake Trio, Megalo Elizabeth Bartley | Starting weapon only named on the character page |

More notes:

- The recommendations for the 34 regular base game characters are hand-written. DLC
  characters get a basic recommendation (starting weapon and the partners for its evolution),
  which can be extended in `recommendations.json`.
- English names and descriptions are the original texts from the game (according to the
  wiki). German descriptions are official texts where poncle's sheet has them, otherwise own
  translations.
- Special weapons (e.g. the Arcana Gemini counterparts) and Arcanas are not included.

## Sources and license

The project has two licenses:

- **Code:** [MIT License](LICENSE). Anyone may use, change and share it.
- **Game data** (`src/data/packs/` and the German texts under `tools/wiki-import/texts/`):
  [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/), because it comes from
  the official [Vampire Survivors Wiki](https://vampire.survivors.wiki/). It may only be shared
  non-commercially, with attribution and under the same license. Details are in
  [LICENSE-DATA.md](LICENSE-DATA.md).

The code was written with Claude Code, an AI tool by Anthropic.

The images of characters, weapons and items are artwork from the game and belong to poncle.
There is no permission from poncle to use them in fan projects, so the app only embeds them
from the wiki instead of distributing copies.

Unofficial fan project, not affiliated with poncle. Vampire Survivors is a trademark of
poncle.
