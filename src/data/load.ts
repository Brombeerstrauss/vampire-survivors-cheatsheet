import type {
  Character,
  Evolution,
  GameData,
  Pack,
  PassiveItem,
  Recommendation,
  Weapon,
} from './types.ts'

/** Contents of a JSON file, as `import.meta.glob` returns it. */
export type RawFiles = Record<string, unknown>

/** File name (without `.json`), which is also the key of the list inside. */
export const PACK_FILES = ['characters', 'weapons', 'passives', 'evolutions', 'recommendations'] as const
export type PackFile = (typeof PACK_FILES)[number]

export interface LoadResult {
  data: GameData
  /** Problems while loading, e.g. files in unknown folders. */
  problems: string[]
}

const PATH_PATTERN = /packs\/([^/]+)\/([^/]+)\.json$/

function listOf(raw: unknown, key: string): unknown[] {
  if (raw && typeof raw === 'object' && key in raw) {
    const list = (raw as Record<string, unknown>)[key]
    if (Array.isArray(list)) return list
  }
  return []
}

/**
 * Merges `packs.json` and all pack files into one data set.
 *
 * @param packsFile contents of `packs.json`
 * @param files     pack files, key = path (`.../packs/<pack>/<file>.json`)
 */
export function loadGameData(packsFile: unknown, files: RawFiles): LoadResult {
  const problems: string[] = []
  const packs = listOf(packsFile, 'packs') as Pack[]
  const knownPacks = new Set(packs.map((pack) => pack.id))

  const data: GameData = {
    packs,
    characters: [],
    weapons: [],
    passives: [],
    evolutions: [],
    recommendations: [],
  }

  // Order as in packs.json (base game first), not alphabetical by folder name
  const packOrder = new Map(packs.map((pack, index) => [pack.id, index]))
  const orderOf = (path: string) => packOrder.get(PATH_PATTERN.exec(path)?.[1] ?? '') ?? packs.length
  const paths = Object.keys(files).sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b))

  for (const path of paths) {
    const match = PATH_PATTERN.exec(path)
    const folder = match?.[1]
    const file = match?.[2] as PackFile | undefined
    if (!folder || !file || !PACK_FILES.includes(file)) {
      problems.push(`${path}: unknown file, ignored`)
      continue
    }
    if (!knownPacks.has(folder)) {
      problems.push(`${path}: folder "${folder}" is missing from packs.json`)
    }

    const entries = listOf(files[path], file) as { source?: string }[]
    for (const entry of entries) {
      if (entry.source !== folder) {
        problems.push(`${path}: entry with source "${entry.source}" is in folder "${folder}"`)
      }
    }

    switch (file) {
      case 'characters':
        data.characters.push(...(entries as Character[]))
        break
      case 'weapons':
        data.weapons.push(...(entries as Weapon[]))
        break
      case 'passives':
        data.passives.push(...(entries as PassiveItem[]))
        break
      case 'evolutions':
        data.evolutions.push(...(entries as Evolution[]))
        break
      case 'recommendations':
        data.recommendations.push(...(entries as Recommendation[]))
        break
    }
  }

  return { data, problems }
}
