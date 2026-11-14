import type { Evolution, RequiredLevel } from '../data/types.ts'
import type { Catalog } from './catalog.ts'
import type { RunState } from './run.ts'

export interface RequirementCheck {
  type: 'weapon' | 'passive'
  id: string
  /** Does the ingredient need max level? Only a hint; the tracker does not record levels. */
  required: RequiredLevel
  /** Is the ingredient in the run? */
  owned: boolean
}

export interface EvolutionCheck {
  evolution: Evolution
  requirements: RequirementCheck[]
  /** Does the selected character fit (only relevant for character-bound evolutions)? */
  characterOk: boolean
  /** The result is already in the run. */
  done: boolean
  /** All ingredients are there; at most the max level is still missing (see `needsMax`). */
  ready: boolean
  /** Ingredients that are not in the run yet. */
  missing: RequirementCheck[]
  /** Ingredients that must be at max level for the evolution. */
  needsMax: RequirementCheck[]
}

/** How far along is an evolution in the current run? */
export function checkEvolution(evolution: Evolution, run: RunState, catalog: Catalog): EvolutionCheck {
  const ownedWeapons = new Set(run.weapons.map((w) => w.id))
  const ownedPassives = new Set(run.passives.map((p) => p.id))
  const requirements: RequirementCheck[] = [
    ...evolution.weapons.map((w) => ({
      type: 'weapon' as const,
      id: w.id,
      required: (w.level ?? 'max') as RequiredLevel,
      owned: ownedWeapons.has(w.id),
    })),
    ...evolution.passives.map((p) => ({
      type: 'passive' as const,
      id: p.id,
      required: (p.level ?? 'any') as RequiredLevel,
      owned: ownedPassives.has(p.id),
    })),
  ]
  const maxLevelOf = (r: RequirementCheck) =>
    (r.type === 'weapon' ? catalog.weapon(r.id)?.maxLevel : catalog.passive(r.id)?.maxLevel) ?? 1
  const characterOk =
    !evolution.characters || (run.character !== null && evolution.characters.includes(run.character))
  const done = ownedWeapons.has(evolution.result)
  const missing = requirements.filter((r) => !r.owned)
  const needsMax = requirements.filter((r) => r.required === 'max' && maxLevelOf(r) > 1)
  const ready = characterOk && !done && missing.length === 0
  return { evolution, requirements, characterOk, done, ready, missing, needsMax }
}

/**
 * All evolutions of a weapon in the run, ready ones first.
 * Evolutions bound to other characters are left out.
 */
export function evolutionsForOwnedWeapon(weaponId: string, run: RunState, catalog: Catalog): EvolutionCheck[] {
  return catalog
    .evolutionsFromWeapon(weaponId)
    .map((evo) => checkEvolution(evo, run, catalog))
    .filter((check) => check.characterOk)
    .sort((a, b) => score(a) - score(b))
}

function score(check: EvolutionCheck): number {
  if (check.done) return 100
  if (check.ready) return 0
  return 1 + check.missing.length
}
