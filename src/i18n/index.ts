import { useMemo } from 'react'
import type { Lang, LocalizedText } from '../data/types.ts'
import { useAppState } from '../state/context.ts'
import { displayName, fullName, localize, shortName, type DisplayName, type Named } from './names.ts'
import { de, en, type Strings } from './strings.ts'

export interface I18n {
  lang: Lang
  /** Texte der Oberfläche. */
  t: Strings
  /** Name mit eventueller Übersetzung in Klammern, getrennt für die Darstellung. */
  name(entry: Named): DisplayName
  /** Name als ein String inklusive Klammer. */
  fullName(entry: Named): string
  /** Name für Fließtexte, ohne Klammer. */
  shortName(entry: Named): string
  /** Text aus den Daten in der gewählten Sprache. */
  text(value: LocalizedText | undefined): string
}

const STRINGS: Record<Lang, Strings> = { de, en }

export function makeI18n(lang: Lang): I18n {
  return {
    lang,
    t: STRINGS[lang],
    name: (entry) => displayName(entry, lang),
    fullName: (entry) => fullName(entry, lang),
    shortName: (entry) => shortName(entry, lang),
    text: (value) => localize(value, lang),
  }
}

export function useI18n(): I18n {
  const { settings } = useAppState()
  return useMemo(() => makeI18n(settings.language), [settings.language])
}
