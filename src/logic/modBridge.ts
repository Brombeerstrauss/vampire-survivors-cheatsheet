import type { GameData } from '../data/types.ts'
import type { RunState } from './run.ts'

/**
 * Anbindung an das BepInEx-Plugin unter `mod/`: Es meldet den laufenden Lauf über
 * http://127.0.0.1:47321 mit den internen Kennungen des Spiels (z. B. MAGIC_MISSILE).
 * Hier werden diese Meldungen geprüft und in den Lauf der App übersetzt.
 */
export const MOD_PORT = 47321
export const MOD_URL = `http://127.0.0.1:${MOD_PORT}`

export interface ModItem {
  /** Kennung des Spiels, z. B. MAGIC_MISSILE oder MAXHEALTH. */
  type: string
  level: number
}

export interface ModPlayer {
  index: number
  character: string | null
  weapons: ModItem[]
  passives: ModItem[]
}

export interface ModSnapshot {
  inRun: boolean
  players: ModPlayer[]
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'

function parseItems(raw: unknown): ModItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!isObject(item) || typeof item.type !== 'string') return []
    const level = typeof item.level === 'number' && Number.isFinite(item.level) ? Math.max(0, Math.round(item.level)) : 0
    return [{ type: item.type, level }]
  })
}

/** Prüft eine Meldung des Plugins; `null`, wenn sie nicht zum Format Version 1 passt. */
export function parseSnapshot(raw: unknown): ModSnapshot | null {
  if (!isObject(raw) || raw.v !== 1 || !Array.isArray(raw.players)) return null
  const players = raw.players.flatMap((p, i): ModPlayer[] => {
    if (!isObject(p)) return []
    return [
      {
        index: typeof p.index === 'number' ? p.index : i,
        character: typeof p.character === 'string' ? p.character : null,
        weapons: parseItems(p.weapons),
        passives: parseItems(p.passives),
      },
    ]
  })
  return { inRun: raw.inRun === true, players }
}

export interface GameIdIndex {
  characters: ReadonlyMap<string, string>
  weapons: ReadonlyMap<string, string>
  passives: ReadonlyMap<string, string>
}

/** Spielkennung -> Kennung der App, je Art. Nutzt `gameIds` aus den Daten. */
export function buildGameIdIndex(data: Pick<GameData, 'characters' | 'weapons' | 'passives'>): GameIdIndex {
  const index = (entries: { id: string; gameIds?: string[] }[]) => {
    const map = new Map<string, string>()
    for (const entry of entries) for (const gameId of entry.gameIds ?? []) if (!map.has(gameId)) map.set(gameId, entry.id)
    return map
  }
  return { characters: index(data.characters), weapons: index(data.weapons), passives: index(data.passives) }
}

/** Stufen aus dem Spiel, Schlüssel `weapon:<id>` bzw. `passive:<id>`. */
export type LiveLevels = Readonly<Record<string, number>>

export const levelKey = (type: 'weapon' | 'passive', id: string) => `${type}:${id}`

export interface LiveRun {
  run: RunState
  levels: LiveLevels
  /** Kennungen aus dem Spiel, die die App nicht kennt (z. B. versteckte Waffen). */
  unknown: string[]
}

/**
 * Übersetzt einen Spieler aus dem Spiel in einen Lauf der App. Das Spiel ist hier die
 * Wahrheit: Slot-Grenzen werden nicht nachgeprüft, nur Doppeltes fällt weg.
 */
export function liveRunFromPlayer(player: ModPlayer, index: GameIdIndex): LiveRun {
  const levels: Record<string, number> = {}
  const unknown: string[] = []
  const collect = (items: ModItem[], map: ReadonlyMap<string, string>, type: 'weapon' | 'passive') => {
    const ids: { id: string }[] = []
    for (const item of items) {
      const id = map.get(item.type)
      if (!id) {
        unknown.push(item.type)
        continue
      }
      if (ids.some((owned) => owned.id === id)) continue
      ids.push({ id })
      levels[levelKey(type, id)] = item.level
    }
    return ids
  }
  const character = player.character ? (index.characters.get(player.character) ?? null) : null
  if (player.character && !character) unknown.push(player.character)
  return {
    run: {
      character,
      weapons: collect(player.weapons, index.weapons, 'weapon'),
      passives: collect(player.passives, index.passives, 'passive'),
    },
    levels,
    unknown,
  }
}

/** Gleicher Inhalt? Vermeidet unnötige Speicher- und Renderdurchläufe bei jeder Meldung. */
export function sameRun(a: RunState, b: RunState): boolean {
  const ids = (items: { id: string }[]) => items.map((i) => i.id).join(',')
  return a.character === b.character && ids(a.weapons) === ids(b.weapons) && ids(a.passives) === ids(b.passives)
}
