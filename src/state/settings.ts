import type { Pack, PackId } from '../data/types.ts'

export interface Settings {
  /** Pakete, die du besitzt. Das Basisspiel ist immer dabei. */
  ownedPacks: PackId[]
  /** Pakete, die die App beim letzten Speichern kannte (um neue kostenlose Pakete automatisch zu aktivieren). */
  knownPacks: PackId[]
  /** Geheime Charaktere anzeigen. */
  showSecrets: boolean
  /** Originalbilder aus dem Wiki anzeigen (sonst Emojis). */
  showImages: boolean
}

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * Liest gespeicherte Einstellungen und ergänzt Standardwerte.
 * Neue Pakete, die beim letzten Mal noch unbekannt waren, sind aktiv, wenn sie kostenlos sind.
 */
export function loadSettings(raw: unknown, packs: Pack[]): Settings {
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ids = new Set(packs.map((p) => p.id))
  const known = Array.isArray(stored.knownPacks) ? stored.knownPacks.filter(isString) : []
  const owned = new Set(Array.isArray(stored.ownedPacks) ? stored.ownedPacks.filter(isString) : [])

  for (const pack of packs) {
    if (pack.kind === 'base') owned.add(pack.id)
    else if (!known.includes(pack.id) && !pack.paid) owned.add(pack.id)
  }

  return {
    ownedPacks: [...owned].filter((id) => ids.has(id)),
    knownPacks: [...ids],
    showSecrets: typeof stored.showSecrets === 'boolean' ? stored.showSecrets : true,
    showImages: typeof stored.showImages === 'boolean' ? stored.showImages : true,
  }
}
