// Builds the data for the mod's in-game overlay (mod/VSCheatsheetBridge) from the app's
// game data: names in English and German, max levels, evolutions and the game ID mapping
// (gameIds). That way there is only one data source.
//   node scripts/export-mod-data.mjs <target.json>
// The mod's build runs this script by itself.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2]
if (!target) throw new Error('Usage: node scripts/export-mod-data.mjs <target.json>')

const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
const { packs } = read('src/data/packs.json')
const load = (file, key) => packs.flatMap((p) => read(`src/data/packs/${p.id}/${file}.json`)[key])

const characters = load('characters', 'characters')
const weapons = load('weapons', 'weapons')
const passives = load('passives', 'passives')
const evolutions = load('evolutions', 'evolutions')
const recommendations = load('recommendations', 'recommendations')

const gameIdMap = (entries) => {
  const map = {}
  for (const e of entries) for (const g of e.gameIds ?? []) map[g] ??= e.id
  return map
}
const names = {}
for (const e of [...characters, ...weapons, ...passives]) {
  // g: first game ID, so the plugin can find the in-game image and the game's own name.
  // de: official German name, otherwise our own translation, so the German overlay has no
  // English names in between (the plugin prefers the game's own German name when it can read it).
  names[e.id] = {
    de: e.nameDe ?? e.nameDeHint ?? e.name,
    en: e.name,
    ...(e.maxLevel ? { max: e.maxLevel } : {}),
    ...(e.gameIds?.length ? { g: e.gameIds[0] } : {}),
  }
}

// Character -> weapon or passive item -> priority (1 = core, 2 = good, 3 = optional), for the
// overlay's grades on the level-up screen. Several packs may add to the same character:
// the best priority wins.
const recommended = {}
for (const r of recommendations) {
  const items = (recommended[r.character] ??= {})
  for (const item of [...r.weapons, ...r.passives]) items[item.id] = Math.min(items[item.id] ?? 3, item.priority)
}

const data = {
  characters: gameIdMap(characters),
  weapons: gameIdMap(weapons),
  passives: gameIdMap(passives),
  names,
  evolutions: evolutions.map((e) => ({
    kind: e.kind,
    result: e.result,
    weapons: e.weapons.map((w) => ({ id: w.id, max: (w.level ?? 'max') === 'max' })),
    passives: e.passives.map((p) => ({ id: p.id, max: p.level === 'max' })),
    ...(e.characters ? { characters: e.characters } : {}),
  })),
  recommendations: recommended,
}

writeFileSync(target, JSON.stringify(data))
console.log(
  `Mod data: ${evolutions.length} evolutions, ${Object.keys(names).length} names, ` +
    `recommendations for ${Object.keys(recommended).length} characters -> ${target}`,
)
