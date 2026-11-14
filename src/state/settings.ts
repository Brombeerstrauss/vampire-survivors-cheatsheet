import type { Lang, Pack, PackId } from '../data/types.ts'

export interface Settings {
  /** Packs you own. The base game is always included. */
  ownedPacks: PackId[]
  /** Packs the app knew when it last saved (to enable new free packs automatically). */
  knownPacks: PackId[]
  /** Show secret characters. */
  showSecrets: boolean
  /** Show original images from the wiki (otherwise emojis). */
  showImages: boolean
  /** App language. */
  language: Lang
  /** Did the user pick the language in the settings? Until then the app uses English. */
  languageChosen: boolean
  /** Take the run live from the game (BepInEx plugin in `mod/`). */
  modBridge: boolean
}

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * Reads stored settings and fills in defaults.
 * New packs that were unknown last time are enabled if they are free.
 * The language defaults to English. A stored language only counts if the user picked it;
 * earlier versions stored the device language automatically.
 */
export function loadSettings(raw: unknown, packs: Pack[]): Settings {
  const stored = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const ids = new Set(packs.map((p) => p.id))
  const known = Array.isArray(stored.knownPacks) ? stored.knownPacks.filter(isString) : []
  const owned = new Set(Array.isArray(stored.ownedPacks) ? stored.ownedPacks.filter(isString) : [])
  const chosen = stored.languageChosen === true

  for (const pack of packs) {
    if (pack.kind === 'base') owned.add(pack.id)
    else if (!known.includes(pack.id) && !pack.paid) owned.add(pack.id)
  }

  return {
    ownedPacks: [...owned].filter((id) => ids.has(id)),
    knownPacks: [...ids],
    showSecrets: typeof stored.showSecrets === 'boolean' ? stored.showSecrets : true,
    showImages: typeof stored.showImages === 'boolean' ? stored.showImages : true,
    language: chosen && (stored.language === 'de' || stored.language === 'en') ? stored.language : 'en',
    languageChosen: chosen,
    modBridge: stored.modBridge === true,
  }
}
