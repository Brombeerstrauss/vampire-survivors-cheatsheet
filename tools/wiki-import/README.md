# Wiki import

The tool that generated the game data under `src/data/packs/` from the
[Vampire Survivors Wiki](https://vampire.survivors.wiki/). You don't need it for normal
changes to the data: the JSON files can be edited directly.

It is useful when the wiki has been updated or a new DLC comes out:

```bash
bash tools/wiki-import/run.sh
```

The script downloads the wiki pages, parses the tables and rewrites all packs.
**Manual changes to the generated JSON files are lost**, so commit first and compare with
`git diff` afterwards.

- `texts/de_<code>.py`: German descriptions, placeholder emojis and special rules per pack.
  New wiki entries without German text are reported as `WARN` and left out.
- `texts/en_texts.py`: English versions of the texts written for this project
  (recommendations, conditions, notes).
- `texts/names_de.py`: own German translations for names without an official German name.
- `parse_localisation.py`: reads the official German names from poncle's public
  localisation sheet, which the script downloads fresh on every run.
- `game_ids.py`: adds `gameIds` to characters, weapons and items: the game's internal IDs
  from the infobox of each wiki page (field `id`, e.g. `MAGIC_MISSILE` for Magic Wand). The app
  uses them to match data from the mod in `mod/`. Runs at the end of `run.sh`, but also works on
  its own without losing manual edits. An entry the wiki gives no ID for keeps the IDs it has:
  `python3 -I tools/wiki-import/game_ids.py https://vampire.survivors.wiki/api.php src/data/packs`
- `build_pack.py`: only sets `verified` when the evolution list, weapon list and item list
  agree; differences go into the `note` field.

Requirements: `python3` (included with macOS) and `curl`.
