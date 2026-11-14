import { describe, expect, it } from 'vitest'
import { gameData } from '../data/index.ts'
import type { GameData, PassiveItem, Weapon } from '../data/types.ts'
import { createCatalog } from './catalog.ts'
import { checkEvolution, evolutionsForOwnedWeapon } from './evolution.ts'
import {
  addPassive,
  addWeapon,
  applyEvolution,
  EMPTY_RUN,
  sanitizeRun,
  startRun,
  type RunState,
} from './run.ts'
import { suggestNext } from './suggestions.ts'

const weapon = (id: string, maxLevel = 8, kind: Weapon['kind'] = 'base', source = 'base'): Weapon => ({
  id,
  name: id,
  source,
  kind,
  description: '',
  maxLevel,
  verified: true,
})
const passive = (id: string, maxLevel = 5, extra: Partial<PassiveItem> = {}): PassiveItem => ({
  id,
  name: id,
  source: 'base',
  description: '',
  maxLevel,
  verified: true,
  ...extra,
})

const fixture: GameData = {
  packs: [
    { id: 'base', name: 'Basisspiel', kind: 'base', paid: false, verified: true },
    { id: 'moon', name: 'Mond-DLC', kind: 'dlc', paid: true, verified: true },
  ],
  characters: [
    { id: 'antonio', name: 'Antonio', source: 'base', startingWeapons: ['whip'], bonus: '', secret: false, verified: true },
    { id: 'mortaccio', name: 'Mortaccio', source: 'base', startingWeapons: ['bone'], bonus: '', secret: false, verified: true },
  ],
  weapons: [
    weapon('whip'),
    weapon('bloody-tear', 1, 'evolved'),
    weapon('peachone'),
    weapon('ebony-wings'),
    weapon('vandalier', 8, 'evolved'),
    weapon('clock-lancet', 7),
    weapon('infinite-corridor', 1, 'evolved'),
    weapon('bone'),
    weapon('anima', 1, 'evolved'),
    weapon('knife'),
    weapon('axe'),
    weapon('cross'),
    weapon('moon-whip', 1, 'evolved', 'moon'),
  ],
  passives: [
    passive('hollow-heart'),
    passive('spinach'),
    passive('armor'),
    passive('wings'),
    passive('clover'),
    passive('crown'),
    passive('bracer'),
    passive('silver-ring', 9, { stageOnly: true }),
    passive('gold-ring', 9, { stageOnly: true }),
    passive('moon-pearl', 6, { source: 'moon', noSlot: true }),
  ],
  evolutions: [
    { id: 'bloody-tear', kind: 'evolution', source: 'base', result: 'bloody-tear', weapons: [{ id: 'whip' }], passives: [{ id: 'hollow-heart' }], verified: true },
    { id: 'vandalier', kind: 'union', source: 'base', result: 'vandalier', weapons: [{ id: 'peachone' }, { id: 'ebony-wings' }], passives: [], verified: true },
    {
      id: 'infinite-corridor',
      kind: 'evolution',
      source: 'base',
      result: 'infinite-corridor',
      weapons: [{ id: 'clock-lancet' }],
      passives: [{ id: 'silver-ring', level: 'max' }, { id: 'gold-ring', level: 'max' }],
      verified: true,
    },
    { id: 'anima', kind: 'morph', source: 'base', result: 'anima', weapons: [{ id: 'bone', level: 'any' }], passives: [], characters: ['mortaccio'], verified: true },
    // Entwicklung über DLC-Grenzen: Basis-Waffe + DLC-Gegenstand
    { id: 'moon-whip', kind: 'evolution', source: 'moon', result: 'moon-whip', weapons: [{ id: 'whip' }], passives: [{ id: 'moon-pearl' }], verified: true },
  ],
  recommendations: [
    {
      character: 'antonio',
      source: 'base',
      weapons: [{ id: 'axe', reason: 'Viel Schaden', priority: 2 }],
      passives: [
        { id: 'spinach', reason: 'Mehr Macht', priority: 1 },
        { id: 'hollow-heart', reason: 'Mehr Leben', priority: 1 },
      ],
    },
  ],
}

