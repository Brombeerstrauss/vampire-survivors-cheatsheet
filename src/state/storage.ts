// localStorage access that never throws: in private windows or with blocked
// site data, the app simply keeps running without saving.

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
    // Storage full or blocked: no harm, the state stays until the page reloads.
  }
}
