import type {
  Character,
  Evolution,
  GameData,
  Pack,
  PassiveItem,
  Recommendation,
  Weapon,
} from './types.ts'

/** Inhalt einer JSON-Datei, wie `import.meta.glob` ihn liefert. */
export type RawFiles = Record<string, unknown>

/** Dateiname (ohne `.json`) und zugleich der Schlüssel mit der Liste darin. */
export const PACK_FILES = ['characters', 'weapons', 'passives', 'evolutions', 'recommendations'] as const
export type PackFile = (typeof PACK_FILES)[number]

export interface LoadResult {
  data: GameData
  /** Probleme beim Einlesen, z. B. Dateien in unbekannten Ordnern. */
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
 * Führt `packs.json` und alle Paket-Dateien zu einem Datensatz zusammen.
 *
 * @param packsFile Inhalt von `packs.json`
 * @param files     Paket-Dateien, Schlüssel = Pfad (`.../packs/<paket>/<datei>.json`)
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

  // Reihenfolge wie in packs.json (Basisspiel zuerst), nicht alphabetisch nach Ordnername
  const packOrder = new Map(packs.map((pack, index) => [pack.id, index]))
  const orderOf = (path: string) => packOrder.get(PATH_PATTERN.exec(path)?.[1] ?? '') ?? packs.length
  const paths = Object.keys(files).sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b))

  for (const path of paths) {
    const match = PATH_PATTERN.exec(path)
    const folder = match?.[1]
    const file = match?.[2] as PackFile | undefined
    if (!folder || !file || !PACK_FILES.includes(file)) {
      problems.push(`${path}: unbekannte Datei, wird ignoriert`)
      continue
    }
    if (!knownPacks.has(folder)) {
      problems.push(`${path}: Ordner "${folder}" fehlt in packs.json`)
    }

    const entries = listOf(files[path], file) as { source?: string }[]
    for (const entry of entries) {
      if (entry.source !== folder) {
        problems.push(`${path}: Eintrag mit source "${entry.source}" liegt im Ordner "${folder}"`)
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
