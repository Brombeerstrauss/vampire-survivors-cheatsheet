# Vampire Survivors Cheatsheet

Free, unofficial cheat sheet and companion app for **Vampire Survivors**: every evolution, union and DLC weapon, a run tracker and recommendations for every character, plus an optional **in-game mod** (evolution overlay, level-up grades, minimap) for Windows and the Steam Deck. Built as a web app (PWA). It runs in a browser on desktop, tablets and smartphones. You can add it to your device's home screen or install it as an app where your browser supports this; after the first visit, it also works offline.

The app is available in **English and German**. It starts in English; you can switch to German in the settings.

**Open the app:** https://brombeerstrauss.github.io/vampire-survivors-cheatsheet/ · **The mod:** https://brombeerstrauss.github.io/vampire-survivors-cheatsheet/mod/

## Features

- **Characters**: every character from the base game and all DLCs, with search, starting weapon, evolution and recommendations. Secret characters can be hidden. The list can be sorted as in the game or A–Z.
- **Run tracker**: add the weapons and passive items of your current run (6 slots each). For each weapon, the app shows what is still missing for its evolution. Once all parts are there, it tells you what needs max level before the next chest brings the evolution. You don't enter levels. Unions, gifts, morphs and evolutions with several items are covered.
- **Original images**: characters, weapons and items appear with the artwork from the game. The app loads it straight from the wiki and contains no copies itself; you can turn this off in the settings to get emojis instead.
- **Suggestions**: missing evolution partners first, then weapons that pair with your items, then recommendations for the character. Warns when the slots won't be enough for the evolutions you are planning.
- **Weapons and items**: browse everything with description, evolution, origin and matching characters. For weapons also how they work and what triggers them, and which stats boost them, each with the passive item for it. Sorted as in the game or A–Z.
- **DLC filter**: choose the DLCs you own in the settings. Evolutions across DLC boundaries only appear when all the content involved is enabled.
- **Reset** the run with one tap, with an undo button.
- **Mod with in-game overlay** (PC, Steam, optional): the BepInEx plugin in `mod/` shows inside the game what each weapon still needs for its next evolution, grades the choices on the level-up screen from A+ to D for your character and run, shows a small map of the stage items around you (prototype), and can pass the run to the app (settings: "Take the run from the game"). See [`mod/README.md`](mod/README.md).
- **Two languages**: English shows the names and descriptions from the game. German shows the official German names where they exist (see "German names").
- **Version**: the app version, build date and commit are shown in the settings.

Your run and settings are stored in the browser (`localStorage`). There is no server. Data is stored separately in each browser and does not sync between devices.

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

## Install on your device

You can use the app directly in your browser, or add it to your home screen/install it as a web app. The exact option depends on your device and browser:

- **iPhone or iPad:** Open the app in Safari, tap **Share**, then choose **Add to Home Screen**. Confirm by tapping **Add**. The steps and browser support may vary by iOS version.
- **Android phone or tablet:** Open the app in a supported browser such as Chrome. Use the browser menu and choose **Install app** or **Add to Home screen**, then confirm. The wording varies by browser.
- **Desktop:** In a supported browser, look for an install icon in the address bar or an **Install app** option in the browser menu. You can also keep using the app in a regular browser tab.

When launched from the home screen or as an installed app, it may open in its own app window, depending on the browser and device. After the first launch it also works without internet. It picks up new versions automatically when you open it with a connection: it reloads once. The running version is shown at the bottom of the settings.

Runs and settings are stored separately by each browser on each device. They do not automatically sync between your phone, tablet and computer.

## Data

All game data lives as JSON under `src/data/`:

