import { describe, expect, it } from 'vitest'
import { gameData } from '../data/index.ts'
import { createCatalog } from '../logic/catalog.ts'
import { checkEvolution } from '../logic/evolution.ts'
import { EMPTY_RUN } from '../logic/run.ts'
import type { SuggestionReason, SuggestionWarning } from '../logic/suggestions.ts'
import { describeReason, describeWarning, readyText } from './describe.ts'
import { makeI18n } from './index.ts'
import { loadSettings } from '../state/settings.ts'
import { displayName, fullName, searchNames } from './names.ts'
import { de, en } from './strings.ts'

describe('Names', () => {
  const whip = { name: 'Whip', nameDe: 'Peitsche' }
  const bolt = { name: 'Unearthly Bolt', nameDeHint: 'Überirdischer Blitz' }
  const pako = { name: 'Pako Battiliar' }

  it('uses the official German name in German', () => {
    expect(displayName(whip, 'de')).toEqual({ main: 'Peitsche' })
  })

  it('shows the English name with a translation in parentheses when there is no official name', () => {
    expect(displayName(bolt, 'de')).toEqual({ main: 'Unearthly Bolt', hint: 'Überirdischer Blitz' })
    expect(fullName(bolt, 'de')).toBe('Unearthly Bolt (Überirdischer Blitz)')
  })

  it('leaves proper names without parentheses', () => {
    expect(fullName(pako, 'de')).toBe('Pako Battiliar')
  })

  it('always shows the English name in English', () => {
    expect(fullName(whip, 'en')).toBe('Whip')
    expect(fullName(bolt, 'en')).toBe('Unearthly Bolt')
  })

  it('finds an entry by any of its names', () => {
    expect(searchNames(whip)).toContain('Peitsche')
    expect(searchNames(whip)).toContain('Whip')
    expect(searchNames(bolt)).toContain('Überirdischer')
  })
})

describe('Default language', () => {
  const language = (raw: unknown) => loadSettings(raw, gameData.packs).language

  it('starts in English', () => {
    expect(language(undefined)).toBe('en')
  })

  it('ignores a German language that earlier versions took from the device', () => {
    expect(language({ language: 'de' })).toBe('en')
  })

  it('keeps a language the user picked', () => {
    expect(language({ language: 'de', languageChosen: true })).toBe('de')
  })
})

describe('Dictionary', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort())
  })

  it('joins lists the way each language does', () => {
    expect(de.list(['A', 'B', 'C'])).toBe('A, B und C')
    expect(en.list(['A', 'B'])).toBe('A and B')
  })
})

describe('Sentences from the logic', () => {
  const catalog = createCatalog(gameData, new Set(gameData.packs.map((p) => p.id)))
  const deI18n = makeI18n('de')
  const enI18n = makeI18n('en')

  it('uses official German names in reasons', () => {
    const reason: SuggestionReason = { type: 'missingFor', result: 'bloody-tear' }
    expect(describeReason(reason, deI18n, catalog)).toBe('Fehlt für Blutige Träne')
    expect(describeReason(reason, enI18n, catalog)).toBe('Missing for Bloody Tear')
  })

  it('phrases warnings in both languages', () => {
    const warning: SuggestionWarning = { type: 'passiveSlotsFull', passive: 'hollow-heart', results: ['bloody-tear'] }
    expect(describeWarning(warning, deI18n, catalog)).toBe('Blutige Träne: Hohlherz fehlt, aber alle passiven Slots sind belegt.')
    expect(describeWarning(warning, enI18n, catalog)).toBe('Bloody Tear: Hollow Heart is missing, but all passive slots are full.')
  })

  it('says in the ready text what needs max level', () => {
    const evo = catalog.evolutionsFromWeapon('whip').find((e) => e.result === 'bloody-tear')!
    const run = { ...EMPTY_RUN, weapons: [{ id: 'whip' }], passives: [{ id: 'hollow-heart' }] }
    const check = checkEvolution(evo, run, catalog)
    expect(readyText(check, deI18n, catalog)).toBe(
      'Alles da: Sobald Peitsche auf Maximalstufe ist, bringt die nächste Truhe mit Entwicklung Blutige Träne.',
    )
    expect(readyText(check, enI18n, catalog)).toBe(
      'All set: once Whip is at max level, the next chest with an evolution brings Bloody Tear.',
    )
  })
})

describe('Data in both languages', () => {
  it('every text has a German and an English version', () => {
    const texts = [
      ...gameData.weapons.map((w) => w.description),
      ...gameData.passives.map((p) => p.description),
      ...gameData.characters.map((c) => c.bonus),
      ...gameData.recommendations.flatMap((r) => [r.summary, ...r.weapons.map((w) => w.reason), ...r.passives.map((p) => p.reason)]),
      ...gameData.evolutions.flatMap((e) => e.conditions ?? []),
    ].filter((t) => t !== undefined)
    const incomplete = texts.filter((t) => !t.de.trim() || !t.en.trim())
    expect(incomplete).toEqual([])
  })

  it('has official German names for base game parts', () => {
    const whip = gameData.weapons.find((w) => w.id === 'whip')
    expect(whip?.nameDe).toBe('Peitsche')
  })
})
