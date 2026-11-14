// Zugriff auf localStorage, der nie wirft: In privaten Fenstern oder bei
// blockierten Website-Daten läuft die App einfach ohne Speicherung weiter.

export function readStored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Speicher voll oder gesperrt: nicht schlimm, der Zustand bleibt bis zum Neuladen erhalten.
  }
}
