import { useEffect, useState } from 'react'
import { MOD_URL, parseSnapshot, type ModSnapshot } from '../logic/modBridge.ts'

/**
 * - `off`: in den Einstellungen ausgeschaltet
 * - `connecting`: Verbindungsaufbau (oder der Browser fragt gerade nach der Erlaubnis)
 * - `live`: verbunden, Meldungen kommen an
 * - `offline`: Plugin nicht erreichbar (Spiel aus, Mod nicht installiert); der Browser versucht es weiter
 */
export type ModStatus = 'off' | 'connecting' | 'live' | 'offline'

const INITIAL = { status: 'connecting', snapshot: null } as const

/**
 * Hält eine Server-Sent-Events-Verbindung zum Plugin offen. EventSource verbindet sich
 * nach Abbrüchen selbst neu, das Spiel kann also auch später gestartet werden.
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
        // Unlesbare Meldung: ignorieren, die nächste kommt bei der nächsten Änderung.
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
