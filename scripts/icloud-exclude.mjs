// Läuft automatisch nach `npm install`.
// Liegt das Projekt in iCloud Drive, wird node_modules vom Sync ausgenommen
// (zehntausende kleine Dateien bremsen iCloud sonst stark aus).
// Auf Windows/Linux oder außerhalb von iCloud passiert nichts.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const inICloud = process.cwd().includes('/Mobile Documents/')

if (process.platform === 'darwin' && inICloud && existsSync('node_modules')) {
  try {
    execFileSync('xattr', ['-w', 'com.apple.fileprovider.ignore#P', '1', 'node_modules'])
  } catch {
    console.warn('Hinweis: node_modules konnte nicht vom iCloud-Sync ausgenommen werden.')
  }
}
