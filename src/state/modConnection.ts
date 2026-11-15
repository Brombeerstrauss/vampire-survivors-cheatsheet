import { useEffect, useState } from 'react'
import { MOD_URL, parseSnapshot, type ModSnapshot } from '../logic/modBridge.ts'

/**
 * - `off`: turned off in the settings
 * - `connecting`: connecting (or the browser is asking for permission)
 * - `live`: connected, updates are arriving
 * - `offline`: plugin not reachable (game closed, mod not installed); the browser keeps retrying
 */
export type ModStatus = 'off' | 'connecting' | 'live' | 'offline'

const INITIAL = { status: 'connecting', snapshot: null } as const

/**
 * Keeps a Server-Sent Events connection to the plugin open. EventSource reconnects by
 * itself after drops, so the game can also be started later.
 */
export function useModConnection(enabled: boolean): { status: ModStatus; snapshot: ModSnapshot | null } {
  const [connection, setConnection] = useState<{ status: Exclude<ModStatus, 'off'>; snapshot: ModSnapshot | null }>(
    INITIAL,
  )

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return
    const source = new EventSource(`${MOD_URL}/events`)
    source.onopen = () => setConnection((c) => ({ ...c, status: 'live' }))
    source.onmessage = (event) => {
      try {
        const snapshot = parseSnapshot(JSON.parse(event.data))
        if (snapshot) setConnection({ status: 'live', snapshot })
      } catch {
        // Unreadable update: ignore it, the next one comes with the next change.
      }
    }
    source.onerror = () => setConnection({ status: 'offline', snapshot: null })
    return () => {
      source.close()
      setConnection(INITIAL)
    }
  }, [enabled])

  if (!enabled || typeof EventSource === 'undefined') return { status: 'off', snapshot: null }
  return connection
}
