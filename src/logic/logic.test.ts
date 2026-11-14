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
  setWeaponLevel,
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
    const check = checkEvolution(evo('bloody-tear'), run({ weapons: [{ id: 'whip', level: 8 }] }), baseOnly)
    expect(check.ready).toBe(false)
    expect(check.missing.map((m) => m.id)).toEqual(['hollow-heart'])
  })

  it('verlangt die Waffe auf Maximalstufe', () => {
    const r = run({ weapons: [{ id: 'whip', level: 5 }], passives: [{ id: 'hollow-heart', level: 1 }] })
    const check = checkEvolution(evo('bloody-tear'), r, baseOnly)
    expect(check.ready).toBe(false)
    expect(check.leveling).toMatchObject([{ id: 'whip', level: 5, maxLevel: 8 }])
  })

  it('ist bereit, sobald die Waffe auf Maximalstufe ist und der Gegenstand vorhanden ist', () => {
    const r = run({ weapons: [{ id: 'whip', level: 8 }], passives: [{ id: 'hollow-heart', level: 1 }] })
    expect(checkEvolution(evo('bloody-tear'), r, baseOnly).ready).toBe(true)
  })

  it('ersetzt die Waffe an ihrem Platz und behält den Gegenstand', () => {
    const r = run({
      weapons: [{ id: 'knife', level: 3 }, { id: 'whip', level: 8 }, { id: 'axe', level: 2 }],
      passives: [{ id: 'hollow-heart', level: 1 }],
    })
    const next = applyEvolution(r, baseOnly, evo('bloody-tear'))
    expect(next.weapons.map((w) => w.id)).toEqual(['knife', 'bloody-tear', 'axe'])
    expect(next.passives).toEqual(r.passives)
  })
})

describe('Entwicklung mit mehreren Gegenständen', () => {
  it('braucht beide Ringe auf Maximalstufe', () => {
    const r = run({
      weapons: [{ id: 'clock-lancet', level: 7 }],
      passives: [{ id: 'silver-ring', level: 9 }, { id: 'gold-ring', level: 8 }],
    })
    const check = checkEvolution(evo('infinite-corridor'), r, baseOnly)
    expect(check.ready).toBe(false)
    expect(check.leveling.map((l) => l.id)).toEqual(['gold-ring'])

    const maxed = { ...r, passives: [{ id: 'silver-ring', level: 9 }, { id: 'gold-ring', level: 9 }] }
    expect(checkEvolution(evo('infinite-corridor'), maxed, baseOnly).ready).toBe(true)
  })
})

describe('Unions', () => {
  it('meldet die fehlende zweite Waffe', () => {
    const check = checkEvolution(evo('vandalier'), run({ weapons: [{ id: 'peachone', level: 8 }] }), baseOnly)
    expect(check.missing).toMatchObject([{ type: 'weapon', id: 'ebony-wings' }])
  })

  it('verschmilzt beide Waffen zu einer und gibt einen Slot frei', () => {
    const r = run({ weapons: [{ id: 'peachone', level: 8 }, { id: 'knife', level: 1 }, { id: 'ebony-wings', level: 8 }] })
    expect(checkEvolution(evo('vandalier'), r, baseOnly).ready).toBe(true)
    const next = applyEvolution(r, baseOnly, evo('vandalier'))
    expect(next.weapons.map((w) => w.id)).toEqual(['vandalier', 'knife'])
    expect(next.weapons[0]!.level).toBe(1)
  })
})

describe('Morphs', () => {
  it('gelten nur für den passenden Charakter', () => {
    const bone = [{ id: 'bone', level: 2 }]
    expect(evolutionsForOwnedWeapon('bone', run({ character: 'mortaccio', weapons: bone }), baseOnly)).toHaveLength(1)
    expect(evolutionsForOwnedWeapon('bone', run({ character: 'antonio', weapons: bone }), baseOnly)).toHaveLength(0)
  })

  it('brauchen keine Maximalstufe der Waffe', () => {
    const r = run({ character: 'mortaccio', weapons: [{ id: 'bone', level: 2 }] })
    expect(checkEvolution(evo('anima'), r, baseOnly).ready).toBe(true)
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
    expect(startRun(baseOnly, 'antonio')).toEqual({ character: 'antonio', weapons: [{ id: 'whip', level: 1 }], passives: [] })
  })

  it('erlaubt höchstens 6 Waffen', () => {
    let r = run({})
    for (const id of ['whip', 'peachone', 'ebony-wings', 'clock-lancet', 'bone', 'knife', 'axe']) r = addWeapon(r, baseOnly, id)
    expect(r.weapons.map((w) => w.id)).not.toContain('axe')
    expect(r.weapons).toHaveLength(6)
  })

  it('begrenzt Stufen auf 1 bis Maximalstufe', () => {
    const r = run({ weapons: [{ id: 'whip', level: 1 }] })
    expect(setWeaponLevel(r, baseOnly, 'whip', 12).weapons[0]!.level).toBe(8)
    expect(setWeaponLevel(r, baseOnly, 'whip', 0).weapons[0]!.level).toBe(1)
  })

  it('räumt gespeicherte Daten auf', () => {
    const raw = { character: 'nobody', weapons: [{ id: 'whip', level: 99 }, { id: 'whip', level: 1 }, { id: 'laser' }], passives: 'kaputt' }
    expect(sanitizeRun(raw, baseOnly)).toEqual({ character: null, weapons: [{ id: 'whip', level: 8 }], passives: [] })
  })
})

