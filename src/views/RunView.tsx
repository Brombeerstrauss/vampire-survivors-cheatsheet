import { useState, type ReactNode } from 'react'
import { EvolutionLine } from '../components/EvolutionLine.tsx'
import { readyText } from '../components/evolutionText.ts'
import { ItemPicker, type PickerItem } from '../components/Sheet.tsx'
import { Card, EmptyHint, EntryIcon, Pill, Section, SourceBadge } from '../components/ui.tsx'
import { buttonClass } from '../components/styles.ts'
import { MAX_PASSIVE_SLOTS, MAX_WEAPON_SLOTS } from '../data/types.ts'
import type { Catalog } from '../logic/catalog.ts'
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
  setPassiveLevel,
  setWeaponLevel,
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
      run.character ? 'Lauf zurückgesetzt, Startwaffe bleibt.' : 'Lauf zurückgesetzt.',
    )

  if (isRunEmpty(run)) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8 text-center">
        <p className="text-5xl" aria-hidden="true">
          🕯️
        </p>
        <h1 className="text-2xl font-bold">Neuer Lauf</h1>
        <p className="text-white/70">
          Wähle deinen Charakter. Danach trägst du hier ein, welche Waffen und Gegenstände du im Lauf schon hast, und
          siehst, was für die Entwicklungen noch fehlt.
        </p>
        <button type="button" className={buttonClass.primary} onClick={() => setPicker('character')}>
          Charakter wählen
        </button>
        <p className="text-sm text-white/50">
          Oder ohne Charakter starten:{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => setPicker('weapon')}>
            Waffe hinzufügen
          </button>
        </p>
        {picker && <Pickers picker={picker} onClose={() => setPicker(null)} tagsFor={tagsFor} />}
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="space-y-6">
        <Card className="flex items-center gap-3">
          {character ? (
            <a href={characterHref(character.id)} className="flex min-w-0 flex-1 items-center gap-3">
              <EntryIcon entry={character} />
              <span className="min-w-0">
                <span className="block text-xs text-white/50">Aktueller Lauf</span>
                <span className="block truncate font-semibold">{character.name}</span>
              </span>
            </a>
          ) : (
            <span className="flex-1 text-white/60">Kein Charakter gewählt</span>
          )}
          <button
            type="button"
            className={`${buttonClass.secondary} shrink-0 px-3`}
            onClick={() => setPicker('character')}
            aria-label={character ? 'Charakter wechseln' : 'Charakter wählen'}
          >
            👤<span className="hidden sm:inline">{character ? 'Wechseln' : 'Wählen'}</span>
          </button>
          <button
            type="button"
            className={`${buttonClass.secondary} shrink-0 px-3`}
            onClick={reset}
            aria-label="Lauf zurücksetzen"
          >
            ↺<span className="hidden sm:inline">Zurücksetzen</span>
          </button>
        </Card>

        <Section
          title="Waffen"
          aside={<SlotCounter used={run.weapons.length} max={MAX_WEAPON_SLOTS} />}
        >
          <div className="space-y-3">
            {run.weapons.map((item) => (
              <WeaponSlot key={item.id} item={item} run={run} />
            ))}
            <AddButton
              label="Waffe hinzufügen"
              full={freeWeaponSlots(run) === 0}
              fullLabel="Alle Waffen-Slots belegt"
              onClick={() => setPicker('weapon')}
            />
          </div>
        </Section>

        <Section
          title="Passive Gegenstände"
          aside={<SlotCounter used={usedPassiveSlots(run, fullCatalog)} max={MAX_PASSIVE_SLOTS} />}
        >
          <div className="space-y-3">
            {run.passives.map((item) => (
              <PassiveSlot key={item.id} item={item} run={run} />
            ))}
            <AddButton
              label="Gegenstand hinzufügen"
              full={!catalog.passives.some((p) => canAddPassive(run, fullCatalog, p.id))}
              fullLabel="Alle passiven Slots belegt"
              onClick={() => setPicker('passive')}
            />
          </div>
        </Section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4">
        <Section title="Als Nächstes">
          {warnings.map((w) => (
            <p key={w} className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              ⚠️ {w}
            </p>
          ))}
          {suggestions.length === 0 ? (
            <EmptyHint>
              {freeWeaponSlots(run) === 0 && freePassiveSlots(run, fullCatalog) === 0
                ? 'Alle Slots sind belegt.'
                : 'Gerade gibt es keine Vorschläge. Füge Waffen hinzu oder wähle einen Charakter mit Empfehlungen.'}
            </EmptyHint>
          ) : (
            <SuggestionList suggestions={suggestions} />
          )}
          {hints.map((h) => (
            <p key={h} className="rounded-xl bg-sky-500/10 p-3 text-sm text-sky-100 ring-1 ring-sky-400/20">
              ℹ️ {h}
            </p>
          ))}
          {!settings.ownedPacks.some((p) => p !== 'base') && (
            <p className="text-xs text-white/45">
              Tipp: In den <a className="underline" href="#/einstellungen">Einstellungen</a> kannst du deine DLCs
              auswählen.
            </p>
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

function LevelStepper({
  level,
  maxLevel,
  onChange,
  label,
}: {
  level: number
  maxLevel: number
  onChange: (level: number) => void
  label: string
}) {
  if (maxLevel <= 1) return <Pill>Einstufig</Pill>
  const atMax = level >= maxLevel
  const step = 'flex size-11 items-center justify-center rounded-xl bg-white/8 text-lg hover:bg-white/12 disabled:opacity-30'
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`Stufe von ${label}`}>
      <button type="button" className={step} onClick={() => onChange(level - 1)} disabled={level <= 1} aria-label="Stufe senken">
        −
      </button>
      <span className={`min-w-14 text-center text-sm tabular-nums ${atMax ? 'font-semibold text-gold-300' : ''}`}>
        {atMax ? 'Max' : `${level}/${maxLevel}`}
      </span>
      <button type="button" className={step} onClick={() => onChange(level + 1)} disabled={atMax} aria-label="Stufe erhöhen">
        +
      </button>
      {!atMax && (
        <button
          type="button"
          className="flex h-11 items-center rounded-xl bg-gold-500/15 px-2.5 text-xs font-semibold text-gold-300 hover:bg-gold-500/25"
          onClick={() => onChange(maxLevel)}
        >
          Max
        </button>
      )}
    </div>
  )
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} entfernen`}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white/40 hover:bg-white/8 hover:text-red-200"
    >
      ✕
    </button>
  )
}

/** Kopfzeile eines belegten Slots: Name, Entfernen, darunter (Handy) bzw. daneben (breiter) die Stufe. */
function SlotHeader({
  href,
  entry,
  badges,
  level,
  maxLevel,
  onLevel,
  onRemove,
}: {
  href: string
  entry: { name: string; emoji?: string; icon?: string }
  badges: ReactNode
  level: number
  maxLevel: number
  onLevel: (level: number) => void
  onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <a href={href} className="flex min-w-0 items-center gap-3">
        <EntryIcon entry={entry} />
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-semibold">{entry.name}</span>
          {badges}
        </span>
      </a>
      <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        <LevelStepper label={entry.name} level={level} maxLevel={maxLevel} onChange={onLevel} />
      </div>
      <div className="col-start-2 row-start-1 sm:col-start-3">
        <RemoveButton label={entry.name} onClick={onRemove} />
      </div>
    </div>
  )
}

function WeaponSlot({ item, run }: { item: OwnedItem; run: RunState }) {
  const { catalog, fullCatalog, updateRun } = useAppState()
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
            {weapon.kind === 'evolved' && <Pill tone="gold">entwickelt</Pill>}
            <SourceBadge source={weapon.source} />
          </>
        }
        level={item.level}
        maxLevel={weapon.maxLevel}
        onLevel={(level) => updateRun((r, cat) => setWeaponLevel(r, cat, item.id, level))}
        onRemove={() => updateRun((r) => removeWeapon(r, item.id), `${weapon.name} entfernt.`)}
      />
      {checks.length === 0 ? (
        <p className="text-sm text-white/50">
          {catalog.evolutionsFromWeapon(item.id).some((e) => run.weapons.some((w) => w.id === e.result))
            ? 'Bereits entwickelt.'
            : 'Keine Entwicklung.'}
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

function progressText(check: EvolutionCheck, catalog: Catalog): string {
  const name = (type: 'weapon' | 'passive', id: string) =>
    (type === 'weapon' ? catalog.weapon(id)?.name : catalog.passive(id)?.name) ?? id
  const parts = [
    ...check.missing.map((r) => `${name(r.type, r.id)} fehlt`),
    ...check.leveling.map((r) => `${name(r.type, r.id)} auf Stufe ${r.maxLevel} bringen (jetzt ${r.level})`),
  ]
  return parts.join(' · ')
}

function EvolutionStatus({ check }: { check: EvolutionCheck }) {
  const { catalog, updateRun } = useAppState()
  const result = catalog.weapon(check.evolution.result)
  if (!result) return null

  if (check.ready) {
    return (
      <div className="space-y-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
        <EvolutionLine evolution={check.evolution} catalog={catalog} check={check} />
        <p className="text-sm text-emerald-100">✨ {readyText(check.evolution, result.name)}</p>
        <button
          type="button"
          className={`${buttonClass.secondary} w-full sm:w-auto`}
          onClick={() =>
            updateRun(
              (r, cat) => applyEvolution(r, cat, check.evolution),
              `${result.name} eingetragen.`,
            )
          }
        >
          ✓ {result.name} erhalten
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <EvolutionLine evolution={check.evolution} catalog={catalog} check={check} />
      <p className="text-sm text-white/60">{progressText(check, catalog)}</p>
    </div>
  )
}

function PassiveSlot({ item, run }: { item: OwnedItem; run: RunState }) {
  const { catalog, fullCatalog, updateRun } = useAppState()
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
            {passive.noSlot && <Pill>ohne Slot</Pill>}
            <SourceBadge source={passive.source} />
          </>
        }
        level={item.level}
        maxLevel={passive.maxLevel}
        onLevel={(level) => updateRun((r, cat) => setPassiveLevel(r, cat, item.id, level))}
        onRemove={() => updateRun((r) => removePassive(r, item.id), `${passive.name} entfernt.`)}
      />
      {usedFor.length > 0 ? (
        <p className="text-sm text-white/60">
          Gebraucht für{' '}
          {usedFor.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <a href={weaponHref(e.result)} className="text-gold-300 hover:underline">
                {catalog.weapon(e.result)?.name ?? e.result}
              </a>
            </span>
          ))}
          {neededMax && item.level < passive.maxLevel && ' (auf Maximalstufe)'}
        </p>
      ) : (
        <p className="text-sm text-white/40">Für keine deiner Waffen nötig.</p>
      )}
    </Card>
  )
}

const SOURCE_LABEL = { evolution: 'Für Entwicklung', pairing: 'Passt zu deinen Gegenständen', recommendation: 'Empfohlen' } as const

function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  const { catalog, updateRun } = useAppState()
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? suggestions : suggestions.slice(0, 8)

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {visible.map((s) => {
          const entry = s.type === 'weapon' ? catalog.weapon(s.id) : catalog.passive(s.id)
          if (!entry) return null
          const add = () =>
            updateRun(
              (r, cat) => (s.type === 'weapon' ? addWeapon(r, cat, s.id) : addPassive(r, cat, s.id)),
              `${entry.name} hinzugefügt.`,
            )
          return (
            <li key={`${s.type}:${s.id}`} className="flex items-start gap-2 rounded-xl bg-night-800/70 p-2 ring-1 ring-white/8">
              <a href={s.type === 'weapon' ? weaponHref(s.id) : passiveHref(s.id)} className="flex min-w-0 flex-1 items-start gap-2.5">
                <EntryIcon entry={entry} size="sm" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{entry.name}</span>
                    <Pill tone={s.source === 'evolution' ? 'gold' : 'neutral'}>
                      {s.type === 'weapon' ? 'Waffe' : 'Gegenstand'}
                    </Pill>
                  </span>
                  <span className="block text-xs text-white/45">{SOURCE_LABEL[s.source]}</span>
                  <span className="block text-sm text-white/70">{s.reasons.join(' · ')}</span>
                </span>
              </a>
              <button
                type="button"
                onClick={add}
                aria-label={`${entry.name} zum Lauf hinzufügen`}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-xl text-gold-300 hover:bg-gold-500/25"
              >
                ＋
              </button>
            </li>
          )
        })}
      </ul>
      {suggestions.length > 8 && (
        <button type="button" className={`${buttonClass.ghost} w-full`} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Weniger anzeigen' : `Alle ${suggestions.length} Vorschläge anzeigen`}
        </button>
      )}
    </div>
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

  if (picker === 'character') {
    const items: PickerItem[] = catalog.characters
      .filter((c) => settings.showSecrets || !c.secret)
      .map((c) => ({
        ...c,
        detail: c.startingWeapons.map((id) => catalog.weapon(id)?.name ?? id).join(' + ') || 'Keine Startwaffe',
      }))
    return (
      <ItemPicker
        title="Charakter wählen"
        items={items}
        emptyText="Kein Charakter gefunden."
        onClose={onClose}
        onPick={(id) => {
          const name = catalog.character(id)?.name ?? id
          updateRun((_, cat) => startRun(cat, id), isRunEmpty(run) ? undefined : `Neuer Lauf mit ${name}.`)
          onClose()
        }}
      />
    )
  }

  const owned = new Set((picker === 'weapon' ? run.weapons : run.passives).map((i) => i.id))
  const tags = tagsFor(picker)
  const tagText = (s: Suggestion | undefined) =>
    s ? [s.source === 'recommendation' ? 'Empfohlen' : s.reasons[0]!] : undefined

  const items: PickerItem[] =
    picker === 'weapon'
      ? catalog.weapons
          .filter((w) => !owned.has(w.id))
          .map((w) => ({
            ...w,
            detail: w.kind === 'evolved' ? `Entwickelte Waffe · ${w.description}` : w.description,
            tags: tagText(tags.get(w.id)),
            rank: (tags.get(w.id)?.rank ?? 50) + (w.kind === 'evolved' ? 100 : 0),
          }))
      : catalog.passives
          .filter((p) => !owned.has(p.id) && canAddPassive(run, catalog, p.id))
          .map((p) => ({
            ...p,
            detail: p.stageOnly ? `Nur als Fundstück · ${p.description}` : p.description,
            tags: tagText(tags.get(p.id)),
            rank: tags.get(p.id)?.rank ?? 50,
          }))

  return (
    <ItemPicker
      title={picker === 'weapon' ? 'Waffe hinzufügen' : 'Gegenstand hinzufügen'}
      items={items}
      emptyText="Nichts gefunden."
      onClose={onClose}
      onPick={(id) => {
        updateRun((r, cat) => (picker === 'weapon' ? addWeapon(r, cat, id) : addPassive(r, cat, id)))
        onClose()
      }}
    />
  )
}