const both = createCatalog(fixture, new Set(['base', 'moon']))
const baseOnly = createCatalog(fixture, new Set(['base']))

const evo = (id: string) => fixture.evolutions.find((e) => e.id === id)!
const run = (partial: Partial<RunState>): RunState => ({ ...EMPTY_RUN, ...partial })

describe('Entwicklung: Waffe + Gegenstand', () => {
  it('meldet den fehlenden Gegenstand', () => {
    const check = checkEvolution(evo('bloody-tear'), run({ weapons: [{ id: 'whip' }] }), baseOnly)
    expect(check.ready).toBe(false)
    expect(check.missing.map((m) => m.id)).toEqual(['hollow-heart'])
  })

  it('nennt die Maximalstufe der Waffe als Hinweis', () => {
    const r = run({ weapons: [{ id: 'whip' }], passives: [{ id: 'hollow-heart' }] })
    expect(checkEvolution(evo('bloody-tear'), r, baseOnly).needsMax.map((n) => n.id)).toEqual(['whip'])
  })

  it('ist bereit, sobald Waffe und Gegenstand im Lauf sind', () => {
    const r = run({ weapons: [{ id: 'whip' }], passives: [{ id: 'hollow-heart' }] })
    expect(checkEvolution(evo('bloody-tear'), r, baseOnly).ready).toBe(true)
  })

  it('ersetzt die Waffe an ihrem Platz und behält den Gegenstand', () => {
    const r = run({
      weapons: [{ id: 'knife' }, { id: 'whip' }, { id: 'axe' }],
      passives: [{ id: 'hollow-heart' }],
    })
    const next = applyEvolution(r, baseOnly, evo('bloody-tear'))
    expect(next.weapons.map((w) => w.id)).toEqual(['knife', 'bloody-tear', 'axe'])
    expect(next.passives).toEqual(r.passives)
  })
})

describe('Entwicklung mit mehreren Gegenständen', () => {
  it('braucht beide Ringe und nennt für alle drei Teile die Maximalstufe', () => {
    const oneRing = run({ weapons: [{ id: 'clock-lancet' }], passives: [{ id: 'silver-ring' }] })
    const check = checkEvolution(evo('infinite-corridor'), oneRing, baseOnly)
    expect(check.ready).toBe(false)
    expect(check.missing.map((m) => m.id)).toEqual(['gold-ring'])

    const both = { ...oneRing, passives: [{ id: 'silver-ring' }, { id: 'gold-ring' }] }
    const ready = checkEvolution(evo('infinite-corridor'), both, baseOnly)
    expect(ready.ready).toBe(true)
    expect(ready.needsMax.map((n) => n.id)).toEqual(['clock-lancet', 'silver-ring', 'gold-ring'])
  })
})

describe('Unions', () => {
  it('meldet die fehlende zweite Waffe', () => {
    const check = checkEvolution(evo('vandalier'), run({ weapons: [{ id: 'peachone' }] }), baseOnly)
    expect(check.missing).toMatchObject([{ type: 'weapon', id: 'ebony-wings' }])
  })

  it('verschmilzt beide Waffen zu einer und gibt einen Slot frei', () => {
    const r = run({ weapons: [{ id: 'peachone' }, { id: 'knife' }, { id: 'ebony-wings' }] })
    expect(checkEvolution(evo('vandalier'), r, baseOnly).ready).toBe(true)
    const next = applyEvolution(r, baseOnly, evo('vandalier'))
    expect(next.weapons.map((w) => w.id)).toEqual(['vandalier', 'knife'])
  })
})

