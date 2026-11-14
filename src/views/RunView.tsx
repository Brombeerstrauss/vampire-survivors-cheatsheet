import { useState, type ReactNode } from 'react'
import { EvolutionLine } from '../components/EvolutionLine.tsx'
import { ItemPicker, type PickerItem } from '../components/Sheet.tsx'
import { Card, EmptyHint, EntryIcon, EntryName, Pill, Section, SourceBadge } from '../components/ui.tsx'
import { buttonClass } from '../components/styles.ts'
import { MAX_PASSIVE_SLOTS, MAX_WEAPON_SLOTS } from '../data/types.ts'
import { describeHint, describeReason, describeWarning, progressText, readyText } from '../i18n/describe.ts'
import { useI18n } from '../i18n/index.ts'
import type { Named } from '../i18n/names.ts'
import { evolutionsForOwnedWeapon, type EvolutionCheck } from '../logic/evolution.ts'
import {
  addPassive,
  addWeapon,
  applyEvolution,
  canAddPassive,
  EMPTY_RUN,
  freePassiveSlots,
  freeWeaponSlots,
  isRunEmpty,
  removePassive,
  removeWeapon,
  startRun,
  usedPassiveSlots,
  type OwnedItem,
  type RunState,
} from '../logic/run.ts'
import { suggestNext, type Suggestion } from '../logic/suggestions.ts'
import { useAppState } from '../state/context.ts'
import { characterHref, passiveHref, weaponHref } from '../state/route.ts'

type Picker = 'weapon' | 'passive' | 'character' | null

export function RunView() {
  const { catalog, fullCatalog, run, updateRun, settings } = useAppState()
  const i18n = useI18n()
  const { t } = i18n
  const [picker, setPicker] = useState<Picker>(null)
  const character = run.character ? fullCatalog.character(run.character) : undefined
  const { suggestions, warnings, hints } = suggestNext(run, catalog)

  const tagsFor = (type: 'weapon' | 'passive') => {
    const map = new Map<string, Suggestion>()
    for (const s of suggestions) if (s.type === type) map.set(s.id, s)
    return map
  }

  const reset = () =>
    updateRun(
      (_, cat) => (run.character ? startRun(cat, run.character) : EMPTY_RUN),
      run.character ? t.runResetKeepStart : t.runReset,
    )

  if (isRunEmpty(run)) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8 text-center">
        <p className="text-5xl" aria-hidden="true">
          🕯️
        </p>
        <h1 className="text-2xl font-bold">{t.newRun}</h1>
        <p className="text-white/70">{t.newRunIntro}</p>
        <button type="button" className={buttonClass.primary} onClick={() => setPicker('character')}>
          {t.chooseCharacter}
        </button>
        <p className="text-sm text-white/50">
          {t.orStartWithout}{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => setPicker('weapon')}>
            {t.addWeapon}
          </button>
        </p>
        {picker && <Pickers picker={picker} onClose={() => setPicker(null)} tagsFor={tagsFor} />}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="space-y-6">
        <Card className="flex items-center gap-3">
          {character ? (
            <a href={characterHref(character.id)} className="flex min-w-0 flex-1 items-center gap-3">
              <EntryIcon entry={character} />
              <span className="min-w-0">
                <span className="block text-xs text-white/50">{t.currentRun}</span>
                <EntryName entry={character} className="block truncate font-semibold" />
              </span>
            </a>
          ) : (
            <span className="flex-1 text-white/60">{t.noCharacterChosen}</span>
          )}
          <button
            type="button"
            className={`${buttonClass.secondary} shrink-0 px-3`}
            onClick={() => setPicker('character')}
            aria-label={character ? t.changeCharacter : t.chooseCharacter}
          >
            👤<span className="hidden sm:inline">{character ? t.change : t.choose}</span>
          </button>
          <button
            type="button"
            className={`${buttonClass.secondary} shrink-0 px-3`}
            onClick={reset}
            aria-label={t.resetRun}
          >
            ↺<span className="hidden sm:inline">{t.reset}</span>
          </button>
        </Card>

        <Section title={t.weapons} aside={<SlotCounter used={run.weapons.length} max={MAX_WEAPON_SLOTS} />}>
          <div className="space-y-3">
            {run.weapons.map((item) => (
              <WeaponSlot key={item.id} item={item} run={run} />
            ))}
            <AddButton
              label={t.addWeapon}
              full={freeWeaponSlots(run) === 0}
              fullLabel={t.weaponSlotsFull}
              onClick={() => setPicker('weapon')}
            />
          </div>
        </Section>

        <Section
          title={t.passiveItems}
          aside={<SlotCounter used={usedPassiveSlots(run, fullCatalog)} max={MAX_PASSIVE_SLOTS} />}
        >
          <div className="space-y-3">
            {run.passives.map((item) => (
              <PassiveSlot key={item.id} item={item} run={run} />
            ))}
            <AddButton
              label={t.addItem}
              full={!catalog.passives.some((p) => canAddPassive(run, fullCatalog, p.id))}
              fullLabel={t.passiveSlotsFull}
              onClick={() => setPicker('passive')}
            />
          </div>
        </Section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4">
        <Section title={t.nextUp}>
          {warnings.map((w) => {
            const message = describeWarning(w, i18n, catalog)
            return (
              <p key={message} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                ⚠️ {message}
              </p>
            )
          })}
          {suggestions.length === 0 ? (
            <EmptyHint>
              {freeWeaponSlots(run) === 0 && freePassiveSlots(run, fullCatalog) === 0 ? t.allSlotsFull : t.noSuggestions}
            </EmptyHint>
          ) : (
            <SuggestionList suggestions={suggestions} />
          )}
          {hints.map((h) => {
            const message = describeHint(h, i18n, catalog)
            return (
              <p key={message} className="rounded-xl bg-sky-500/10 p-3 text-sm text-sky-100 ring-1 ring-sky-400/20">
                ℹ️ {message}
              </p>
            )
          })}
          {!settings.ownedPacks.some((p) => p !== 'base') && (
            <a className="block text-xs text-white/45 underline underline-offset-2" href="#/settings">
              {t.dlcTip}
            </a>
          )}
        </Section>
      </aside>

      {picker && <Pickers picker={picker} onClose={() => setPicker(null)} tagsFor={tagsFor} />}
    </div>
  )
}

