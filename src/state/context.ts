import { createContext, useContext } from 'react'
import type { PackId } from '../data/types.ts'
import type { Catalog } from '../logic/catalog.ts'
import type { RunState } from '../logic/run.ts'
import type { Settings } from './settings.ts'

export interface Notice {
  message: string
  undo?: () => void
}

export interface AppState {
  settings: Settings
  setOwnedPack(id: PackId, owned: boolean): void
  setShowSecrets(show: boolean): void
  /** Katalog der freigeschalteten Pakete. */
  catalog: Catalog
  /** Katalog aller Pakete. */
  fullCatalog: Catalog
  run: RunState
  /** Ändert den Lauf; `notice` zeigt kurz eine Meldung mit Rückgängig-Knopf. */
  updateRun(change: (run: RunState, catalog: Catalog) => RunState, notice?: string): void
  notice: Notice | null
  dismissNotice(): void
}

export const Context = createContext<AppState | null>(null)

export function useAppState(): AppState {
  const state = useContext(Context)
  if (!state) throw new Error('useAppState außerhalb von AppStateProvider')
  return state
}
