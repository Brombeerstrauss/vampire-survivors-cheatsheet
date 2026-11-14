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
 * Nachschlagewerk über die Daten der freigeschalteten Pakete.
 * Alles, was die Oberfläche anzeigt, kommt von hier.
 */
export interface Catalog {
  characters: Character[]
  weapons: Weapon[]
  passives: PassiveItem[]
  evolutions: Evolution[]
  character(id: CharacterId): Character | undefined
  weapon(id: WeaponId): Weapon | undefined
  passive(id: PassiveId): PassiveItem | undefined
  /** Entwicklungen, in die diese Waffe eingeht. */
  evolutionsFromWeapon(id: WeaponId): Evolution[]
  /** Entwicklungen, die diesen Gegenstand brauchen. */
  evolutionsWithPassive(id: PassiveId): Evolution[]
  /** Entwicklungen, die diese Waffe ergeben. */
  evolutionsToWeapon(id: WeaponId): Evolution[]
  /** Empfehlungen für einen Charakter, aus allen freigeschalteten Paketen zusammengeführt. */
  recommendationsFor(id: CharacterId): Recommendation[]
  /** Charaktere, die mit dieser Waffe starten. */
  charactersStartingWith(id: WeaponId): Character[]
  /** Charaktere, denen diese Waffe empfohlen wird. */
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
 * Baut den Katalog für die gewählten Pakete.
 *
 * Einträge aus nicht freigeschalteten Paketen fallen weg. Eine Entwicklung
 * bleibt nur, wenn ihr eigenes Paket und alle beteiligten Waffen, Gegenstände
 * und Charaktere freigeschaltet sind; so verschwinden Entwicklungen über
 * DLC-Grenzen hinweg, sobald ein beteiligtes DLC fehlt.
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