function SlotCounter({ used, max }: { used: number; max: number }) {
  return (
    <span className={`text-sm tabular-nums ${used >= max ? 'text-amber-200' : 'text-white/50'}`}>
      {used}/{max}
    </span>
  )
}

function AddButton({ label, full, fullLabel, onClick }: { label: string; full: boolean; fullLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={full}
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-white/70 hover:border-gold-500/50 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-white/20 disabled:hover:text-white/70"
    >
      {full ? fullLabel : `＋ ${label}`}
    </button>
  )
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white/40 hover:bg-white/8 hover:text-red-200"
    >
      ✕
    </button>
  )
}

/** Header of a filled slot: image, name, remove button. */
function SlotHeader({
  href,
  entry,
  badges,
  onRemove,
}: {
  href: string
  entry: Named & { emoji?: string; icon?: string; image?: string }
  badges: ReactNode
  onRemove: () => void
}) {
  const { t, shortName } = useI18n()
  return (
    <div className="flex items-center gap-2">
      <a href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <EntryIcon entry={entry} />
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <EntryName entry={entry} className="font-semibold" />
          {badges}
        </span>
      </a>
      <RemoveButton label={t.remove(shortName(entry))} onClick={onRemove} />
    </div>
  )
}

function WeaponSlot({ item, run }: { item: OwnedItem; run: RunState }) {
  const { catalog, fullCatalog, updateRun } = useAppState()
  const { t, shortName } = useI18n()
  const weapon = fullCatalog.weapon(item.id)
  if (!weapon) return null
  const checks = evolutionsForOwnedWeapon(item.id, run, catalog).filter((c) => !c.done)

  return (
    <Card className="space-y-3">
      <SlotHeader
        href={weaponHref(weapon.id)}
        entry={weapon}
        badges={
          <>
            {weapon.kind === 'evolved' && <Pill tone="gold">{t.evolved}</Pill>}
            <SourceBadge source={weapon.source} />
          </>
        }
        onRemove={() => updateRun((r) => removeWeapon(r, item.id), t.removed(shortName(weapon)))}
      />
      {checks.length === 0 ? (
        <p className="text-sm text-white/50">
          {catalog.evolutionsFromWeapon(item.id).some((e) => run.weapons.some((w) => w.id === e.result))
            ? t.alreadyEvolved
            : t.noEvolutionShort}
        </p>
      ) : (
        <div className="space-y-3 border-t border-white/8 pt-3">
          {checks.map((check) => (
            <EvolutionStatus key={check.evolution.id} check={check} />
          ))}
        </div>
      )}
    </Card>
  )
}

