import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { gameData } from '../data/index.ts'
import type { Lang, PackId } from '../data/types.ts'
import { detectLanguage } from '../i18n/names.ts'
import { createCatalog, type Catalog } from '../logic/catalog.ts'
import { buildGameIdIndex, liveRunFromPlayer, sameRun } from '../logic/modBridge.ts'
import { sanitizeRun, type RunState } from '../logic/run.ts'
import { Context, type AppState, type LiveState, type Notice } from './context.ts'
import { useModConnection } from './modConnection.ts'
import { loadSettings } from './settings.ts'
import { readStored, writeStored } from './storage.ts'

const SETTINGS_KEY = 'vsc.settings.v1'
const RUN_KEY = 'vsc.run.v1'

/** Alle Pakete, unabhängig vom Filter: für Namen und Stufen von Teilen, die schon im Lauf sind. */
const fullCatalog = createCatalog(gameData, new Set(gameData.packs.map((p) => p.id)))

/** Spielkennung -> Kennung der App, für Meldungen aus dem Mod. */
const gameIdIndex = buildGameIdIndex(gameData)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() =>
    loadSettings(readStored(SETTINGS_KEY), gameData.packs, detectLanguage(navigator.languages ?? [navigator.language])),
  )
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
  const setLanguage = useCallback((language: Lang) => setSettings((s) => ({ ...s, language })), [])
  const setModBridge = useCallback((modBridge: boolean) => setSettings((s) => ({ ...s, modBridge })), [])

  // Der aktuelle Lauf als Ref, damit Änderungen und Rückgängig-Meldung zusammen entstehen.
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

  // Live-Daten aus dem Spiel: Während eines Laufs ist das Spiel die Wahrheit und
  // überschreibt den Lauf der App. Im Menü bleibt der letzte Stand stehen.
  // Im Koop wird Spieler 1 übernommen; das In-Game-Overlay des Mods zeigt alle Spieler.
  const { status, snapshot } = useModConnection(settings.modBridge)
  const livePlayer = snapshot?.inRun ? snapshot.players[0] : undefined
  const liveRun = useMemo(() => (livePlayer ? liveRunFromPlayer(livePlayer, gameIdIndex) : null), [livePlayer])

  useEffect(() => {
    if (!liveRun || sameRun(liveRun.run, runRef.current)) return
    runRef.current = liveRun.run
    setRun(liveRun.run)
  }, [liveRun])

  const live = useMemo<LiveState>(() => ({ status }), [status])

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
      setModBridge,
      live,
      catalog,
      fullCatalog,
      run,
      updateRun,
      notice,
      dismissNotice: () => setNotice(null),
    }),
    [settings, setOwnedPack, setShowSecrets, setShowImages, setLanguage, setModBridge, live, catalog, run, updateRun, notice],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}
