import { describe, expect, it } from 'vitest'
import { gameData } from '../data/index.ts'
import { createCatalog } from '../logic/catalog.ts'
import { checkEvolution } from '../logic/evolution.ts'
import { EMPTY_RUN } from '../logic/run.ts'
import type { SuggestionReason, SuggestionWarning } from '../logic/suggestions.ts'
import { describeReason, describeWarning, readyText } from './describe.ts'
import { makeI18n } from './index.ts'
import { detectLanguage, displayName, fullName, searchNames } from './names.ts'
import { de, en } from './strings.ts'

describe('Namen', () => {
  const whip = { name: 'Whip', nameDe: 'Peitsche' }
  const bolt = { name: 'Unearthly Bolt', nameDeHint: 'Überirdischer Blitz' }
  const pako = { name: 'Pako Battiliar' }

  it('nimmt auf Deutsch den offiziellen deutschen Namen', () => {
    expect(displayName(whip, 'de')).toEqual({ main: 'Peitsche' })
  })

  it('zeigt ohne offiziellen Namen den englischen mit Übersetzung in Klammern', () => {
    expect(displayName(bolt, 'de')).toEqual({ main: 'Unearthly Bolt', hint: 'Überirdischer Blitz' })
    expect(fullName(bolt, 'de')).toBe('Unearthly Bolt (Überirdischer Blitz)')
  })

  it('lässt Eigennamen ohne Klammer', () => {
    expect(fullName(pako, 'de')).toBe('Pako Battiliar')
  })

  it('zeigt auf Englisch immer den englischen Namen', () => {
    expect(fullName(whip, 'en')).toBe('Whip')
    expect(fullName(bolt, 'en')).toBe('Unearthly Bolt')
  })

  it('findet einen Eintrag über alle Namen', () => {
    expect(searchNames(whip)).toContain('Peitsche')
    expect(searchNames(whip)).toContain('Whip')
    expect(searchNames(bolt)).toContain('Überirdischer')
  })
})

describe('Sprache des Geräts', () => {
  it('wählt Deutsch bei deutschem Gerät, sonst Englisch', () => {
    expect(detectLanguage(['de-DE', 'en-US'])).toBe('de')
    expect(detectLanguage(['en-US', 'de-DE'])).toBe('de')
    expect(detectLanguage(['fr-FR'])).toBe('en')
    expect(detectLanguage([])).toBe('en')
  })
})

describe('Wörterbuch', () => {
  it('hat in beiden Sprachen dieselben Einträge', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort())
  })

  it('verbindet Listen sprachgerecht', () => {
    expect(de.list(['A', 'B', 'C'])).toBe('A, B und C')
    expect(en.list(['A', 'B'])).toBe('A and B')
  })
})

describe('Sätze aus der Logik', () => {
  const catalog = createCatalog(gameData, new Set(gameData.packs.map((p) => p.id)))
  const deI18n = makeI18n('de')
  const enI18n = makeI18n('en')

  it('nutzt offizielle deutsche Namen in Begründungen', () => {
    const reason: SuggestionReason = { type: 'missingFor', result: 'bloody-tear' }
    expect(describeReason(reason, deI18n, catalog)).toBe('Fehlt für Blutige Träne')
    expect(describeReason(reason, enI18n, catalog)).toBe('Missing for Bloody Tear')
  })

  it('formuliert Warnungen in beiden Sprachen', () => {
    const warning: SuggestionWarning = { type: 'passiveSlotsFull', passive: 'hollow-heart', results: ['bloody-tear'] }
    expect(describeWarning(warning, deI18n, catalog)).toBe('Blutige Träne: Hohlherz fehlt, aber alle passiven Slots sind belegt.')
    expect(describeWarning(warning, enI18n, catalog)).toBe('Bloody Tear: Hollow Heart is missing, but all passive slots are full.')
  })

  it('nennt im Bereit-Text, was auf Maximalstufe muss', () => {
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

describe('Daten in beiden Sprachen', () => {
  it('jeder Text hat eine deutsche und eine englische Fassung', () => {
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

  it('hat für Teile des Basisspiels offizielle deutsche Namen', () => {
    const whip = gameData.weapons.find((w) => w.id === 'whip')
    expect(whip?.nameDe).toBe('Peitsche')
  })
})
