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
- `build_pack.py`: only sets `verified` when the evolution list, weapon list and item list
  agree; differences go into the `note` field.

Requirements: `python3` (included with macOS) and `curl`.
