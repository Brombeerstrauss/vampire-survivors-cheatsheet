// Erzeugt die Daten für das In-Game-Overlay des Mods (mod/VSCheatsheetBridge) aus den
// Spieldaten der App: Namen auf Deutsch und Englisch, Maximalstufen, Entwicklungen und die
// Zuordnung der Spielkennungen (gameIds). So gibt es nur eine Datenquelle.
//   node scripts/export-mod-data.mjs <ziel.json>
// Der Build des Mods ruft das Skript selbst auf.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2]
if (!target) throw new Error('Aufruf: node scripts/export-mod-data.mjs <ziel.json>')

const read = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
const { packs } = read('src/data/packs.json')
const load = (file, key) => packs.flatMap((p) => read(`src/data/packs/${p.id}/${file}.json`)[key])

const characters = load('characters', 'characters')
const weapons = load('weapons', 'weapons')
const passives = load('passives', 'passives')
const evolutions = load('evolutions', 'evolutions')

const gameIdMap = (entries) => {
  const map = {}
  for (const e of entries) for (const g of e.gameIds ?? []) map[g] ??= e.id
  return map
}
const names = {}
for (const e of [...characters, ...weapons, ...passives]) {
  // g: erste Spielkennung, damit das Plugin das Bild aus dem Spiel findet
  names[e.id] = {
    de: e.nameDe ?? e.name,
    en: e.name,
    ...(e.maxLevel ? { max: e.maxLevel } : {}),
    ...(e.gameIds?.length ? { g: e.gameIds[0] } : {}),
  }
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
}

writeFileSync(target, JSON.stringify(data))
console.log(`Mod-Daten: ${evolutions.length} Entwicklungen, ${Object.keys(names).length} Namen -> ${target}`)
