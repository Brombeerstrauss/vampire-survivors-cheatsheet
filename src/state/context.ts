import { createContext, useContext } from 'react'
import type { Lang, PackId } from '../data/types.ts'
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
  setShowImages(show: boolean): void
  setLanguage(language: Lang): void
  /** Catalog of the enabled packs. */
  catalog: Catalog
  /** Catalog of all packs. */
  fullCatalog: Catalog
  run: RunState
  /** Changes the run; `notice` briefly shows a message with an undo button. */
  updateRun(change: (run: RunState, catalog: Catalog) => RunState, notice?: string): void
  notice: Notice | null
  dismissNotice(): void
}

export const Context = createContext<AppState | null>(null)

export function useAppState(): AppState {
  const state = useContext(Context)
  if (!state) throw new Error('useAppState used outside of AppStateProvider')
  return state
}
