import type { LocalizedText, PassiveId, WeaponId } from '../data/types.ts'
import type { Catalog } from './catalog.ts'
import { checkEvolution, type EvolutionCheck } from './evolution.ts'
import { freePassiveSlots, freeWeaponSlots, type RunState } from './run.ts'

export type SuggestionSource = 'evolution' | 'pairing' | 'recommendation'

/**
 * Warum etwas vorgeschlagen wird. Die Logik liefert nur Bausteine;
 * die Oberfläche formuliert daraus Sätze in der gewählten Sprache.
 */
export type SuggestionReason =
  | { type: 'missingFor'; result: WeaponId }
  | { type: 'unionPartner'; result: WeaponId }
  | { type: 'pairing'; passive: PassiveId; result: WeaponId }
  | { type: 'recommended'; text: LocalizedText }

export interface Suggestion {
  type: 'weapon' | 'passive'
  id: string
  source: SuggestionSource
  /** Gründe; mehrere, wenn das Teil mehreren Zwecken dient. */
  reasons: SuggestionReason[]
  /** Kleiner = wichtiger. */
  rank: number
}

export type SuggestionWarning =
  /** Ein Gegenstand fehlt für diese Entwicklungen, aber alle passiven Slots sind belegt. */
  | { type: 'passiveSlotsFull'; passive: PassiveId; results: WeaponId[] }
  /** Eine Union-Waffe fehlt, aber alle Waffen-Slots sind belegt. */
  | { type: 'weaponSlotsFull'; weapon: WeaponId; results: WeaponId[] }
  /** Es fehlen mehr Gegenstände, als passive Slots frei sind. */
  | { type: 'notEnoughPassiveSlots'; needed: PassiveId[]; free: number }
  /** Es fehlen mehr Union-Waffen, als Waffen-Slots frei sind. */
  | { type: 'notEnoughWeaponSlots'; needed: WeaponId[]; free: number }

/** Hinweis ohne Alarm: der Gegenstand liegt nur als Fundstück in Stages. */
export interface SuggestionHint {
  type: 'stageOnly'
  passive: PassiveId
}

export interface SuggestionResult {
  suggestions: Suggestion[]
  warnings: SuggestionWarning[]
  hints: SuggestionHint[]
}

const RANK: Record<SuggestionSource, number> = { evolution: 0, pairing: 10, recommendation: 20 }

const sameReason = (a: SuggestionReason, b: SuggestionReason) => JSON.stringify(a) === JSON.stringify(b)

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
  const add = (type: Suggestion['type'], id: string, source: SuggestionSource, reason: SuggestionReason, rank: number) => {
    const key = `${type}:${id}`
    const existing = collected.get(key)
    if (existing) {
      if (!existing.reasons.some((r) => sameReason(r, reason))) existing.reasons.push(reason)
      existing.rank = Math.min(existing.rank, rank)
      if (RANK[source] < RANK[existing.source]) existing.source = source
    } else {
      collected.set(key, { type, id, source, reasons: [reason], rank })
    }
  }

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

  const neededPassives = new Map<string, WeaponId[]>()
  const neededWeapons = new Map<string, WeaponId[]>()
  for (const check of planned) {
    const result = check.evolution.result
    for (const req of check.missing) {
      const target = req.type === 'passive' ? neededPassives : neededWeapons
      const list = target.get(req.id) ?? []
      list.push(result)
      target.set(req.id, list)
      const reason: SuggestionReason =
        check.evolution.kind === 'union' ? { type: 'unionPartner', result } : { type: 'missingFor', result }
      add(req.type, req.id, 'evolution', reason, RANK.evolution)
    }
  }

  // 2. Waffen, die mit vorhandenen Gegenständen eine Entwicklung ergeben
  for (const { id } of run.passives) {
    for (const evo of catalog.evolutionsWithPassive(id)) {
      if (evo.kind !== 'evolution' || evo.weapons.length !== 1) continue
      const weapon = evo.weapons[0]!.id
      if (ownedWeapons.has(weapon) || ownedWeapons.has(evo.result)) continue
      if (!checkEvolution(evo, run, catalog).characterOk) continue
      add('weapon', weapon, 'pairing', { type: 'pairing', passive: id, result: evo.result }, RANK.pairing)
    }
  }

  // 3. Empfehlungen für den Charakter
  if (run.character) {
    for (const rec of catalog.recommendationsFor(run.character)) {
      for (const w of rec.weapons) {
        if (!ownedWeapons.has(w.id))
          add('weapon', w.id, 'recommendation', { type: 'recommended', text: w.reason }, RANK.recommendation + w.priority)
      }
      for (const p of rec.passives) {
        if (!ownedPassives.has(p.id))
          add('passive', p.id, 'recommendation', { type: 'recommended', text: p.reason }, RANK.recommendation + p.priority)
      }
    }
  }

  // Warnungen zu knappen Slots
  const warnings: SuggestionWarning[] = []
  const hints: SuggestionHint[] = []
  const slotNeeded = (id: string) => {
    const passive = catalog.passive(id)
    return !passive?.noSlot && !passive?.ignoresSlotLimit
  }
  const passiveSlotsNeeded = [...neededPassives.keys()].filter(slotNeeded)

  if (passiveSlotsNeeded.length > freePassives) {
    if (freePassives === 0) {
      for (const [id, results] of neededPassives) {
        if (slotNeeded(id)) warnings.push({ type: 'passiveSlotsFull', passive: id, results })
      }
    } else {
      warnings.push({ type: 'notEnoughPassiveSlots', needed: passiveSlotsNeeded, free: freePassives })
    }
  }
  if (neededWeapons.size > freeWeapons) {
    if (freeWeapons === 0) {
      for (const [id, results] of neededWeapons) warnings.push({ type: 'weaponSlotsFull', weapon: id, results })
    } else {
      warnings.push({ type: 'notEnoughWeaponSlots', needed: [...neededWeapons.keys()], free: freeWeapons })
    }
  }
  for (const id of neededPassives.keys()) {
    if (catalog.passive(id)?.stageOnly) hints.push({ type: 'stageOnly', passive: id })
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
