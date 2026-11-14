import { useMemo } from 'react'
import type { Lang, LocalizedText } from '../data/types.ts'
import { useAppState } from '../state/context.ts'
import { displayName, fullName, localize, shortName, type DisplayName, type Named } from './names.ts'
import { de, en, type Strings } from './strings.ts'

export interface I18n {
  lang: Lang
  /** UI texts. */
  t: Strings
  /** Name and optional translation in parentheses, kept apart for display. */
  name(entry: Named): DisplayName
  /** Name as one string, including the parentheses. */
  fullName(entry: Named): string
  /** Name for running text, without parentheses. */
  shortName(entry: Named): string
  /** Text from the data in the selected language. */
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
