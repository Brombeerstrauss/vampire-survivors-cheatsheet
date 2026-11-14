import type { EvolutionKind } from '../data/types.ts'
import type { Catalog } from '../logic/catalog.ts'
import type { EvolutionCheck } from '../logic/evolution.ts'

export const KIND_LABEL: Record<EvolutionKind, string> = {
  evolution: 'Entwicklung',
  union: 'Union',
  gift: 'Geschenk',
  morph: 'Morph',
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`
}

/**
 * Was passiert, wenn alle Teile einer Entwicklung im Lauf sind.
 * Der Tracker erfasst keine Stufen; der Text nennt deshalb, was noch auf
 * Maximalstufe gebracht werden muss, bevor die Truhe die Entwicklung bringt.
 */
export function readyText(check: EvolutionCheck, resultName: string, catalog: Catalog): string {
  const { evolution, needsMax } = check
  if (evolution.kind === 'morph') return 'Alles da: passiert automatisch, sobald Relikt und Level erreicht sind.'

  const names = needsMax.map(
    (r) => (r.type === 'weapon' ? catalog.weapon(r.id)?.name : catalog.passive(r.id)?.name) ?? r.id,
  )
  const chest =
    evolution.kind === 'gift'
      ? `kann eine Truhe ${resultName} zusätzlich bringen`
      : `bringt die nächste Truhe mit Entwicklung ${resultName}`
  if (names.length === 0) return `Alles da: Jetzt ${chest}.`
  return `Alles da: Sobald ${listNames(names)} auf Maximalstufe ${names.length === 1 ? 'ist' : 'sind'}, ${chest}.`
}