describe('Morphs', () => {
  it('gelten nur für den passenden Charakter', () => {
    const bone = [{ id: 'bone' }]
    expect(evolutionsForOwnedWeapon('bone', run({ character: 'mortaccio', weapons: bone }), baseOnly)).toHaveLength(1)
    expect(evolutionsForOwnedWeapon('bone', run({ character: 'antonio', weapons: bone }), baseOnly)).toHaveLength(0)
  })

  it('brauchen keine Maximalstufe der Waffe', () => {
    const r = run({ character: 'mortaccio', weapons: [{ id: 'bone' }] })
    const check = checkEvolution(evo('anima'), r, baseOnly)
    expect(check.ready).toBe(true)
    expect(check.needsMax).toEqual([])
  })
})

describe('DLC-Filter', () => {
  it('blendet Inhalte nicht freigeschalteter DLCs aus', () => {
    expect(baseOnly.passive('moon-pearl')).toBeUndefined()
    expect(both.passive('moon-pearl')).toBeDefined()
  })

  it('zeigt Entwicklungen über DLC-Grenzen nur, wenn alle beteiligten Pakete freigeschaltet sind', () => {
    expect(baseOnly.evolutionsFromWeapon('whip').map((e) => e.id)).toEqual(['bloody-tear'])
    expect(both.evolutionsFromWeapon('whip').map((e) => e.id)).toEqual(['bloody-tear', 'moon-whip'])
  })

  it('erlaubt Gegenstände wie Mini Crewmates auch bei vollen Slots', () => {
    const data: GameData = { ...fixture, passives: [...fixture.passives, passive('mini-crewmate', 3, { ignoresSlotLimit: true })] }
    const catalog = createCatalog(data, new Set(['base']))
    let r = run({})
    for (const id of ['spinach', 'armor', 'wings', 'clover', 'crown', 'bracer']) r = addPassive(r, catalog, id)
    expect(addPassive(r, catalog, 'mini-crewmate').passives).toHaveLength(7)
  })

  it('entfernt verbrauchte Gegenstände bei der Entwicklung', () => {
    const data: GameData = {
      ...fixture,
      passives: [...fixture.passives, passive('power-up', 1, { noSlot: true })],
      evolutions: [
        { id: 'proto', kind: 'evolution', source: 'base', result: 'bloody-tear', weapons: [{ id: 'whip' }], passives: [{ id: 'power-up', consumed: true }], verified: true },
      ],
    }
    const catalog = createCatalog(data, new Set(['base']))
    const r = run({ weapons: [{ id: 'whip' }], passives: [{ id: 'power-up' }, { id: 'spinach' }] })
    const next = applyEvolution(r, catalog, data.evolutions[0]!)
    expect(next.passives.map((p) => p.id)).toEqual(['spinach'])
  })

  it('zählt Gegenstände ohne Slot nicht mit', () => {
    let r = run({})
    for (const id of ['spinach', 'armor', 'wings', 'clover', 'crown', 'bracer']) r = addPassive(r, both, id)
    expect(r.passives).toHaveLength(6)
    expect(addPassive(r, both, 'hollow-heart').passives).toHaveLength(6)
    expect(addPassive(r, both, 'moon-pearl').passives).toHaveLength(7)
  })
})

describe('Lauf', () => {
  it('startet mit den Startwaffen des Charakters', () => {
    expect(startRun(baseOnly, 'antonio')).toEqual({ character: 'antonio', weapons: [{ id: 'whip' }], passives: [] })
  })

  it('erlaubt höchstens 6 Waffen', () => {
    let r = run({})
    for (const id of ['whip', 'peachone', 'ebony-wings', 'clock-lancet', 'bone', 'knife', 'axe']) r = addWeapon(r, baseOnly, id)
    expect(r.weapons.map((w) => w.id)).not.toContain('axe')
    expect(r.weapons).toHaveLength(6)
  })


  it('räumt gespeicherte Daten auf', () => {
    const raw = { character: 'nobody', weapons: [{ id: 'whip', level: 99 }, { id: 'whip' }, { id: 'laser' }] as unknown, passives: 'kaputt' }
    expect(sanitizeRun(raw, baseOnly)).toEqual({ character: null, weapons: [{ id: 'whip' }], passives: [] })
  })
})

