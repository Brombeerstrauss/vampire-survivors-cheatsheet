import Ajv from 'ajv'
import { describe, expect, it } from 'vitest'
import { checkIntegrity } from './integrity.ts'
import { loadGameData, PACK_FILES } from './load.ts'
import packsFile from './packs.json'
import type { GameData, LocalizedText } from './types.ts'

const both = (text: string): LocalizedText => ({ de: text, en: text })

const schemas = import.meta.glob<object>('./schema/*.schema.json', { eager: true, import: 'default' })
const files = import.meta.glob('./packs/*/*.json', { eager: true, import: 'default' })

const ajv = new Ajv({ allErrors: true })
for (const [path, schema] of Object.entries(schemas)) {
  ajv.addSchema(schema, path.split('/').pop())
}

function schemaErrors(schemaName: string, json: unknown): string[] {
  const validate = ajv.getSchema(`${schemaName}.schema.json`)
  if (!validate) return [`Schema ${schemaName} fehlt`]
  validate(json)
  return (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`)
}

describe('Game data', () => {
  it('packs.json matches its schema', () => {
    expect(schemaErrors('packs', packsFile)).toEqual([])
  })

  it.each(Object.keys(files))('%s entspricht dem Schema', (path) => {
    const name = PACK_FILES.find((file) => path.endsWith(`/${file}.json`))
    expect(name, 'unknown file name').toBeDefined()
    expect(schemaErrors(name!, files[path])).toEqual([])
  })

  it('every entry is in the folder of its pack', () => {
    expect(loadGameData(packsFile, files).problems).toEqual([])
  })

  it('all references point to existing entries', () => {
    expect(checkIntegrity(loadGameData(packsFile, files).data)).toEqual([])
  })

  it('puts the base game before the DLCs, in the order of packs.json', () => {
    const { data } = loadGameData(packsFile, files)
    const order = [...new Set(data.characters.map((c) => c.source))]
    expect(order).toEqual(data.packs.map((p) => p.id).filter((id) => order.includes(id)))
    expect(data.characters[0]?.source).toBe('base')
  })

  // Without a game ID the app cannot match the entry with data from the mod.
  // To fill them in: python3 -I tools/wiki-import/game_ids.py https://vampire.survivors.wiki/api.php src/data/packs
  it('characters, weapons and items have game IDs (gameIds)', () => {
    const { data } = loadGameData(packsFile, files)
    const missing = [...data.characters, ...data.weapons, ...data.passives]
      .filter((entry) => !entry.gameIds?.length)
      .map((entry) => entry.id)
    expect(missing).toEqual([])
  })
})

describe('Schemas reject broken entries', () => {
  it('unknown fields', () => {
    const errors = schemaErrors('weapons', {
      weapons: [
        { id: 'whip', name: 'Whip', source: 'base', kind: 'base', description: '', maxLevel: 8, verified: true, dmg: 10 },
      ],
    })
    expect(errors).not.toEqual([])
  })

  it('texts in only one language', () => {
    const errors = schemaErrors('weapons', {
      weapons: [
        { id: 'whip', name: 'Whip', source: 'base', kind: 'base', description: { de: 'Peitsche' }, maxLevel: 8, verified: true },
      ],
    })
    expect(errors).not.toEqual([])
  })

  it('missing verified', () => {
    const errors = schemaErrors('passives', {
      passives: [{ id: 'spinach', name: 'Spinach', source: 'base', description: '', maxLevel: 5 }],
    })
    expect(errors).not.toEqual([])
  })

  it('IDs with capital letters or spaces', () => {
    const errors = schemaErrors('evolutions', {
      evolutions: [
        { id: 'Holy Wand', kind: 'evolution', source: 'base', result: 'holy-wand', weapons: [{ id: 'magic-wand' }], passives: [], verified: true },
      ],
    })
    expect(errors).not.toEqual([])
  })
})

describe('checkIntegrity', () => {
  const base: GameData = {
    packs: [{ id: 'base', name: both('Base game'), kind: 'base', paid: false, verified: true }],
    characters: [],
    weapons: [
      { id: 'whip', name: 'Whip', source: 'base', kind: 'base', description: both(''), maxLevel: 8, verified: true },
      { id: 'bloody-tear', name: 'Bloody Tear', source: 'base', kind: 'evolved', description: both(''), maxLevel: 1, verified: true },
    ],
    passives: [{ id: 'hollow-heart', name: 'Hollow Heart', source: 'base', description: both(''), maxLevel: 5, verified: true }],
    evolutions: [],
    recommendations: [],
  }

  it('reports nothing for consistent data', () => {
    expect(checkIntegrity(base)).toEqual([])
  })

  it('reports duplicate IDs', () => {
    const data = { ...base, weapons: [...base.weapons, base.weapons[0]!] }
    expect(checkIntegrity(data)).toEqual(['Weapon "whip" appears more than once'])
  })

  it('reports references to unknown ingredients and packs', () => {
    const data: GameData = {
      ...base,
      evolutions: [
        {
          id: 'bloody-tear',
          kind: 'evolution',
          source: 'moonspell',
          result: 'bloody-tear',
          weapons: [{ id: 'whipp' }],
          passives: [{ id: 'hollow-hart' }],
          verified: true,
        },
      ],
    }
    expect(checkIntegrity(data)).toEqual([
      'Evolution "bloody-tear": unknown pack "moonspell"',
      'Evolution "bloody-tear": unknown weapon "whipp"',
      'Evolution "bloody-tear": unknown item "hollow-hart"',
    ])
  })

  it('reports game IDs that belong to two entries', () => {
    const [whip, tear] = base.weapons
    const data = { ...base, weapons: [{ ...whip!, gameIds: ['WHIP'] }, { ...tear!, gameIds: ['VAMPIRICA', 'WHIP'] }] }
    expect(checkIntegrity(data)).toEqual(['Weapon "bloody-tear": game ID WHIP already belongs to "whip"'])
  })

  it('reports results that are not evolved weapons', () => {
    const data: GameData = {
      ...base,
      evolutions: [
        { id: 'x', kind: 'evolution', source: 'base', result: 'whip', weapons: [{ id: 'bloody-tear' }], passives: [], verified: true },
      ],
    }
    expect(checkIntegrity(data)).toEqual(['Evolution "x": result "whip" is not marked as "evolved"'])
  })
})