```
src/data/
├── packs.json                 list of packs (base game and DLCs)
├── community-tiers.json       general strength of weapons and items from community tier lists
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

- Every entry has an ID (`id`) made of lowercase letters and hyphens, e.g. `magic-wand`. References between files use these IDs.
- `source` is the ID of the pack and must match the folder name.
- `verified: false` means: not yet reliably checked against the wiki. The app marks these entries as "unverified".
- By default, an evolution needs the weapon at max level, while for items owning them is enough. `"level": "max"` or `"level": "any"` changes this per ingredient. The app only shows this as a hint; levels are not tracked in the run.
- `image` is the URL of the original image on the wiki, `emoji` the placeholder used when the image doesn't load or images are turned off.
- Weapons can have `effects` (how the weapon works and what triggers it: the first paragraphs of the wiki's "Effects" section) and `affectedBy` (the stats that directly affect it, from the wiki's "Stats and passive items" table). `tools/wiki-import/weapon_effects.py` fills both in.
- Texts exist in both languages, e.g. `"description": { "de": "…", "en": "…" }`. This applies to descriptions, bonuses, conditions, notes and recommendations.
- `name` is the English name from the game. `nameDe` is the official German name, `nameDeHint` an own translation for names without an official German name.
- Recommendations from all enabled packs are merged, so a DLC can add recommendations for a base game character.

After every change, `npm test` checks that all files match their schema and that all references point to existing entries.

**Adding a new DLC:** create a folder under `src/data/packs/` with the five files and add the pack to `packs.json`. No code changes are needed.

### Community tiers

`community-tiers.json` rates weapons and passive items independently of the character: tier 1 (strong), 2 (good) or 3 (decent). The mod uses it for its grades on the level-up screen. Each tier is the weighted mean of the community tier lists that rate the entry (S = 5, A = 4, B = 3, C = 2, D = 1, F = 0; at least 4.5 = tier 1, 3.5 = tier 2, 2.5 = tier 3; below that the entry is left out). The sources, with links, dates and weights, are listed in the file itself. As of 18 November 2026:

| Source | As of | Covers | Weight |
|---|---|---|---|
| Rogue Ranker, weapon tier list | March 2026 (game 1.13) | 184 weapons including many DLC weapons | 2 |
| Rogue Ranker, passive items | May 2026 | passive items | 2 |
| Gfinity Esports, weapon tier list | July 2024 | 131 weapons | 1 |
| Choost Games, passive items | July 2026 | 16 passive items | 1 |

The tier lists are opinions and partly older than the current game version; they also contradict each other in places. Choost Games' weapon table was left out because it names several wrong evolution recipes. To change a tier, edit the file; `npm test` checks that every ID exists.

### German names

The official German names and texts come from poncle's [public localisation sheet](https://github.com/Poncle/vampire-survivors-localisation). It dates from 2022 and only covers part of the base game (98 of 613 names); it has nothing for the DLCs. So in German:

- If there is an official German name, it is used: "Peitsche", "Blutige Träne", "Hohlherz".
- Otherwise the English name from the game is shown. If it translates sensibly, an own translation follows in parentheses: "Unearthly Bolt (Überirdischer Blitz)".
- Proper names like "Pako Battiliar" stay without parentheses.

The own translations are in `tools/wiki-import/texts/names_de.py`.

### Images

The artwork from the game belongs to poncle. The app doesn't ship it; it loads it from the wiki at runtime (field `image`). The service worker stores images on the device once they have been shown, so they also appear offline. Images you have never seen are missing offline and replaced by the emoji.

Custom images take precedence: put them in `public/custom-icons/` and add the file name to the matching entry as `"icon"`. Details are in `public/custom-icons/README.md`.

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
| `mod/` | The BepInEx plugin with the in-game overlay; `mod/harness/` tests its logic without the game |

Tech: Vite, React, TypeScript, Tailwind CSS, vite-plugin-pwa (service worker for offline use), Vitest and Ajv for tests. All open source.

## State of the data

As of 14 November 2026. Included are the base game and all eight DLCs released by then: Legacy of the Moonspell, Tides of the Foscari, Emergency Meeting, Operation Guns, Ode to Castlevania, Emerald Diorama, Ante Chamber and Legacy of the Bloodmoon. Together that is 225 characters, 352 weapons, 36 passive items and 165 evolutions.

Every evolution was checked automatically against three pages of the wiki (evolution list, weapon list, item list), and every starting weapon against the character page and the weapon list. Where this was not clear, the entry has `verified: false`:

| Pack | Entry | Reason |
|---|---|---|
| Emerald Diorama | Falconwind | The weapon list requires Skull O'Maniac at max level, the evolution list doesn't |
| Legacy of the Moonspell | Megalo Miang Moonspell, Spiritosa | Starting weapon only named on the character page |
| Legacy of the Bloodmoon | Jaman Jato ★ | Starting weapon only named on the character page |
| Ode to Castlevania | Several characters and weapons | Starting weapon only named on the character page |

More notes:

- The recommendations for the 34 regular base game characters are hand-written. DLC characters get a basic recommendation (starting weapon and the partners for its evolution), which can be extended in `recommendations.json`.
- In addition, 186 recommendations for 75 characters come from the "Tips" sections of the character pages on the wiki, checked by hand: only explicit advice for a weapon or item, not advice that depends on an Arcana or a special setup (`tools/wiki-import/texts/wiki_tips.py`). Three clear warnings appear under "Better avoid" (e.g. Empty Tome for Babi-Onna, who ignores Cooldown).
- English names and descriptions are the original texts from the game (according to the wiki). German descriptions are official texts where poncle's sheet has them, otherwise own translations.
- Special weapons (e.g. the Arcana Gemini counterparts) and Arcanas are not included.
- 339 of 352 weapons have an `effects` text and 281 an `affectedBy` list from the wiki. The German `effects` texts are own translations (`tools/wiki-import/texts/effects_de.py`).
- The community tiers cover 151 weapons and items (13 of them tier 1, 31 tier 2, 107 tier 3). Many character-specific DLC weapons are not rated by any of the tier lists.

## Sources and license

The project has two licenses:

- **Code:** [MIT License](LICENSE). Anyone may use, change and share it.
- **Game data** (`src/data/packs/` and the German texts under `tools/wiki-import/texts/`): [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/), because it comes from the official [Vampire Survivors Wiki](https://vampire.survivors.wiki/). It may only be shared non-commercially, with attribution and under the same license. Details are in [LICENSE-DATA.md](LICENSE-DATA.md).

The code was written with Claude Code, an AI tool by Anthropic.

The images of characters, weapons and items are artwork from the game and belong to poncle. There is no permission from poncle to use them in fan projects, so the app only embeds them from the wiki instead of distributing copies.

Unofficial fan project, not affiliated with poncle. Vampire Survivors is a trademark of poncle.