function EvolutionStatus({ check }: { check: EvolutionCheck }) {
  const { catalog, updateRun } = useAppState()
  const i18n = useI18n()
  const result = catalog.weapon(check.evolution.result)
  if (!result) return null
  const resultName = i18n.shortName(result)

  if (check.ready) {
    return (
      <div className="space-y-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
        <EvolutionLine evolution={check.evolution} catalog={catalog} check={check} />
        <p className="text-sm text-emerald-100">✨ {readyText(check, i18n, catalog)}</p>
        <button
          type="button"
          className={`${buttonClass.secondary} w-full sm:w-auto`}
          onClick={() =>
            updateRun((r, cat) => applyEvolution(r, cat, check.evolution), i18n.t.evolutionAdded(resultName))
          }
        >
          {i18n.t.gotEvolution(resultName)}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <EvolutionLine evolution={check.evolution} catalog={catalog} check={check} />
      <p className="text-sm text-white/60">{progressText(check, i18n, catalog)}</p>
    </div>
  )
}

function PassiveSlot({ item, run }: { item: OwnedItem; run: RunState }) {
  const { catalog, fullCatalog, updateRun } = useAppState()
  const { t, shortName } = useI18n()
  const passive = fullCatalog.passive(item.id)
  if (!passive) return null
  const owned = new Set(run.weapons.map((w) => w.id))
  const usedFor = catalog
    .evolutionsWithPassive(item.id)
    .filter((e) => e.weapons.some((w) => owned.has(w.id)) && !owned.has(e.result))
  const neededMax = usedFor.some((e) => e.passives.some((p) => p.id === item.id && p.level === 'max'))

  return (
    <Card className="space-y-2">
      <SlotHeader
        href={passiveHref(passive.id)}
        entry={passive}
        badges={
          <>
            {passive.noSlot && <Pill>{t.noSlot}</Pill>}
            <SourceBadge source={passive.source} />
          </>
        }
        onRemove={() => updateRun((r) => removePassive(r, item.id), t.removed(shortName(passive)))}
      />
      {usedFor.length > 0 ? (
        <p className="text-sm text-white/60">
          {t.neededFor}{' '}
          {usedFor.map((e, i) => {
            const result = catalog.weapon(e.result)
            return (
              <span key={e.id}>
                {i > 0 && ', '}
                <a href={weaponHref(e.result)} className="text-gold-300 hover:underline">
                  {result ? shortName(result) : e.result}
                </a>
              </span>
            )
          })}
          {neededMax && t.atMaxLevel}
        </p>
      ) : (
        <p className="text-sm text-white/40">{t.notNeeded}</p>
      )}
    </Card>
  )
}

/** All suggestions, always fully expanded. */
function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  const { catalog, updateRun } = useAppState()
  const i18n = useI18n()
  const { t } = i18n

  return (
    <ul className="space-y-1.5">
      {suggestions.map((s) => {
        const entry = s.type === 'weapon' ? catalog.weapon(s.id) : catalog.passive(s.id)
        if (!entry) return null
        const name = i18n.shortName(entry)
        const add = () =>
          updateRun(
            (r, cat) => (s.type === 'weapon' ? addWeapon(r, cat, s.id) : addPassive(r, cat, s.id)),
            t.added(name),
          )
        return (
          <li key={`${s.type}:${s.id}`} className="flex items-start gap-2 rounded-xl bg-night-800/70 p-2 ring-1 ring-white/8">
            <a href={s.type === 'weapon' ? weaponHref(s.id) : passiveHref(s.id)} className="flex min-w-0 flex-1 items-start gap-2.5">
              <EntryIcon entry={entry} size="sm" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <EntryName entry={entry} className="font-medium" />
                  <Pill tone={s.source === 'evolution' ? 'gold' : 'neutral'}>{s.type === 'weapon' ? t.weapon : t.item}</Pill>
                </span>
                <span className="block text-xs text-white/45">{t.suggestionSource[s.source]}</span>
                <span className="block text-sm text-white/70">
                  {s.reasons.map((r) => describeReason(r, i18n, catalog)).join(' · ')}
                </span>
              </span>
            </a>
            <button
              type="button"
              onClick={add}
              aria-label={t.addToRun(name)}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-xl text-gold-300 hover:bg-gold-500/25"
            >
              ＋
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Pickers({
  picker,
  onClose,
  tagsFor,
}: {
  picker: Exclude<Picker, null>
  onClose: () => void
  tagsFor: (type: 'weapon' | 'passive') => Map<string, Suggestion>
}) {
  const { catalog, run, updateRun, settings } = useAppState()
  const i18n = useI18n()
  const { t, text, shortName } = i18n

  if (picker === 'character') {
    const items: PickerItem[] = catalog.characters
      .filter((c) => settings.showSecrets || !c.secret)
      .map((c) => ({
        ...c,
        detail:
          c.startingWeapons
            .map((id) => {
              const weapon = catalog.weapon(id)
              return weapon ? shortName(weapon) : id
            })
            .join(' + ') || t.noStartingWeapon,
      }))
    return (
      <ItemPicker
        title={t.chooseCharacter}
        items={items}
        emptyText={t.noCharacterFound}
        onClose={onClose}
        onPick={(id) => {
          const chosen = catalog.character(id)
          const name = chosen ? shortName(chosen) : id
          updateRun((_, cat) => startRun(cat, id), isRunEmpty(run) ? undefined : t.newRunWith(name))
          onClose()
        }}
      />
    )
  }

  const owned = new Set((picker === 'weapon' ? run.weapons : run.passives).map((i) => i.id))
  const tags = tagsFor(picker)
  const tagText = (s: Suggestion | undefined) =>
    s ? [s.source === 'recommendation' ? t.recommended : describeReason(s.reasons[0]!, i18n, catalog)] : undefined

  const items: PickerItem[] =
    picker === 'weapon'
      ? catalog.weapons
          .filter((w) => !owned.has(w.id))
          .map((w) => ({
            ...w,
            detail: (w.kind === 'evolved' ? t.evolvedWeaponPrefix : '') + text(w.description),
            tags: tagText(tags.get(w.id)),
            rank: (tags.get(w.id)?.rank ?? 50) + (w.kind === 'evolved' ? 100 : 0),
          }))
      : catalog.passives
          .filter((p) => !owned.has(p.id) && canAddPassive(run, catalog, p.id))
          .map((p) => ({
            ...p,
            detail: (p.stageOnly ? t.stageOnlyPrefix : '') + text(p.description),
            tags: tagText(tags.get(p.id)),
            rank: tags.get(p.id)?.rank ?? 50,
          }))

  return (
    <ItemPicker
      title={picker === 'weapon' ? t.addWeapon : t.addItem}
      items={items}
      emptyText={t.nothingFound}
      onClose={onClose}
      onPick={(id) => {
        updateRun((r, cat) => (picker === 'weapon' ? addWeapon(r, cat, id) : addPassive(r, cat, id)))
        onClose()
      }}
    />
  )
}
