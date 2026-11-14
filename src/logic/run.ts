import { MAX_PASSIVE_SLOTS, MAX_WEAPON_SLOTS } from '../data/types.ts'
import type { CharacterId, Evolution, PassiveId, WeaponId } from '../data/types.ts'
import type { Catalog } from './catalog.ts'

/**
 * A weapon or item in the current run.
 * Levels are deliberately not tracked: the tracker only remembers what you have.
 */
export interface OwnedItem {
  id: string
}

/** The current run, as stored in the browser. */
export interface RunState {
  character: CharacterId | null
  weapons: OwnedItem[]
  passives: OwnedItem[]
}

export const EMPTY_RUN: RunState = { character: null, weapons: [], passives: [] }

export const isRunEmpty = (run: RunState) =>
  run.character === null && run.weapons.length === 0 && run.passives.length === 0

/** New run with a character and their starting weapons. */
export function startRun(catalog: Catalog, character: CharacterId): RunState {
  const weapons = (catalog.character(character)?.startingWeapons ?? [])
    .filter((id) => catalog.weapon(id))
    .slice(0, MAX_WEAPON_SLOTS)
    .map((id) => ({ id }))
  return { character, weapons, passives: [] }
}

/** Used passive slots (items with `noSlot` don't count). */
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
  return { ...run, weapons: [...run.weapons, { id }] }
}

export function addPassive(run: RunState, catalog: Catalog, id: PassiveId): RunState {
  const passive = catalog.passive(id)
  if (!passive || run.passives.some((p) => p.id === id)) return run
  if (!passive.noSlot && !passive.ignoresSlotLimit && freePassiveSlots(run, catalog) === 0) return run
  return { ...run, passives: [...run.passives, { id }] }
}

/** Can this item still be added right now? */
export function canAddPassive(run: RunState, catalog: Catalog, id: PassiveId): boolean {
  return addPassive(run, catalog, id) !== run
}

export function removeWeapon(run: RunState, id: WeaponId): RunState {
  return { ...run, weapons: run.weapons.filter((w) => w.id !== id) }
}

export function removePassive(run: RunState, id: PassiveId): RunState {
  return { ...run, passives: run.passives.filter((p) => p.id !== id) }
}

/**
 * Records an evolution you received in the run:
 * - evolution and morph replace the base weapon in its slot
 * - union replaces all weapons involved with one (frees slots)
 * - gift is added on top
 * Passive items stay unless they are used up (`consumed`).
 */
export function applyEvolution(run: RunState, catalog: Catalog, evolution: Evolution): RunState {
  const result = catalog.weapon(evolution.result)
  if (!result || run.weapons.some((w) => w.id === result.id)) return run
  const evolved: OwnedItem = { id: result.id }
  const inputs = new Set(evolution.weapons.map((w) => w.id))
  const consumed = new Set(evolution.passives.filter((p) => p.consumed).map((p) => p.id))
  const passives = consumed.size > 0 ? run.passives.filter((p) => !consumed.has(p.id)) : run.passives

  if (evolution.kind === 'gift') {
    return { ...run, weapons: [...run.weapons, evolved], passives }
  }

  const firstIndex = run.weapons.findIndex((w) => inputs.has(w.id))
  if (firstIndex === -1) return run
  const weapons: OwnedItem[] = []
  run.weapons.forEach((w, index) => {
    if (index === firstIndex) weapons.push(evolved)
    else if (!inputs.has(w.id)) weapons.push(w)
  })
  return { ...run, weapons, passives }
}

/**
 * Checks stored data and drops unknown or duplicate entries.
 * Older saves with levels are kept without the levels.
 */
export function sanitizeRun(raw: unknown, catalog: Catalog): RunState {
  if (!raw || typeof raw !== 'object') return EMPTY_RUN
  const value = raw as Partial<Record<keyof RunState, unknown>>
  const items = (list: unknown, max: number, exists: (id: string) => unknown) => {
    if (!Array.isArray(list)) return []
    const seen = new Set<string>()
    const result: OwnedItem[] = []
    for (const item of list) {
      const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined
      if (typeof id !== 'string' || !exists(id) || seen.has(id)) continue
      seen.add(id)
      result.push({ id })
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
