import type { Lang, LocalizedText } from '../data/types.ts'

/** Was ein Eintrag für die Namensanzeige mitbringt. */
export interface Named {
  name: string
  nameDe?: string
  nameDeHint?: string
}

export interface DisplayName {
  /** Hauptname in der gewählten Sprache. */
  main: string
  /** Eigene Übersetzung in Klammern, nur auf Deutsch und nur ohne offiziellen deutschen Namen. */
  hint?: string
}

/**
 * Name eines Eintrags in der gewählten Sprache.
 * Deutsch: offizieller deutscher Name, sonst der englische mit eigener Übersetzung in Klammern.
 * Englisch: immer der englische Name aus dem Spiel.
 */
export function displayName(entry: Named, lang: Lang): DisplayName {
  if (lang === 'en') return { main: entry.name }
  if (entry.nameDe) return { main: entry.nameDe }
  return entry.nameDeHint ? { main: entry.name, hint: entry.nameDeHint } : { main: entry.name }
}

/** Name als ein String, z. B. „Unearthly Bolt (Überirdischer Blitz)“. */
export function fullName(entry: Named, lang: Lang): string {
  const { main, hint } = displayName(entry, lang)
  return hint ? `${main} (${hint})` : main
}

/** Name für Fließtexte: ohne Klammer, damit Sätze lesbar bleiben. */
export function shortName(entry: Named, lang: Lang): string {
  return displayName(entry, lang).main
}

/** Alle Namen eines Eintrags, damit die Suche in beiden Sprachen findet. */
export function searchNames(entry: Named): string {
  return [entry.name, entry.nameDe, entry.nameDeHint].filter(Boolean).join(' ')
}

export function localize(text: LocalizedText | undefined, lang: Lang): string {
  return text ? text[lang] : ''
}

/** Sprache des Geräts als Vorgabe: Deutsch, wenn das Gerät auf Deutsch steht, sonst Englisch. */
export function detectLanguage(languages: readonly string[]): Lang {
  return languages.some((l) => l.toLowerCase().startsWith('de')) ? 'de' : 'en'
}
