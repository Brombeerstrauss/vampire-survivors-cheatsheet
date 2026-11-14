import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { gameData } from '../data/index.ts'
import type { Lang, PackId } from '../data/types.ts'
import { createCatalog, type Catalog } from '../logic/catalog.ts'
import { sanitizeRun, type RunState } from '../logic/run.ts'
import { Context, type AppState, type Notice } from './context.ts'
import { loadSettings } from './settings.ts'
import { readStored, writeStored } from './storage.ts'

const SETTINGS_KEY = 'vsc.settings.v1'
const RUN_KEY = 'vsc.run.v1'

/** All packs regardless of the filter: for names and levels of parts already in the run. */
const fullCatalog = createCatalog(gameData, new Set(gameData.packs.map((p) => p.id)))

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => loadSettings(readStored(SETTINGS_KEY), gameData.packs))
  const [run, setRun] = useState(() => sanitizeRun(readStored(RUN_KEY), fullCatalog))
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => writeStored(SETTINGS_KEY, settings), [settings])
  useEffect(() => {
    document.documentElement.lang = settings.language
  }, [settings.language])
  useEffect(() => writeStored(RUN_KEY, run), [run])

  const catalog = useMemo(() => createCatalog(gameData, new Set(settings.ownedPacks)), [settings.ownedPacks])

  const setOwnedPack = useCallback((id: PackId, owned: boolean) => {
    if (gameData.packs.find((p) => p.id === id)?.kind === 'base') return
    setSettings((s) => ({
      ...s,
      ownedPacks: owned ? [...new Set([...s.ownedPacks, id])] : s.ownedPacks.filter((p) => p !== id),
    }))
  }, [])

  const setShowSecrets = useCallback((show: boolean) => setSettings((s) => ({ ...s, showSecrets: show })), [])
  const setShowImages = useCallback((show: boolean) => setSettings((s) => ({ ...s, showImages: show })), [])
  const setLanguage = useCallback((language: Lang) => setSettings((s) => ({ ...s, language, languageChosen: true })), [])

  // The current run as a ref, so a change and its undo notice are created together.
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  }, [run])

  const updateRun = useCallback((change: (run: RunState, catalog: Catalog) => RunState, message?: string) => {
    const previous = runRef.current
    const next = change(previous, fullCatalog)
    if (next === previous) return
    runRef.current = next
    setRun(next)
    setNotice(message ? { message, undo: () => setRun(previous) } : null)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const value = useMemo<AppState>(
    () => ({
      settings,
      setOwnedPack,
      setShowSecrets,
      setShowImages,
      setLanguage,
      catalog,
      fullCatalog,
      run,
      updateRun,
      notice,
      dismissNotice: () => setNotice(null),
    }),
    [settings, setOwnedPack, setShowSecrets, setShowImages, setLanguage, catalog, run, updateRun, notice],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

