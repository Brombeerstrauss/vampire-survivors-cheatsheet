import statItems from './stat-items.json'
import type { PassiveId, Stat } from './types.ts'

/**
 * The base game's passive item for each stat, e.g. Area -> Candelabrador. In a JSON file,
 * because the mod's data export (scripts/export-mod-data.mjs) uses it too.
 */
export const STAT_ITEMS: Record<Stat, PassiveId> = statItems

/** The weapon's page on the wiki (via the wiki's search, which jumps straight to the page). */
export function wikiUrl(name: string): string {
  return `https://vampire.survivors.wiki/index.php?title=Special:Search&go=Go&search=${encodeURIComponent(name)}`
}
