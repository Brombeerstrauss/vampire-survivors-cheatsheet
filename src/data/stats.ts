import type { PassiveId, Stat } from './types.ts'

/** The base game's passive item for each stat, e.g. Area -> Candelabrador. */
export const STAT_ITEMS: Record<Stat, PassiveId> = {
  might: 'spinach',
  area: 'candelabrador',
  speed: 'bracer',
  duration: 'spellbinder',
  amount: 'duplicator',
  cooldown: 'empty-tome',
  luck: 'clover',
  maxHealth: 'hollow-heart',
  recovery: 'pummarola',
  armor: 'armor',
  moveSpeed: 'wings',
  magnet: 'attractorb',
  growth: 'crown',
  greed: 'stone-mask',
  curse: 'skull-o-maniac',
  revival: 'tirajisu',
}

/** The weapon's page on the wiki (via the wiki's search, which jumps straight to the page). */
export function wikiUrl(name: string): string {
  return `https://vampire.survivors.wiki/index.php?title=Special:Search&go=Go&search=${encodeURIComponent(name)}`
}
