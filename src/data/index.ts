import { loadGameData } from './load.ts'
import packsFile from './packs.json'

// Every folder under packs/ is loaded automatically, so a new DLC only needs
// a folder with JSON files and an entry in packs.json.
const files = import.meta.glob('./packs/*/*.json', { eager: true, import: 'default' })

const { data, problems } = loadGameData(packsFile, files)

if (import.meta.env.DEV && problems.length > 0) {
  console.warn('Probleme in den Spieldaten:\n' + problems.join('\n'))
}

export const gameData = data
export * from './types.ts'
