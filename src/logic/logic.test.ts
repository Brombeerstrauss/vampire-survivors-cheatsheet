import { describe, expect, it } from 'vitest'
import { gameData } from '../data/index.ts'
import type { GameData, LocalizedText, PassiveItem, Weapon } from '../data/types.ts'
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

const lt = (text: string): LocalizedText => ({ de: text, en: text })

const weapon = (id: string, maxLevel = 8, kind: Weapon['kind'] = 'base', source = 'base'): Weapon => ({
  id,
  name: id,
  source,
  kind,
  description: lt(''),
  maxLevel,
  verified: true,
})
const passive = (id: string, maxLevel = 5, extra: Partial<PassiveItem> = {}): PassiveItem => ({
  id,
  name: id,
  source: 'base',
  description: lt(''),
  maxLevel,
  verified: true,
  ...extra,
})

const fixture: GameData = {
  packs: [
    { id: 'base', name: lt('Base game'), kind: 'base', paid: false, verified: true },
    { id: 'moon', name: lt('Moon DLC'), kind: 'dlc', paid: true, verified: true },
  ],
  characters: [
    { id: 'antonio', name: 'Antonio', source: 'base', startingWeapons: ['whip'], bonus: lt(''), secret: false, verified: true },
    { id: 'mortaccio', name: 'Mortaccio', source: 'base', startingWeapons: ['bone'], bonus: lt(''), secret: false, verified: true },
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
    // Evolution across DLC boundaries: base weapon + DLC item
    { id: 'moon-whip', kind: 'evolution', source: 'moon', result: 'moon-whip', weapons: [{ id: 'whip' }], passives: [{ id: 'moon-pearl' }], verified: true },
  ],
  recommendations: [
    {
      character: 'antonio',
      source: 'base',
      weapons: [{ id: 'axe', reason: lt('High damage'), priority: 2 }],
      passives: [
        { id: 'spinach', reason: lt('More might'), priority: 1 },
        { id: 'hollow-heart', reason: lt('More health'), priority: 1 },
      ],
    },
  ],
}

const both = createCatalog(fixture, new Set(['base', 'moon']))
const baseOnly = createCatalog(fixture, new Set(['base']))

const evo = (id: string) => fixture.evolutions.find((e) => e.id === id)!
const run = (partial: Partial<RunState>): RunState => ({ ...EMPTY_RUN, ...partial })

describe('Evolution: weapon + item', () => {
  it('reports the missing item', () => {
    const check = checkEvolution(evo('bloody-tear'), run({ weapons: [{ id: 'whip' }] }), baseOnly)
    expect(check.ready).toBe(false)
    expect(check.missing.map((m) => m.id)).toEqual(['hollow-heart'])
  })

  it('mentions the weapon max level as a hint', () => {
    const r = run({ weapons: [{ id: 'whip' }], passives: [{ id: 'hollow-heart' }] })
    expect(checkEvolution(evo('bloody-tear'), r, baseOnly).needsMax.map((n) => n.id)).toEqual(['whip'])
  })

  it('is ready once weapon and item are in the run', () => {
    const r = run({ weapons: [{ id: 'whip' }], passives: [{ id: 'hollow-heart' }] })
    expect(checkEvolution(evo('bloody-tear'), r, baseOnly).ready).toBe(true)
  })

  it('replaces the weapon in its slot and keeps the item', () => {
    const r = run({
      weapons: [{ id: 'knife' }, { id: 'whip' }, { id: 'axe' }],
      passives: [{ id: 'hollow-heart' }],
    })
    const next = applyEvolution(r, baseOnly, evo('bloody-tear'))
    expect(next.weapons.map((w) => w.id)).toEqual(['knife', 'bloody-tear', 'axe'])
    expect(next.passives).toEqual(r.passives)
  })
})

