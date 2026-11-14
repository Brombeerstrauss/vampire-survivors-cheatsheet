import type {
  Character,
  CharacterId,
  Evolution,
  GameData,
  PackId,
  PassiveId,
  PassiveItem,
  Recommendation,
  Weapon,
  WeaponId,
} from '../data/types.ts'

/**
 * Lookup over the data of the enabled packs.
 * Everything the UI shows comes from here.
 */
export interface Catalog {
  characters: Character[]
  weapons: Weapon[]
  passives: PassiveItem[]
  evolutions: Evolution[]
  character(id: CharacterId): Character | undefined
  weapon(id: WeaponId): Weapon | undefined
  passive(id: PassiveId): PassiveItem | undefined
  /** Evolutions this weapon goes into. */
  evolutionsFromWeapon(id: WeaponId): Evolution[]
  /** Evolutions that need this item. */
  evolutionsWithPassive(id: PassiveId): Evolution[]
  /** Evolutions that result in this weapon. */
  evolutionsToWeapon(id: WeaponId): Evolution[]
  /** Recommendations for a character, merged from all enabled packs. */
  recommendationsFor(id: CharacterId): Recommendation[]
  /** Characters who start with this weapon. */
  charactersStartingWith(id: WeaponId): Character[]
  /** Characters this weapon is recommended for. */
  charactersRecommending(id: WeaponId | PassiveId): Character[]
}

function group<T>(items: T[], keys: (item: T) => string[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    for (const key of new Set(keys(item))) {
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
  }
  return map
}

/**
 * Builds the catalog for the selected packs.
 *
 * Entries from packs that are not enabled are left out. An evolution
 * stays only if its own pack and all weapons, items and characters
 * involved are enabled, so evolutions across DLC boundaries disappear
 * as soon as one of the DLCs involved is missing.
 */
export function createCatalog(data: GameData, ownedPacks: ReadonlySet<PackId>): Catalog {
  const owned = <T extends { source: PackId }>(items: T[]) => items.filter((item) => ownedPacks.has(item.source))

  const characters = owned(data.characters)
  const weapons = owned(data.weapons)
  const passives = owned(data.passives)

  const characterById = new Map(characters.map((c) => [c.id, c]))
  const weaponById = new Map(weapons.map((w) => [w.id, w]))
  const passiveById = new Map(passives.map((p) => [p.id, p]))

  const evolutions = owned(data.evolutions).filter(
    (evo) =>
      weaponById.has(evo.result) &&
      evo.weapons.every((w) => weaponById.has(w.id)) &&
      evo.passives.every((p) => passiveById.has(p.id)) &&
      (evo.characters ?? []).every((c) => characterById.has(c)),
  )

  const recommendations = owned(data.recommendations)
    .filter((rec) => characterById.has(rec.character))
    .map((rec) => ({
      ...rec,
      weapons: rec.weapons.filter((w) => weaponById.has(w.id)),
      passives: rec.passives.filter((p) => passiveById.has(p.id)),
    }))

  const fromWeapon = group(evolutions, (evo) => evo.weapons.map((w) => w.id))
  const withPassive = group(evolutions, (evo) => evo.passives.map((p) => p.id))
  const toWeapon = group(evolutions, (evo) => [evo.result])
  const recsByCharacter = group(recommendations, (rec) => [rec.character])
  const startingWith = group(characters, (c) => c.startingWeapons)
  const recommending = group(recommendations, (rec) => [
    ...rec.weapons.map((w) => w.id),
    ...rec.passives.map((p) => p.id),
  ])

  return {
    characters,
    weapons,
    passives,
    evolutions,
    character: (id) => characterById.get(id),
    weapon: (id) => weaponById.get(id),
    passive: (id) => passiveById.get(id),
    evolutionsFromWeapon: (id) => fromWeapon.get(id) ?? [],
    evolutionsWithPassive: (id) => withPassive.get(id) ?? [],
    evolutionsToWeapon: (id) => toWeapon.get(id) ?? [],
    recommendationsFor: (id) => recsByCharacter.get(id) ?? [],
    charactersStartingWith: (id) => startingWith.get(id) ?? [],
    charactersRecommending: (id) =>
      (recommending.get(id) ?? [])
        .map((rec) => characterById.get(rec.character))
        .filter((c): c is Character => c !== undefined),
  }
}
