import type { Evolution, RequiredLevel } from '../data/types.ts'
import type { Catalog } from './catalog.ts'
import type { RunState } from './run.ts'

export interface RequirementCheck {
  type: 'weapon' | 'passive'
  id: string
  /** Muss die Zutat auf Maximalstufe sein? Nur als Hinweis, der Tracker erfasst keine Stufen. */
  required: RequiredLevel
  /** Ist die Zutat im Lauf? */
  owned: boolean
}

export interface EvolutionCheck {
  evolution: Evolution
  requirements: RequirementCheck[]
  /** Passt der gewählte Charakter (nur bei charaktergebundenen Entwicklungen relevant)? */
  characterOk: boolean
  /** Das Ergebnis ist schon im Lauf. */
  done: boolean
  /** Alle Zutaten sind da; es fehlt höchstens noch die Maximalstufe (siehe `needsMax`). */
  ready: boolean
  /** Zutaten, die noch nicht im Lauf sind. */
  missing: RequirementCheck[]
  /** Zutaten, die für die Entwicklung auf Maximalstufe sein müssen. */
  needsMax: RequirementCheck[]
}

/** Wie weit ist eine Entwicklung im aktuellen Lauf? */
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
 * Alle Entwicklungen einer Waffe im Lauf, die bereiten zuerst.
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
  return 1 + check.missing.length
}
