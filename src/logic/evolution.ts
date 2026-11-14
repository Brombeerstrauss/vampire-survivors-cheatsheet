import type { Evolution, RequiredLevel } from '../data/types.ts'
import type { Catalog } from './catalog.ts'
import type { RunState } from './run.ts'

/** Stand einer einzelnen Zutat: vorhanden, Stufe zu niedrig oder fehlt. */
export type RequirementState = 'ok' | 'level' | 'missing'

export interface RequirementCheck {
  type: 'weapon' | 'passive'
  id: string
  required: RequiredLevel
  state: RequirementState
  /** Aktuelle Stufe im Lauf, falls vorhanden. */
  level?: number
  maxLevel: number
}

export interface EvolutionCheck {
  evolution: Evolution
  requirements: RequirementCheck[]
  /** Passt der gewählte Charakter (nur bei charaktergebundenen Entwicklungen relevant)? */
  characterOk: boolean
  /** Das Ergebnis ist schon im Lauf. */
  done: boolean
  /** Alle Bedingungen erfüllt; die Entwicklung kommt aus der nächsten passenden Truhe (bzw. bei Morphs automatisch). */
  ready: boolean
  /** Zutaten, die noch gar nicht im Lauf sind. */
  missing: RequirementCheck[]
  /** Zutaten, die vorhanden, aber noch nicht auf der nötigen Stufe sind. */
  leveling: RequirementCheck[]
}

function checkRequirement(
  type: 'weapon' | 'passive',
  id: string,
  required: RequiredLevel,
  owned: { id: string; level: number }[],
  maxLevel: number,
): RequirementCheck {
  const item = owned.find((o) => o.id === id)
  if (!item) return { type, id, required, state: 'missing', maxLevel }
  const state = required === 'max' && item.level < maxLevel ? 'level' : 'ok'
  return { type, id, required, state, level: item.level, maxLevel }
}

/** Wie weit ist eine Entwicklung im aktuellen Lauf? */
export function checkEvolution(evolution: Evolution, run: RunState, catalog: Catalog): EvolutionCheck {
  const requirements: RequirementCheck[] = [
    ...evolution.weapons.map((w) =>
      checkRequirement('weapon', w.id, w.level ?? 'max', run.weapons, catalog.weapon(w.id)?.maxLevel ?? 1),
    ),
    ...evolution.passives.map((p) =>
      checkRequirement('passive', p.id, p.level ?? 'any', run.passives, catalog.passive(p.id)?.maxLevel ?? 1),
    ),
  ]
  const characterOk =
    !evolution.characters || (run.character !== null && evolution.characters.includes(run.character))
  const done = run.weapons.some((w) => w.id === evolution.result)
  const missing = requirements.filter((r) => r.state === 'missing')
  const leveling = requirements.filter((r) => r.state === 'level')
  const ready = characterOk && !done && missing.length === 0 && leveling.length === 0
  return { evolution, requirements, characterOk, done, ready, missing, leveling }
}

/**
 * Alle Entwicklungen einer Waffe im Lauf, sortiert nach Fortschritt.
 * Charaktergebundene Entwicklungen anderer Charaktere werden ausgelassen.
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
  return 1 + check.missing.length * 2 + check.leveling.length
}