describe('Evolution with several items', () => {
  it('needs both rings and mentions max level for all three parts', () => {
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
  it('reports the missing second weapon', () => {
    const check = checkEvolution(evo('vandalier'), run({ weapons: [{ id: 'peachone' }] }), baseOnly)
    expect(check.missing).toMatchObject([{ type: 'weapon', id: 'ebony-wings' }])
  })

  it('merges both weapons into one and frees a slot', () => {
    const r = run({ weapons: [{ id: 'peachone' }, { id: 'knife' }, { id: 'ebony-wings' }] })
    expect(checkEvolution(evo('vandalier'), r, baseOnly).ready).toBe(true)
    const next = applyEvolution(r, baseOnly, evo('vandalier'))
    expect(next.weapons.map((w) => w.id)).toEqual(['vandalier', 'knife'])
  })
})

describe('Morphs', () => {
  it('only apply to the matching character', () => {
    const bone = [{ id: 'bone' }]
    expect(evolutionsForOwnedWeapon('bone', run({ character: 'mortaccio', weapons: bone }), baseOnly)).toHaveLength(1)
    expect(evolutionsForOwnedWeapon('bone', run({ character: 'antonio', weapons: bone }), baseOnly)).toHaveLength(0)
  })

  it('do not need the weapon at max level', () => {
    const r = run({ character: 'mortaccio', weapons: [{ id: 'bone' }] })
    const check = checkEvolution(evo('anima'), r, baseOnly)
    expect(check.ready).toBe(true)
    expect(check.needsMax).toEqual([])
  })
})

describe('DLC filter', () => {
  it('hides content of DLCs that are not enabled', () => {
    expect(baseOnly.passive('moon-pearl')).toBeUndefined()
    expect(both.passive('moon-pearl')).toBeDefined()
  })

  it('shows evolutions across DLC boundaries only when all packs involved are enabled', () => {
    expect(baseOnly.evolutionsFromWeapon('whip').map((e) => e.id)).toEqual(['bloody-tear'])
    expect(both.evolutionsFromWeapon('whip').map((e) => e.id)).toEqual(['bloody-tear', 'moon-whip'])
  })

  it('allows items like Mini Crewmates even when slots are full', () => {
    const data: GameData = { ...fixture, passives: [...fixture.passives, passive('mini-crewmate', 3, { ignoresSlotLimit: true })] }
    const catalog = createCatalog(data, new Set(['base']))
    let r = run({})
    for (const id of ['spinach', 'armor', 'wings', 'clover', 'crown', 'bracer']) r = addPassive(r, catalog, id)
    expect(addPassive(r, catalog, 'mini-crewmate').passives).toHaveLength(7)
  })

  it('removes items that the evolution uses up', () => {
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

  it('does not count items without a slot', () => {
    let r = run({})
    for (const id of ['spinach', 'armor', 'wings', 'clover', 'crown', 'bracer']) r = addPassive(r, both, id)
    expect(r.passives).toHaveLength(6)
    expect(addPassive(r, both, 'hollow-heart').passives).toHaveLength(6)
    expect(addPassive(r, both, 'moon-pearl').passives).toHaveLength(7)
  })
})

describe('Run', () => {
  it('starts with the character\'s starting weapons', () => {
    expect(startRun(baseOnly, 'antonio')).toEqual({ character: 'antonio', weapons: [{ id: 'whip' }], passives: [] })
  })

  it('allows at most 6 weapons', () => {
    let r = run({})
    for (const id of ['whip', 'peachone', 'ebony-wings', 'clock-lancet', 'bone', 'knife', 'axe']) r = addWeapon(r, baseOnly, id)
    expect(r.weapons.map((w) => w.id)).not.toContain('axe')
    expect(r.weapons).toHaveLength(6)
  })


  it('cleans up stored data', () => {
    const raw = { character: 'nobody', weapons: [{ id: 'whip', level: 99 }, { id: 'whip' }, { id: 'laser' }] as unknown, passives: 'kaputt' }
    expect(sanitizeRun(raw, baseOnly)).toEqual({ character: null, weapons: [{ id: 'whip' }], passives: [] })
  })
})

describe('Suggestions', () => {
  it('lists missing evolution partners before recommendations', () => {
    const { suggestions } = suggestNext(run({ character: 'antonio', weapons: [{ id: 'whip' }] }), baseOnly)
    expect(suggestions[0]).toMatchObject({ type: 'passive', id: 'hollow-heart', source: 'evolution' })
    expect(suggestions[0]!.reasons).toContainEqual({ type: 'missingFor', result: 'bloody-tear' })
    expect(suggestions[0]!.reasons).toContainEqual({ type: 'recommended', text: lt('More health') })
    expect(suggestions.map((s) => s.id)).toEqual(['hollow-heart', 'spinach', 'axe'])
  })

  it('suggests weapons that pair with items you have', () => {
    const { suggestions } = suggestNext(run({ passives: [{ id: 'hollow-heart' }] }), baseOnly)
    expect(suggestions).toContainEqual(expect.objectContaining({ type: 'weapon', id: 'whip', source: 'pairing' }))
  })

  it('names the union partner', () => {
    const { suggestions } = suggestNext(run({ weapons: [{ id: 'peachone' }] }), baseOnly)
    expect(suggestions[0]).toMatchObject({ type: 'weapon', id: 'ebony-wings', reasons: [{ type: 'unionPartner', result: 'vandalier' }] })
  })

  it('warns when all passive slots are full and a partner is missing', () => {
    const passives = ['spinach', 'armor', 'wings', 'clover', 'crown', 'bracer'].map((id) => ({ id }))
    const result = suggestNext(run({ weapons: [{ id: 'whip' }], passives }), baseOnly)
    expect(result.warnings).toEqual([{ type: 'passiveSlotsFull', passive: 'hollow-heart', results: ['bloody-tear'] }])
    expect(result.suggestions.filter((s) => s.type === 'passive')).toEqual([])
  })

  it('warns when free slots are not enough for all planned evolutions', () => {
    const passives = ['spinach', 'armor', 'wings', 'clover', 'crown'].map((id) => ({ id }))
    const result = suggestNext(run({ weapons: [{ id: 'whip' }, { id: 'clock-lancet' }], passives }), baseOnly)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toEqual({ type: 'notEnoughPassiveSlots', needed: ['hollow-heart', 'silver-ring', 'gold-ring'], free: 1 })
    expect(result.hints).toEqual([{ type: 'stageOnly', passive: 'silver-ring' }, { type: 'stageOnly', passive: 'gold-ring' }])
  })

  it('does not suggest a weapon already evolved in this run', () => {
    const r = run({ character: 'antonio', weapons: [{ id: 'bloody-tear' }], passives: [{ id: 'hollow-heart' }] })
    expect(suggestNext(r, baseOnly).suggestions.map((s) => s.id)).not.toContain('whip')
  })

  it('suggests nothing that is already in the run', () => {
    const r = run({ character: 'antonio', weapons: [{ id: 'whip' }, { id: 'axe' }], passives: [{ id: 'hollow-heart' }, { id: 'spinach' }] })
    expect(suggestNext(r, baseOnly).suggestions).toEqual([])
  })
})

describe('Real data', () => {
  const catalog = createCatalog(gameData, new Set(gameData.packs.map((p) => p.id)))

  it('Whip + Hollow Heart gives Bloody Tear', () => {
    const r = run({ weapons: [{ id: 'whip' }], passives: [{ id: 'hollow-heart' }] })
    const [check] = evolutionsForOwnedWeapon('whip', r, catalog)
    expect(check?.evolution.result).toBe('bloody-tear')
    expect(check?.ready).toBe(true)
  })

  it('Peachone + Ebony Wings gives the union Vandalier', () => {
    const union = catalog.evolutionsFromWeapon('peachone').find((e) => e.kind === 'union')
    expect(union?.result).toBe('vandalier')
    expect(union?.weapons.map((w) => w.id).sort()).toEqual(['ebony-wings', 'peachone'])
  })

  it('every character starts with existing weapons', () => {
    for (const character of catalog.characters) {
      for (const id of character.startingWeapons) expect(catalog.weapon(id), `${character.id} → ${id}`).toBeDefined()
    }
  })
})
