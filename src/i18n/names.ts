import type { Lang, LocalizedText } from '../data/types.ts'

/** What an entry provides for displaying its name. */
export interface Named {
  name: string
  nameDe?: string
  nameDeHint?: string
}

export interface DisplayName {
  /** Main name in the selected language. */
  main: string
  /** Own translation in parentheses, only in German and only without an official German name. */
  hint?: string
}

/**
 * Name of an entry in the selected language.
 * German: the official German name, otherwise the English one with own translation in parentheses.
 * English: always the English name from the game.
 */
export function displayName(entry: Named, lang: Lang): DisplayName {
  if (lang === 'en') return { main: entry.name }
  if (entry.nameDe) return { main: entry.nameDe }
  return entry.nameDeHint ? { main: entry.name, hint: entry.nameDeHint } : { main: entry.name }
}

/** Name as one string, e.g. "Unearthly Bolt (Überirdischer Blitz)". */
export function fullName(entry: Named, lang: Lang): string {
  const { main, hint } = displayName(entry, lang)
  return hint ? `${main} (${hint})` : main
}

/** Name for running text: no parentheses, so sentences stay readable. */
export function shortName(entry: Named, lang: Lang): string {
  return displayName(entry, lang).main
}

/** All names of an entry, so search works in both languages. */
export function searchNames(entry: Named): string {
  return [entry.name, entry.nameDe, entry.nameDeHint].filter(Boolean).join(' ')
}

export function localize(text: LocalizedText | undefined, lang: Lang): string {
  return text ? text[lang] : ''
}
