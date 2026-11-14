import type { GameData } from './types.ts'

/**
 * Checks that the data is consistent: unique IDs and no references
 * to missing entries. Returns a list of readable problems (empty = all good).
 */
export function checkIntegrity(data: GameData): string[] {
  const problems: string[] = []

  const idsOf = (label: string, entries: { id: string }[]): Set<string> => {
    const seen = new Set<string>()
    for (const { id } of entries) {
      if (seen.has(id)) problems.push(`${label} "${id}" appears more than once`)
      seen.add(id)
    }
    return seen
  }

  const packs = idsOf('Pack', data.packs)
  const characters = idsOf('Character', data.characters)
  const weapons = idsOf('Weapon', data.weapons)
  const passives = idsOf('Item', data.passives)
  idsOf('Evolution', data.evolutions)

  const weaponById = new Map(data.weapons.map((weapon) => [weapon.id, weapon]))

  const checkSource = (where: string, source: string) => {
    if (!packs.has(source)) problems.push(`${where}: unknown pack "${source}"`)
  }

  for (const character of data.characters) {
    const where = `Character "${character.id}"`
    checkSource(where, character.source)
    for (const weapon of character.startingWeapons) {
      if (!weapons.has(weapon)) problems.push(`${where}: unknown starting weapon "${weapon}"`)
    }
  }

  for (const weapon of data.weapons) {
    const where = `Weapon "${weapon.id}"`
    checkSource(where, weapon.source)
    for (const character of weapon.exclusiveTo ?? []) {
      if (!characters.has(character)) problems.push(`${where}: unknown character "${character}"`)
    }
  }

  for (const passive of data.passives) {
    checkSource(`Item "${passive.id}"`, passive.source)
  }

  for (const evolution of data.evolutions) {
    const where = `Evolution "${evolution.id}"`
    checkSource(where, evolution.source)

    const result = weaponById.get(evolution.result)
    if (!result) {
      problems.push(`${where}: unknown result "${evolution.result}"`)
    } else if (result.kind !== 'evolved') {
      problems.push(`${where}: result "${evolution.result}" is not marked as "evolved"`)
    }

    for (const { id } of evolution.weapons) {
      if (!weapons.has(id)) problems.push(`${where}: unknown weapon "${id}"`)
      if (id === evolution.result) problems.push(`${where}: weapon "${id}" is also the result`)
    }
    for (const { id } of evolution.passives) {
      if (!passives.has(id)) problems.push(`${where}: unknown item "${id}"`)
    }
    for (const id of evolution.characters ?? []) {
      if (!characters.has(id)) problems.push(`${where}: unknown character "${id}"`)
    }
    if (evolution.kind === 'union' && evolution.weapons.length < 2) {
      problems.push(`${where}: a union needs at least two weapons`)
    }
  }

  for (const recommendation of data.recommendations) {
    const where = `Recommendation for "${recommendation.character}" (${recommendation.source})`
    checkSource(where, recommendation.source)
    if (!characters.has(recommendation.character)) {
      problems.push(`${where}: unknown character`)
    }
    for (const { id } of recommendation.weapons) {
      if (!weapons.has(id)) problems.push(`${where}: unknown weapon "${id}"`)
    }
    for (const { id } of recommendation.passives) {
      if (!passives.has(id)) problems.push(`${where}: unknown item "${id}"`)
    }
  }

  return problems
}
