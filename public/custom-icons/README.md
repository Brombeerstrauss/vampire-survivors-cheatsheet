# Custom icons

The app shows the original images from the game, but loads them from the wiki and contains no
copies itself. You can put your own images here; they take precedence over the wiki images.

How to:

1. Put the image in this folder, e.g. `whip.png` (square, 64×64 to 128×128 pixels is enough;
   `.png`, `.webp`, `.svg`, `.jpg` and `.gif` are allowed).
2. In the matching JSON entry under `src/data/packs/<pack>/`, set the `icon` field:

   ```json
   { "id": "whip", "name": "Whip", "icon": "whip.png" }
   ```

3. Rebuild the app or reload the page.

Which image appears: first `icon` (this folder), then `image` (wiki), then the emoji from the
`emoji` field. If an image doesn't load, the next one is used automatically.

Subfolders are allowed (`"icon": "weapons/whip.png"`).

Please only use images you made yourself or are allowed to use.

Note: the import tool (`tools/wiki-import/run.sh`) rewrites the JSON files and removes any
`icon` fields added by hand.
