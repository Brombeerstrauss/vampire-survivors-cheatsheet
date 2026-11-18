/**
 * Data model of the app.
 *
 * All game data lives as JSON under `src/data/packs/<pack>/`.
 * The matching JSON schemas are in `src/data/schema/`; the tests check the
 * data against them. If you change a field here, update the schema
 * as well.
 *
 * IDs (`id`) are lowercase with hyphens, e.g. `magic-wand`.
 * `name` is the English name from the game. Every text exists in German
 * and English (`LocalizedText`).
 */

/** App languages. */
export type Lang = 'de' | 'en'

/** A text in both languages. */
export interface LocalizedText {
  de: string
  en: string
}

export type PackId = string
export type CharacterId = string
export type WeaponId = string
export type PassiveId = string
export type EvolutionId = string

/** A content pack: the base game or a DLC. Listed in `packs.json`. */
export interface Pack {
  /** Matches the folder name under `packs/`; the base game is `base`. */
  id: PackId
  name: LocalizedText
  kind: 'base' | 'dlc'
  /** Paid? Free content is preselected in the DLC filter. */
  paid: boolean
  /** Release date, `YYYY-MM-DD`. */
  released?: string
  verified: boolean
}

/** Fields shared by characters, weapons and passive items. */
interface Entry {
  id: string
  /**
   * The game's internal IDs from the wiki infobox (field `id`), e.g. `MAGIC_MISSILE`
   * for Magic Wand. Usually exactly one; the app uses them to match data from the mod.
   */
  gameIds?: string[]
  /** English name as in the game. */
  name: string
  /** Official German name from the game, if it differs from the English one. */
  nameDe?: string
  /**
   * Own German translation when there is no official German name.
   * In German, the app shows it in parentheses after the English name.
   */
  nameDeHint?: string
  /** Pack the entry comes from (`base` or a DLC ID). */
  source: PackId
  /** `false` until the entry has been reliably checked against the wiki. */
  verified: boolean
  /** Placeholder emoji, shown when there is no custom icon or image. */
  emoji?: string
  /** File name of a custom icon in `public/custom-icons/` (takes precedence over `image`). */
  icon?: string
  /** URL of the original image on the wiki; loaded at runtime, not shipped with the app. */
  image?: string
  /** How to unlock the entry. */
  unlock?: string
  /** Free-form note, e.g. why something is still unverified. */
  note?: LocalizedText
}

export interface Character extends Entry {
  /** Usually exactly one weapon; some characters start with none or several. */
  startingWeapons: WeaponId[]
  /** The character's special trait in one sentence, e.g. a bonus per level. */
  bonus: LocalizedText
  /** Secret character; can be hidden with the spoiler switch. */
  secret: boolean
}

/** Character stats as the wiki names them (Might, Area, Amount ...). */
export type Stat =
  | 'might'
  | 'area'
  | 'speed'
  | 'duration'
  | 'amount'
  | 'cooldown'
  | 'luck'
  | 'maxHealth'
  | 'recovery'
  | 'armor'
  | 'moveSpeed'
  | 'magnet'
  | 'growth'
  | 'greed'
  | 'curse'
  | 'revival'

export interface Weapon extends Entry {
  /** `evolved` = result of an evolution, union or gift. */
  kind: 'base' | 'evolved'
  description: LocalizedText
  /** How the weapon works and what triggers it (from the wiki's "Effects" section). */
  effects?: LocalizedText
  /** Stats that directly affect the weapon (wiki table "Stats and passive items"). */
  affectedBy?: Stat[]
  /** Maximum level (base weapons usually 8, evolved ones usually 1). */
  maxLevel: number
  /** Only these characters can use the weapon; without this field, anyone can. */
  exclusiveTo?: CharacterId[]
}

export interface PassiveItem extends Entry {
  description: LocalizedText
  maxLevel: number
  /** Only found as a pickup in stages, never offered on level-up. */
  stageOnly?: boolean
  /** Does not take one of the 6 passive slots (e.g. gifts from DLCs). */
  noSlot?: boolean
  /** Takes a slot but can be picked even when all slots are full (e.g. Mini Crewmates). */
  ignoresSlotLimit?: boolean
}

/** Level an ingredient needs: max level or any. */
export type RequiredLevel = 'max' | 'any'

export interface WeaponRequirement {
  id: WeaponId
  /** Default: `max`. */
  level?: RequiredLevel
}

export interface PassiveRequirement {
  id: PassiveId
  /** Default: `any` (owning the item is enough). */
  level?: RequiredLevel
  /** The item is used up by the evolution (e.g. Weapon Power-Up). */
  consumed?: boolean
}

/**
 * How an evolution works:
 * - `evolution`: the weapon is replaced by the result (from a chest)
 * - `union`: several weapons merge into one (frees weapon slots)
 * - `gift`: the base weapon stays and the result is added
 * - `morph`: only for certain characters; happens automatically once the
 *   relic and level are reached, without a chest
 */
export type EvolutionKind = 'evolution' | 'union' | 'gift' | 'morph'

export interface Evolution {
  id: EvolutionId
  kind: EvolutionKind
  /** Pack that introduces this evolution. Its ingredients may come from other packs. */
  source: PackId
  /** The evolved weapon (an entry with `kind: "evolved"`). */
  result: WeaponId
  /** Required weapons: one for evolutions, several for unions. */
  weapons: WeaponRequirement[]
  /** Required passive items; may be empty. */
  passives: PassiveRequirement[]
  /** Only possible with these characters (e.g. morphs). Without this field, it applies to everyone. */
  characters?: CharacterId[]
  /** Further conditions as text, e.g. a relic or a minimum level. */
  conditions?: LocalizedText[]
  verified: boolean
  note?: LocalizedText
}

export interface RecommendedItem<Id extends string = string> {
  id: Id
  /** Short reason, e.g. synergy with the character's bonus. */
  reason: LocalizedText
  /** 1 = core of the build, 2 = good addition, 3 = optional. */
  priority: 1 | 2 | 3
}

/** Curated recommendation for a character. Several packs may add to the same character. */
export interface Recommendation {
  character: CharacterId
  /** Pack this recommendation comes from. */
  source: PackId
  /** Play style in one or two sentences. */
  summary?: LocalizedText
  weapons: RecommendedItem<WeaponId>[]
  passives: RecommendedItem<PassiveId>[]
  /** Weapons or items the wiki clearly advises against for this character. */
  avoid?: AvoidedItem[]
}

/** A weapon or item to avoid for a character, with the reason. */
export interface AvoidedItem {
  id: WeaponId | PassiveId
  reason: LocalizedText
}

/** All packs merged, as the app uses them. */
export interface GameData {
  packs: Pack[]
  characters: Character[]
  weapons: Weapon[]
  passives: PassiveItem[]
  evolutions: Evolution[]
  recommendations: Recommendation[]
}

/** Slot limits in the game. */
export const MAX_WEAPON_SLOTS = 6
export const MAX_PASSIVE_SLOTS = 6