describe('Vorschläge', () => {
  it('nennt fehlende Entwicklungs-Partner vor den Empfehlungen', () => {
    const { suggestions } = suggestNext(run({ character: 'antonio', weapons: [{ id: 'whip' }] }), baseOnly)
    expect(suggestions[0]).toMatchObject({ type: 'passive', id: 'hollow-heart', source: 'evolution' })
    expect(suggestions[0]!.reasons).toContain('Fehlt für bloody-tear')
    expect(suggestions[0]!.reasons).toContain('Mehr Leben')
    expect(suggestions.map((s) => s.id)).toEqual(['hollow-heart', 'spinach', 'axe'])
  })

  it('schlägt Waffen vor, die zu vorhandenen Gegenständen passen', () => {
    const { suggestions } = suggestNext(run({ passives: [{ id: 'hollow-heart' }] }), baseOnly)
    expect(suggestions).toContainEqual(expect.objectContaining({ type: 'weapon', id: 'whip', source: 'pairing' }))
  })

  it('nennt den Union-Partner', () => {
    const { suggestions } = suggestNext(run({ weapons: [{ id: 'peachone' }] }), baseOnly)
    expect(suggestions[0]).toMatchObject({ type: 'weapon', id: 'ebony-wings', reasons: ['Union-Partner für vandalier'] })
  })

  it('warnt, wenn alle passiven Slots belegt sind und ein Partner fehlt', () => {
    const passives = ['spinach', 'armor', 'wings', 'clover', 'crown', 'bracer'].map((id) => ({ id }))
    const result = suggestNext(run({ weapons: [{ id: 'whip' }], passives }), baseOnly)
    expect(result.warnings).toEqual(['bloody-tear: hollow-heart fehlt, aber alle passiven Slots sind belegt.'])
    expect(result.suggestions.filter((s) => s.type === 'passive')).toEqual([])
  })

  it('warnt, wenn freie Slots nicht für alle geplanten Entwicklungen reichen', () => {
    const passives = ['spinach', 'armor', 'wings', 'clover', 'crown'].map((id) => ({ id }))
    const result = suggestNext(run({ weapons: [{ id: 'whip' }, { id: 'clock-lancet' }], passives }), baseOnly)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('fehlen 3 passive Gegenstände')
    expect(result.hints).toHaveLength(2)
  })

  it('schlägt keine Waffe vor, die im Lauf schon entwickelt wurde', () => {
    const r = run({ character: 'antonio', weapons: [{ id: 'bloody-tear' }], passives: [{ id: 'hollow-heart' }] })
    expect(suggestNext(r, baseOnly).suggestions.map((s) => s.id)).not.toContain('whip')
  })

  it('schlägt nichts vor, was schon im Lauf ist', () => {
    const r = run({ character: 'antonio', weapons: [{ id: 'whip' }, { id: 'axe' }], passives: [{ id: 'hollow-heart' }, { id: 'spinach' }] })
    expect(suggestNext(r, baseOnly).suggestions).toEqual([])
  })
})

describe('Echte Daten', () => {
  const catalog = createCatalog(gameData, new Set(gameData.packs.map((p) => p.id)))

  it('Whip + Hollow Heart ergibt Bloody Tear', () => {
    const r = run({ weapons: [{ id: 'whip' }], passives: [{ id: 'hollow-heart' }] })
    const [check] = evolutionsForOwnedWeapon('whip', r, catalog)
    expect(check?.evolution.result).toBe('bloody-tear')
    expect(check?.ready).toBe(true)
  })

  it('Peachone + Ebony Wings ergibt die Union Vandalier', () => {
    const union = catalog.evolutionsFromWeapon('peachone').find((e) => e.kind === 'union')
    expect(union?.result).toBe('vandalier')
    expect(union?.weapons.map((w) => w.id).sort()).toEqual(['ebony-wings', 'peachone'])
  })

  it('jeder Charakter startet mit vorhandenen Waffen', () => {
    for (const character of catalog.characters) {
      for (const id of character.startingWeapons) expect(catalog.weapon(id), `${character.id} → ${id}`).toBeDefined()
    }
  })
})
