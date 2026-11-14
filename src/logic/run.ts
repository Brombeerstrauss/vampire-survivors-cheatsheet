import { MAX_PASSIVE_SLOTS, MAX_WEAPON_SLOTS } from '../data/types.ts'
import type { CharacterId, Evolution, PassiveId, WeaponId } from '../data/types.ts'
import type { Catalog } from './catalog.ts'

/** Eine Waffe oder ein Gegenstand im aktuellen Lauf, mit Stufe. */
export interface OwnedItem {
  id: string
  level: number
}

/** Der aktuelle Lauf, so wie er im Browser gespeichert wird. */
export interface RunState {
  character: CharacterId | null
  weapons: OwnedItem[]
  passives: OwnedItem[]
}

export const EMPTY_RUN: RunState = { character: null, weapons: [], passives: [] }

export const isRunEmpty = (run: RunState) =>
  run.character === null && run.weapons.length === 0 && run.passives.length === 0

const clampLevel = (level: number, maxLevel: number) => Math.min(Math.max(1, Math.round(level)), maxLevel)

/** Neuer Lauf mit einem Charakter und seinen Startwaffen auf Stufe 1. */
export function startRun(catalog: Catalog, character: CharacterId): RunState {
  const weapons = (catalog.character(character)?.startingWeapons ?? [])
    .filter((id) => catalog.weapon(id))
    .slice(0, MAX_WEAPON_SLOTS)
    .map((id) => ({ id, level: 1 }))
  return { character, weapons, passives: [] }
}

/** Belegte passive Slots (Gegenstände mit `noSlot` zählen nicht). */
export function usedPassiveSlots(run: RunState, catalog: Catalog): number {
  return run.passives.filter((p) => !catalog.passive(p.id)?.noSlot).length
}

export function freeWeaponSlots(run: RunState): number {
  return Math.max(0, MAX_WEAPON_SLOTS - run.weapons.length)
}

export function freePassiveSlots(run: RunState, catalog: Catalog): number {
  return Math.max(0, MAX_PASSIVE_SLOTS - usedPassiveSlots(run, catalog))
}

export function addWeapon(run: RunState, catalog: Catalog, id: WeaponId): RunState {
  if (!catalog.weapon(id) || run.weapons.some((w) => w.id === id)) return run
  if (freeWeaponSlots(run) === 0) return run
  return { ...run, weapons: [...run.weapons, { id, level: 1 }] }
}

export function addPassive(run: RunState, catalog: Catalog, id: PassiveId): RunState {
  const passive = catalog.passive(id)
  if (!passive || run.passives.some((p) => p.id === id)) return run
  if (!passive.noSlot && freePassiveSlots(run, catalog) === 0) return run
  return { ...run, passives: [...run.passives, { id, level: 1 }] }
}

export function removeWeapon(run: RunState, id: WeaponId): RunState {
  return { ...run, weapons: run.weapons.filter((w) => w.id !== id) }
}

export function removePassive(run: RunState, id: PassiveId): RunState {
  return { ...run, passives: run.passives.filter((p) => p.id !== id) }
}

export function setWeaponLevel(run: RunState, catalog: Catalog, id: WeaponId, level: number): RunState {
  const max = catalog.weapon(id)?.maxLevel ?? 1
  return { ...run, weapons: run.weapons.map((w) => (w.id === id ? { ...w, level: clampLevel(level, max) } : w)) }
}

export function setPassiveLevel(run: RunState, catalog: Catalog, id: PassiveId, level: number): RunState {
  const max = catalog.passive(id)?.maxLevel ?? 1
  return { ...run, passives: run.passives.map((p) => (p.id === id ? { ...p, level: clampLevel(level, max) } : p)) }
}

/**
 * Trägt eine erhaltene Entwicklung in den Lauf ein:
 * - Entwicklung und Morph ersetzen die Ausgangswaffe an ihrem Platz
 * - Union ersetzt alle beteiligten Waffen durch eine (gibt Slots frei)
 * - Geschenk kommt zusätzlich dazu
 * Passive Gegenstände bleiben immer erhalten.
 */
export function applyEvolution(run: RunState, catalog: Catalog, evolution: Evolution): RunState {
  const result = catalog.weapon(evolution.result)
  if (!result || run.weapons.some((w) => w.id === result.id)) return run
  const evolved: OwnedItem = { id: result.id, level: result.maxLevel > 1 ? 1 : result.maxLevel }
  const inputs = new Set(evolution.weapons.map((w) => w.id))

  if (evolution.kind === 'gift') {
    return { ...run, weapons: [...run.weapons, evolved] }
  }

  const firstIndex = run.weapons.findIndex((w) => inputs.has(w.id))
  if (firstIndex === -1) return run
  const weapons: OwnedItem[] = []
  run.weapons.forEach((w, index) => {
    if (index === firstIndex) weapons.push(evolved)
    else if (!inputs.has(w.id)) weapons.push(w)
  })
  return { ...run, weapons }
}

/** Prüft gespeicherte Daten und wirft unbekannte oder doppelte Einträge heraus. */
export function sanitizeRun(raw: unknown, catalog: Catalog): RunState {
  if (!raw || typeof raw !== 'object') return EMPTY_RUN
  const value = raw as Partial<Record<keyof RunState, unknown>>
  const items = (list: unknown, max: number, lookup: (id: string) => { maxLevel: number } | undefined) => {
    if (!Array.isArray(list)) return []
    const seen = new Set<string>()
    const result: OwnedItem[] = []
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const { id, level } = item as Partial<OwnedItem>
      const entry = typeof id === 'string' ? lookup(id) : undefined
      if (!entry || seen.has(id!)) continue
      seen.add(id!)
      result.push({ id: id!, level: clampLevel(typeof level === 'number' ? level : 1, entry.maxLevel) })
    }
    return result.slice(0, max)
  }
  const character =
    typeof value.character === 'string' && catalog.character(value.character) ? value.character : null
  return {
    character,
    weapons: items(value.weapons, MAX_WEAPON_SLOTS + 2, catalog.weapon),
    passives: items(value.passives, MAX_PASSIVE_SLOTS + 4, catalog.passive),
  }
}
