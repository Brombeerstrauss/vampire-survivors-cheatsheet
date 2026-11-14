import { loadGameData } from './load.ts'
import packsFile from './packs.json'

// Jeder Ordner unter packs/ wird automatisch mitgeladen. Ein neuer DLC braucht
// also nur einen Ordner mit JSON-Dateien und einen Eintrag in packs.json.
const files = import.meta.glob('./packs/*/*.json', { eager: true, import: 'default' })

const { data, problems } = loadGameData(packsFile, files)

if (import.meta.env.DEV && problems.length > 0) {
  console.warn('Probleme in den Spieldaten:\n' + problems.join('\n'))
}

export const gameData = data
export * from './types.ts'
