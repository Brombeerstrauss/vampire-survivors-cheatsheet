import type { Evolution, EvolutionKind } from '../data/types.ts'

export const KIND_LABEL: Record<EvolutionKind, string> = {
  evolution: 'Entwicklung',
  union: 'Union',
  gift: 'Geschenk',
  morph: 'Morph',
}

/** Wie man die Entwicklung bekommt, wenn alles bereit ist. */
export function readyText(evolution: Evolution, resultName: string): string {
  switch (evolution.kind) {
    case 'gift':
      return `Bereit: Eine Truhe kann ${resultName} zusätzlich bringen.`
    case 'morph':
      return `Passiert automatisch, sobald Relikt und Level erreicht sind.`
    default:
      return `Bereit: Die nächste Truhe mit Entwicklung bringt ${resultName}.`
  }
}
