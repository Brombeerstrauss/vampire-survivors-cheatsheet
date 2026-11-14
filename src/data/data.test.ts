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

describe('Spieldaten', () => {
  it('packs.json entspricht dem Schema', () => {
    expect(schemaErrors('packs', packsFile)).toEqual([])
  })

  it.each(Object.keys(files))('%s entspricht dem Schema', (path) => {
    const name = PACK_FILES.find((file) => path.endsWith(`/${file}.json`))
    expect(name, 'unbekannter Dateiname').toBeDefined()
    expect(schemaErrors(name!, files[path])).toEqual([])
  })

  it('jeder Eintrag liegt im Ordner seines Pakets', () => {
    expect(loadGameData(packsFile, files).problems).toEqual([])
  })

  it('alle Verweise zeigen auf vorhandene Einträge', () => {
    expect(checkIntegrity(loadGameData(packsFile, files).data)).toEqual([])
  })

  it('das Basisspiel steht vor den DLCs, in der Reihenfolge von packs.json', () => {
    const { data } = loadGameData(packsFile, files)
    const order = [...new Set(data.characters.map((c) => c.source))]
    expect(order).toEqual(data.packs.map((p) => p.id).filter((id) => order.includes(id)))
    expect(data.characters[0]?.source).toBe('base')
  })

  // Ohne Spielkennung kann die App den Eintrag nicht aus dem Mod übernehmen.
  // Nachtragen: python3 -I tools/wiki-import/game_ids.py https://vampire.survivors.wiki/api.php src/data/packs
  it('Charaktere, Waffen und Gegenstände haben Spielkennungen (gameIds)', () => {
    const { data } = loadGameData(packsFile, files)
    const missing = [...data.characters, ...data.weapons, ...data.passives]
      .filter((entry) => !entry.gameIds?.length)
      .map((entry) => entry.id)
    expect(missing).toEqual([])
  })
})

describe('Schemas lehnen fehlerhafte Einträge ab', () => {
  it('unbekannte Felder', () => {
    const errors = schemaErrors('weapons', {
      weapons: [
        { id: 'whip', name: 'Whip', source: 'base', kind: 'base', description: '', maxLevel: 8, verified: true, dmg: 10 },
      ],
    })
    expect(errors).not.toEqual([])
  })

  it('Texte nur in einer Sprache', () => {
    const errors = schemaErrors('weapons', {
      weapons: [
        { id: 'whip', name: 'Whip', source: 'base', kind: 'base', description: { de: 'Peitsche' }, maxLevel: 8, verified: true },
      ],
    })
    expect(errors).not.toEqual([])
  })

  it('fehlendes verified', () => {
    const errors = schemaErrors('passives', {
      passives: [{ id: 'spinach', name: 'Spinach', source: 'base', description: '', maxLevel: 5 }],
    })
    expect(errors).not.toEqual([])
  })

  it('Kennungen mit Großbuchstaben oder Leerzeichen', () => {
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
    packs: [{ id: 'base', name: both('Basisspiel'), kind: 'base', paid: false, verified: true }],
    characters: [],
    weapons: [
      { id: 'whip', name: 'Whip', source: 'base', kind: 'base', description: both(''), maxLevel: 8, verified: true },
      { id: 'bloody-tear', name: 'Bloody Tear', source: 'base', kind: 'evolved', description: both(''), maxLevel: 1, verified: true },
    ],
    passives: [{ id: 'hollow-heart', name: 'Hollow Heart', source: 'base', description: both(''), maxLevel: 5, verified: true }],
    evolutions: [],
    recommendations: [],
  }

  it('meldet nichts bei stimmigen Daten', () => {
    expect(checkIntegrity(base)).toEqual([])
  })

  it('meldet doppelte Kennungen', () => {
    const data = { ...base, weapons: [...base.weapons, base.weapons[0]!] }
    expect(checkIntegrity(data)).toEqual(['Waffe "whip" kommt mehrfach vor'])
  })

  it('meldet Verweise auf unbekannte Zutaten und Pakete', () => {
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
      'Entwicklung "bloody-tear": unbekanntes Paket "moonspell"',
      'Entwicklung "bloody-tear": unbekannte Waffe "whipp"',
      'Entwicklung "bloody-tear": unbekannter Gegenstand "hollow-hart"',
    ])
  })

  it('meldet Spielkennungen, die zu zwei Einträgen gehören', () => {
    const [whip, tear] = base.weapons
    const data = { ...base, weapons: [{ ...whip!, gameIds: ['WHIP'] }, { ...tear!, gameIds: ['VAMPIRICA', 'WHIP'] }] }
    expect(checkIntegrity(data)).toEqual(['Waffe "bloody-tear": Spielkennung WHIP gehört schon zu "whip"'])
  })

  it('meldet Ergebnisse, die keine entwickelte Waffe sind', () => {
    const data: GameData = {
      ...base,
      evolutions: [
        { id: 'x', kind: 'evolution', source: 'base', result: 'whip', weapons: [{ id: 'bloody-tear' }], passives: [], verified: true },
      ],
    }
    expect(checkIntegrity(data)).toEqual(['Entwicklung "x": Ergebnis "whip" ist nicht als "evolved" markiert'])
  })
})
