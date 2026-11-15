import { describe, expect, it } from 'vitest'
import { gameData } from '../data/index.ts'
import { buildGameIdIndex, levelKey, liveRunFromPlayer, parseSnapshot, sameRun } from './modBridge.ts'

// A real update from the plugin, captured in a test run with Imelda (game version 1.16).
const SAMPLE = {
  v: 1,
  plugin: '0.1.0',
  inRun: true,
  time: 1794690160229,
  players: [
    {
      index: 0,
      character: 'IMELDA',
      weapons: [
        { type: 'MAGIC_MISSILE', level: 2 },
        { type: 'NIGHTSWORD', level: 1 },
        { type: 'EX_MAGISTONE1', level: 1 },
        { type: 'SILVERWIND', level: 1 },
      ],
      passives: [{ type: 'MOVESPEED', level: 1 }],
    },
  ],
}

const index = buildGameIdIndex(gameData)

describe('parseSnapshot', () => {
  it('reads a real update from the plugin', () => {
    const snap = parseSnapshot(SAMPLE)
    expect(snap?.inRun).toBe(true)
    expect(snap?.players).toHaveLength(1)
    expect(snap?.players[0]?.weapons[0]).toEqual({ type: 'MAGIC_MISSILE', level: 2 })
  })

  it('rejects other formats and skips broken entries', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot({ v: 2, players: [] })).toBeNull()
    const snap = parseSnapshot({ v: 1, inRun: true, players: [{ weapons: [{ type: 'WHIP' }, { level: 3 }, 'x'] }, 7] })
    expect(snap?.players).toEqual([{ index: 0, character: null, weapons: [{ type: 'WHIP', level: 0 }], passives: [] }])
  })
})

describe('liveRunFromPlayer', () => {
  it('maps game IDs to app IDs', () => {
    const live = liveRunFromPlayer(parseSnapshot(SAMPLE)!.players[0]!, index)
    expect(live.run).toEqual({
      character: 'imelda-belpaese',
      weapons: [{ id: 'magic-wand' }, { id: 'night-sword' }, { id: 'magi-stone' }, { id: 'silver-wind' }],
      passives: [{ id: 'wings' }],
    })
    expect(live.levels[levelKey('weapon', 'magic-wand')]).toBe(2)
    expect(live.levels[levelKey('passive', 'wings')]).toBe(1)
    expect(live.unknown).toEqual([])
  })

  it('collects unknown IDs instead of adding them', () => {
    const live = liveRunFromPlayer(
      { index: 0, character: 'NOBODY', weapons: [{ type: 'HIDDEN_THING', level: 1 }, { type: 'WHIP', level: 3 }], passives: [] },
      index,
    )
    expect(live.run.character).toBeNull()
    expect(live.run.weapons).toEqual([{ id: 'whip' }])
    expect(live.unknown).toEqual(['NOBODY', 'HIDDEN_THING'])
  })

  it('adds weapons with several game IDs only once', () => {
    const tonne = gameData.weapons.find((w) => (w.gameIds?.length ?? 0) > 1)!
    const live = liveRunFromPlayer(
      { index: 0, character: null, weapons: tonne.gameIds!.map((type) => ({ type, level: 1 })), passives: [] },
      index,
    )
    expect(live.run.weapons).toEqual([{ id: tonne.id }])
  })
})

describe('sameRun', () => {
  it('compares content only', () => {
    const a = { character: 'x', weapons: [{ id: 'whip' }], passives: [] }
    expect(sameRun(a, { ...a, weapons: [{ id: 'whip' }] })).toBe(true)
    expect(sameRun(a, { ...a, weapons: [{ id: 'axe' }] })).toBe(false)
  })
})