describe('Vorschläge', () => {
  it('nennt fehlende Entwicklungs-Partner vor den Empfehlungen', () => {
    const { suggestions } = suggestNext(run({ character: 'antonio', weapons: [{ id: 'whip', level: 3 }] }), baseOnly)
    expect(suggestions[0]).toMatchObject({ type: 'passive', id: 'hollow-heart', source: 'evolution' })
    expect(suggestions[0]!.reasons).toContain('Fehlt für bloody-tear')
    expect(suggestions[0]!.reasons).toContain('Mehr Leben')
    expect(suggestions.map((s) => s.id)).toEqual(['hollow-heart', 'spinach', 'axe'])
  })

  it('schlägt Waffen vor, die zu vorhandenen Gegenständen passen', () => {
    const { suggestions } = suggestNext(run({ passives: [{ id: 'hollow-heart', level: 1 }] }), baseOnly)
    expect(suggestions).toContainEqual(expect.objectContaining({ type: 'weapon', id: 'whip', source: 'pairing' }))
  })

  it('nennt den Union-Partner', () => {
    const { suggestions } = suggestNext(run({ weapons: [{ id: 'peachone', level: 1 }] }), baseOnly)
    expect(suggestions[0]).toMatchObject({ type: 'weapon', id: 'ebony-wings', reasons: ['Union-Partner für vandalier'] })
  })

  it('warnt, wenn alle passiven Slots belegt sind und ein Partner fehlt', () => {
    const passives = ['spinach', 'armor', 'wings', 'clover', 'crown', 'bracer'].map((id) => ({ id, level: 1 }))
    const result = suggestNext(run({ weapons: [{ id: 'whip', level: 8 }], passives }), baseOnly)
    expect(result.warnings).toEqual(['bloody-tear: hollow-heart fehlt, aber alle passiven Slots sind belegt.'])
    expect(result.suggestions.filter((s) => s.type === 'passive')).toEqual([])
  })

  it('warnt, wenn freie Slots nicht für alle geplanten Entwicklungen reichen', () => {
    const passives = ['spinach', 'armor', 'wings', 'clover', 'crown'].map((id) => ({ id, level: 1 }))
    const result = suggestNext(run({ weapons: [{ id: 'whip', level: 8 }, { id: 'clock-lancet', level: 1 }], passives }), baseOnly)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('fehlen 3 passive Gegenstände')
    expect(result.hints).toHaveLength(2)
  })

  it('schlägt keine Waffe vor, die im Lauf schon entwickelt wurde', () => {
    const r = run({ character: 'antonio', weapons: [{ id: 'bloody-tear', level: 1 }], passives: [{ id: 'hollow-heart', level: 1 }] })
    expect(suggestNext(r, baseOnly).suggestions.map((s) => s.id)).not.toContain('whip')
  })

  it('schlägt nichts vor, was schon im Lauf ist', () => {
    const r = run({ character: 'antonio', weapons: [{ id: 'whip', level: 8 }, { id: 'axe', level: 1 }], passives: [{ id: 'hollow-heart', level: 1 }, { id: 'spinach', level: 1 }] })
    expect(suggestNext(r, baseOnly).suggestions).toEqual([])
  })
})

describe('Echte Daten', () => {
  const catalog = createCatalog(gameData, new Set(gameData.packs.map((p) => p.id)))

  it('Whip + Hollow Heart ergibt Bloody Tear', () => {
    const r = run({ weapons: [{ id: 'whip', level: 8 }], passives: [{ id: 'hollow-heart', level: 1 }] })
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
