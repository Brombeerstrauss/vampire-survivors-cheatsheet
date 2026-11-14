import type { Catalog } from '../logic/catalog.ts'
import type { EvolutionCheck } from '../logic/evolution.ts'
import type { SuggestionHint, SuggestionReason, SuggestionWarning } from '../logic/suggestions.ts'
import type { I18n } from './index.ts'

// Turns the building blocks from the logic into sentences in the selected language.
// Names in sentences have no translation in parentheses, so they stay readable.

const weaponName = (i18n: I18n, catalog: Catalog, id: string) => {
  const w = catalog.weapon(id)
  return w ? i18n.shortName(w) : id
}
const passiveName = (i18n: I18n, catalog: Catalog, id: string) => {
  const p = catalog.passive(id)
  return p ? i18n.shortName(p) : id
}

export function describeReason(reason: SuggestionReason, i18n: I18n, catalog: Catalog): string {
  const { t } = i18n
  switch (reason.type) {
    case 'missingFor':
      return t.reasonMissingFor(weaponName(i18n, catalog, reason.result))
    case 'unionPartner':
      return t.reasonUnionPartner(weaponName(i18n, catalog, reason.result))
    case 'pairing':
      return t.reasonPairing(passiveName(i18n, catalog, reason.passive), weaponName(i18n, catalog, reason.result))
    case 'recommended':
      return i18n.text(reason.text)
  }
}

export function describeWarning(warning: SuggestionWarning, i18n: I18n, catalog: Catalog): string {
  const { t } = i18n
  const results = (ids: string[]) => ids.map((id) => weaponName(i18n, catalog, id))
  switch (warning.type) {
    case 'passiveSlotsFull':
      return t.warnPassiveSlotsFull(results(warning.results), passiveName(i18n, catalog, warning.passive))
    case 'weaponSlotsFull':
      return t.warnWeaponSlotsFull(results(warning.results), weaponName(i18n, catalog, warning.weapon))
    case 'notEnoughPassiveSlots':
      return t.warnNotEnoughPassiveSlots(
        warning.needed.map((id) => passiveName(i18n, catalog, id)),
        warning.free,
      )
    case 'notEnoughWeaponSlots':
      return t.warnNotEnoughWeaponSlots(warning.needed.length, warning.free)
  }
}

export function describeHint(hint: SuggestionHint, i18n: I18n, catalog: Catalog): string {
  return i18n.t.hintStageOnly(passiveName(i18n, catalog, hint.passive))
}

/** What happens once all parts of an evolution are in the run. */
export function readyText(check: EvolutionCheck, i18n: I18n, catalog: Catalog): string {
  const { evolution, needsMax } = check
  if (evolution.kind === 'morph') return i18n.t.readyMorph
  const result = weaponName(i18n, catalog, evolution.result)
  const gift = evolution.kind === 'gift'
  const names = needsMax.map((r) =>
    r.type === 'weapon' ? weaponName(i18n, catalog, r.id) : passiveName(i18n, catalog, r.id),
  )
  return names.length === 0 ? i18n.t.readyNow(result, gift) : i18n.t.readyAfterMax(names, result, gift)
}

/** What is still missing for an evolution. */
export function progressText(check: EvolutionCheck, i18n: I18n, catalog: Catalog): string {
  return check.missing
    .map((r) => i18n.t.missing(r.type === 'weapon' ? weaponName(i18n, catalog, r.id) : passiveName(i18n, catalog, r.id)))
    .join(' · ')
}
