// Runs automatically after `npm install`.
// If the project is in iCloud Drive, node_modules is excluded from syncing
// (tens of thousands of small files would slow iCloud down a lot).
// Does nothing on Windows/Linux or outside iCloud.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const inICloud = process.cwd().includes('/Mobile Documents/')

if (process.platform === 'darwin' && inICloud && existsSync('node_modules')) {
  try {
    execFileSync('xattr', ['-w', 'com.apple.fileprovider.ignore#P', '1', 'node_modules'])
  } catch {
    console.warn('Note: could not exclude node_modules from iCloud syncing.')
  }
}
