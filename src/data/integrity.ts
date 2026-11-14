import type { GameData } from './types.ts'

/**
 * Prüft, ob die Daten in sich stimmig sind: eindeutige Kennungen und keine
 * Verweise ins Leere. Gibt eine Liste lesbarer Probleme zurück (leer = alles gut).
 */
export function checkIntegrity(data: GameData): string[] {
  const problems: string[] = []

  const idsOf = (label: string, entries: { id: string }[]): Set<string> => {
    const seen = new Set<string>()
    for (const { id } of entries) {
      if (seen.has(id)) problems.push(`${label} "${id}" kommt mehrfach vor`)
      seen.add(id)
    }
    return seen
  }

  const packs = idsOf('Paket', data.packs)
  const characters = idsOf('Charakter', data.characters)
  const weapons = idsOf('Waffe', data.weapons)
  const passives = idsOf('Gegenstand', data.passives)
  idsOf('Entwicklung', data.evolutions)

  const weaponById = new Map(data.weapons.map((weapon) => [weapon.id, weapon]))

  const checkSource = (where: string, source: string) => {
    if (!packs.has(source)) problems.push(`${where}: unbekanntes Paket "${source}"`)
  }

  for (const character of data.characters) {
    const where = `Charakter "${character.id}"`
    checkSource(where, character.source)
    for (const weapon of character.startingWeapons) {
      if (!weapons.has(weapon)) problems.push(`${where}: unbekannte Startwaffe "${weapon}"`)
    }
  }

  for (const weapon of data.weapons) {
    const where = `Waffe "${weapon.id}"`
    checkSource(where, weapon.source)
    for (const character of weapon.exclusiveTo ?? []) {
      if (!characters.has(character)) problems.push(`${where}: unbekannter Charakter "${character}"`)
    }
  }

  for (const passive of data.passives) {
    checkSource(`Gegenstand "${passive.id}"`, passive.source)
  }

  for (const evolution of data.evolutions) {
    const where = `Entwicklung "${evolution.id}"`
    checkSource(where, evolution.source)

    const result = weaponById.get(evolution.result)
    if (!result) {
      problems.push(`${where}: unbekanntes Ergebnis "${evolution.result}"`)
    } else if (result.kind !== 'evolved') {
      problems.push(`${where}: Ergebnis "${evolution.result}" ist nicht als "evolved" markiert`)
    }

    for (const { id } of evolution.weapons) {
      if (!weapons.has(id)) problems.push(`${where}: unbekannte Waffe "${id}"`)
      if (id === evolution.result) problems.push(`${where}: Waffe "${id}" ist zugleich das Ergebnis`)
    }
    for (const { id } of evolution.passives) {
      if (!passives.has(id)) problems.push(`${where}: unbekannter Gegenstand "${id}"`)
    }
    if (evolution.kind === 'union' && evolution.weapons.length < 2) {
      problems.push(`${where}: eine Union braucht mindestens zwei Waffen`)
    }
  }

  for (const recommendation of data.recommendations) {
    const where = `Empfehlung für "${recommendation.character}" (${recommendation.source})`
    checkSource(where, recommendation.source)
    if (!characters.has(recommendation.character)) {
      problems.push(`${where}: unbekannter Charakter`)
    }
    for (const { id } of recommendation.weapons) {
      if (!weapons.has(id)) problems.push(`${where}: unbekannte Waffe "${id}"`)
    }
    for (const { id } of recommendation.passives) {
      if (!passives.has(id)) problems.push(`${where}: unbekannter Gegenstand "${id}"`)
    }
  }

  return problems
}
