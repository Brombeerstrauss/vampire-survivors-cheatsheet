import type { Catalog } from './catalog.ts'
import { checkEvolution, type EvolutionCheck } from './evolution.ts'
import { freePassiveSlots, freeWeaponSlots, type RunState } from './run.ts'

export type SuggestionSource = 'evolution' | 'pairing' | 'recommendation'

export interface Suggestion {
  type: 'weapon' | 'passive'
  id: string
  source: SuggestionSource
  /** Kurze Begründungen; mehrere, wenn das Teil mehreren Zwecken dient. */
  reasons: string[]
  /** Kleiner = wichtiger. */
  rank: number
}

export interface SuggestionResult {
  suggestions: Suggestion[]
  warnings: string[]
  /** Hinweise ohne Alarm, z. B. dass ein Gegenstand nur in der Stage liegt. */
  hints: string[]
}

const RANK: Record<SuggestionSource, number> = { evolution: 0, pairing: 10, recommendation: 20 }

/**
 * Was sollte als Nächstes in den Lauf?
 *
 * 1. Fehlende Partner für Entwicklungen der Waffen, die du schon hast
 * 2. Waffen, die sich mit deinen vorhandenen Gegenständen entwickeln
 * 3. Empfehlungen für den gewählten Charakter
 *
 * Vorschläge, für die kein Slot mehr frei ist, fallen weg; stattdessen gibt es
 * eine Warnung, wenn geplante Entwicklungen dadurch unmöglich werden.
 */
export function suggestNext(run: RunState, catalog: Catalog): SuggestionResult {
  const ownedWeapons = new Set(run.weapons.map((w) => w.id))
  const ownedPassives = new Set(run.passives.map((p) => p.id))
  const freeWeapons = freeWeaponSlots(run)
  const freePassives = freePassiveSlots(run, catalog)

  const collected = new Map<string, Suggestion>()
  const add = (type: Suggestion['type'], id: string, source: SuggestionSource, reason: string, rank: number) => {
    const key = `${type}:${id}`
    const existing = collected.get(key)
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason)
      existing.rank = Math.min(existing.rank, rank)
      if (RANK[source] < RANK[existing.source]) existing.source = source
    } else {
      collected.set(key, { type, id, source, reasons: [reason], rank })
    }
  }

  const weaponName = (id: string) => catalog.weapon(id)?.name ?? id
  const passiveName = (id: string) => catalog.passive(id)?.name ?? id

  // 1. Geplante Entwicklungen: alles, was aus vorhandenen Waffen entstehen kann
  const planned: EvolutionCheck[] = []
  const seenEvolutions = new Set<string>()
  for (const { id } of run.weapons) {
    for (const evo of catalog.evolutionsFromWeapon(id)) {
      if (seenEvolutions.has(evo.id)) continue
      seenEvolutions.add(evo.id)
      const check = checkEvolution(evo, run, catalog)
      if (!check.characterOk || check.done) continue
      planned.push(check)
    }
  }

  const neededPassives = new Map<string, string[]>()
  const neededWeapons = new Map<string, string[]>()
  for (const check of planned) {
    const result = weaponName(check.evolution.result)
    for (const req of check.missing) {
      const target = req.type === 'passive' ? neededPassives : neededWeapons
      const list = target.get(req.id) ?? []
      list.push(result)
      target.set(req.id, list)
      const verb = check.evolution.kind === 'union' ? 'Union-Partner für' : 'Fehlt für'
      add(req.type, req.id, 'evolution', `${verb} ${result}`, RANK.evolution)
    }
  }

  // 2. Waffen, die mit vorhandenen Gegenständen eine Entwicklung ergeben
  for (const { id } of run.passives) {
    for (const evo of catalog.evolutionsWithPassive(id)) {
      if (evo.kind !== 'evolution' || evo.weapons.length !== 1) continue
      const weapon = evo.weapons[0]!.id
      if (ownedWeapons.has(weapon) || ownedWeapons.has(evo.result)) continue
      if (!checkEvolution(evo, run, catalog).characterOk) continue
      add('weapon', weapon, 'pairing', `Entwickelt sich mit ${passiveName(id)} zu ${weaponName(evo.result)}`, RANK.pairing)
    }
  }

  // 3. Empfehlungen für den Charakter
  if (run.character) {
    for (const rec of catalog.recommendationsFor(run.character)) {
      for (const w of rec.weapons) {
        if (!ownedWeapons.has(w.id)) add('weapon', w.id, 'recommendation', w.reason, RANK.recommendation + w.priority)
      }
      for (const p of rec.passives) {
        if (!ownedPassives.has(p.id)) add('passive', p.id, 'recommendation', p.reason, RANK.recommendation + p.priority)
      }
    }
  }

  // Warnungen zu knappen Slots
  const warnings: string[] = []
  const hints: string[] = []
  const slotNeeded = (id: string) => !catalog.passive(id)?.noSlot
  const passiveSlotsNeeded = [...neededPassives.keys()].filter(slotNeeded)

  if (passiveSlotsNeeded.length > freePassives) {
    if (freePassives === 0) {
      for (const [id, results] of neededPassives) {
        if (!slotNeeded(id)) continue
        warnings.push(
          `${results.join(', ')}: ${passiveName(id)} fehlt, aber alle passiven Slots sind belegt.`,
        )
      }
    } else {
      warnings.push(
        `Für alle geplanten Entwicklungen fehlen ${passiveSlotsNeeded.length} passive Gegenstände, ` +
          `aber nur ${freePassives} ${freePassives === 1 ? 'Slot ist' : 'Slots sind'} frei. ` +
          `Benötigt: ${passiveSlotsNeeded.map(passiveName).join(', ')}.`,
      )
    }
  }
  if (neededWeapons.size > freeWeapons) {
    if (freeWeapons === 0) {
      for (const [id, results] of neededWeapons) {
        warnings.push(`${results.join(', ')}: ${weaponName(id)} fehlt, aber alle Waffen-Slots sind belegt.`)
      }
    } else {
      warnings.push(
        `Für alle geplanten Unions fehlen ${neededWeapons.size} Waffen, ` +
          `aber nur ${freeWeapons} ${freeWeapons === 1 ? 'Slot ist' : 'Slots sind'} frei.`,
      )
    }
  }
  for (const id of neededPassives.keys()) {
    if (catalog.passive(id)?.stageOnly) {
      hints.push(`${passiveName(id)} gibt es nicht beim Level-up, nur als Fundstück in bestimmten Stages.`)
    }
  }

  // Waffen, die im Lauf schon zu etwas anderem entwickelt wurden, nicht noch einmal vorschlagen
  const alreadyEvolved = (id: string) =>
    catalog.evolutionsFromWeapon(id).some((e) => e.kind !== 'gift' && ownedWeapons.has(e.result))

  const suggestions = [...collected.values()]
    .filter((s) => !(s.type === 'weapon' && (ownedWeapons.has(s.id) || alreadyEvolved(s.id))))
    .filter((s) => !(s.type === 'passive' && ownedPassives.has(s.id)))
    .filter((s) => (s.type === 'weapon' ? freeWeapons > 0 : freePassives > 0 || !slotNeeded(s.id)))
    .sort((a, b) => a.rank - b.rank || b.reasons.length - a.reasons.length)

  return { suggestions, warnings, hints }
}
