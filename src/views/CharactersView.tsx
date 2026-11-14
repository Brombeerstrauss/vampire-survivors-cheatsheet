import { useState } from 'react'
import { EvolutionLine } from '../components/EvolutionLine.tsx'
import {
  Card,
  EmptyHint,
  EntryIcon,
  Pill,
  SearchField,
  Section,
  SourceBadge,
  UnverifiedBadge,
} from '../components/ui.tsx'
import { buttonClass, matches } from '../components/styles.ts'
import type { Character, RecommendedItem } from '../data/types.ts'
import type { Catalog } from '../logic/catalog.ts'
import { isRunEmpty, startRun } from '../logic/run.ts'
import { useAppState } from '../state/context.ts'
import { characterHref, navigate, passiveHref, weaponHref } from '../state/route.ts'

export function CharactersView({ selectedId }: { selectedId?: string }) {
  const { catalog, settings } = useAppState()
  const [query, setQuery] = useState('')

  const selected = selectedId ? catalog.character(selectedId) : undefined
  const visible = catalog.characters.filter(
    (c) =>
      (settings.showSecrets || !c.secret || c.id === selectedId) &&
      (matches(c.name, query) ||
        c.startingWeapons.some((w) => matches(catalog.weapon(w)?.name ?? '', query))),
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start">
      <div className={`space-y-3 ${selected ? 'hidden md:block' : ''}`}>
        <SearchField value={query} onChange={setQuery} placeholder="Charakter oder Waffe suchen" />
        <p className="text-xs text-white/50">
          {visible.length} von {catalog.characters.length} Charakteren
          {!settings.showSecrets && ' (geheime ausgeblendet)'}
        </p>
        {visible.length === 0 ? (
          <EmptyHint>Kein Charakter passt zur Suche.</EmptyHint>
        ) : (
          <ul className="space-y-1.5 md:max-h-[calc(100dvh-12rem)] md:overflow-y-auto md:pr-1">
            {visible.map((c) => (
              <li key={c.id}>
                <CharacterRow character={c} catalog={catalog} active={c.id === selectedId} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={selected ? '' : 'hidden md:block'}>
        {selected ? (
          <CharacterDetail character={selected} />
        ) : (
          <EmptyHint>Wähle links einen Charakter, um Startwaffe, Entwicklung und Empfehlungen zu sehen.</EmptyHint>
        )}
      </div>
    </div>
  )
}

function CharacterRow({ character, catalog, active }: { character: Character; catalog: Catalog; active: boolean }) {
  const weapons = character.startingWeapons.map((id) => catalog.weapon(id)?.name ?? id)
  return (
    <a
      href={characterHref(character.id)}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-2xl border p-2.5 transition-colors ${
        active ? 'border-gold-500/50 bg-gold-500/10' : 'border-white/8 bg-night-800/70 hover:bg-night-700/70'
      }`}
    >
      <EntryIcon entry={character} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{character.name}</span>
          {character.secret && <Pill>geheim</Pill>}
          <SourceBadge source={character.source} />
        </span>
        <span className="block truncate text-sm text-white/55">
          {weapons.length > 0 ? weapons.join(' + ') : 'Keine Startwaffe'}
        </span>
      </span>
      <span className="text-white/30" aria-hidden="true">
        ›
      </span>
    </a>
  )
}

function CharacterDetail({ character }: { character: Character }) {
  const { catalog, run, updateRun } = useAppState()
  const recommendations = catalog.recommendationsFor(character.id)
  const recWeapons = mergeRecommended(recommendations.flatMap((r) => r.weapons))
  const recPassives = mergeRecommended(recommendations.flatMap((r) => r.passives))
  const summaries = recommendations.map((r) => r.summary).filter(Boolean)

  const start = () => {
    const replacing = !isRunEmpty(run)
    updateRun(
      (_, cat) => startRun(cat, character.id),
      replacing ? `Neuer Lauf mit ${character.name} gestartet.` : undefined,
    )
    navigate({ view: 'run' })
  }

  return (
    <article className="space-y-6">
      <a href="#/charaktere" className={`${buttonClass.ghost} -ml-3 md:hidden`}>
        ‹ Alle Charaktere
      </a>

      <header className="flex items-start gap-4">
        <EntryIcon entry={character} size="lg" />
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl leading-tight font-bold">{character.name}</h1>
          <div className="flex flex-wrap gap-1.5">
            {character.secret && <Pill>geheim</Pill>}
            <SourceBadge source={character.source} />
            <UnverifiedBadge verified={character.verified} />
          </div>
          <p className="text-white/80">{character.bonus}</p>
          {character.note && <p className="text-sm text-white/50">{character.note}</p>}
        </div>
      </header>

      <button type="button" className={`${buttonClass.primary} w-full sm:w-auto`} onClick={start}>
        Lauf mit {character.name.split(' ')[0]} starten
      </button>

      <Section title={character.startingWeapons.length > 1 ? 'Startwaffen' : 'Startwaffe'}>
        {character.startingWeapons.length === 0 ? (
          <EmptyHint>{character.name} startet ohne sichtbare Waffe.</EmptyHint>
        ) : (
          <div className="space-y-3">
            {character.startingWeapons.map((id) => (
              <StartingWeapon key={id} weaponId={id} characterId={character.id} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Empfehlungen">
        {recWeapons.length === 0 && recPassives.length === 0 ? (
          <EmptyHint>Für {character.name} sind noch keine Empfehlungen hinterlegt.</EmptyHint>
        ) : (
          <div className="space-y-4">
            {summaries.map((s) => (
              <p key={s} className="text-white/80">
                {s}
              </p>
            ))}
            <div className="grid gap-4 lg:grid-cols-2">
              <RecommendedList title="Waffen" items={recWeapons} type="weapon" />
              <RecommendedList title="Passive Gegenstände" items={recPassives} type="passive" />
            </div>
          </div>
        )}
      </Section>
    </article>
  )
}

function StartingWeapon({ weaponId, characterId }: { weaponId: string; characterId: string }) {
  const { catalog } = useAppState()
  const weapon = catalog.weapon(weaponId)
  if (!weapon) return null
  const evolutions = catalog
    .evolutionsFromWeapon(weaponId)
    .filter((e) => !e.characters || e.characters.includes(characterId))

  return (
    <Card className="space-y-3">
      <a href={weaponHref(weapon.id)} className="flex items-center gap-3">
        <EntryIcon entry={weapon} />
        <span>
          <span className="block font-semibold">{weapon.name}</span>
          <span className="block text-sm text-white/60">{weapon.description}</span>
        </span>
      </a>
      {evolutions.length === 0 ? (
        <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70">
          {weapon.kind === 'evolved'
            ? 'Startet bereits als entwickelte Waffe.'
            : 'Diese Waffe hat keine Entwicklung.'}
        </p>
      ) : (
        <div className="space-y-3 border-t border-white/8 pt-3">
          {evolutions.map((evo) => (
            <EvolutionLine key={evo.id} evolution={evo} catalog={catalog} />
          ))}
        </div>
      )}
    </Card>
  )
}

/** Fasst Empfehlungen aus mehreren Paketen zusammen (wichtigste Priorität gewinnt). */
function mergeRecommended(items: RecommendedItem[]): RecommendedItem[] {
  const byId = new Map<string, RecommendedItem>()
  for (const item of items) {
    const existing = byId.get(item.id)
    if (!existing || item.priority < existing.priority) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => a.priority - b.priority)
}

const PRIORITY_LABEL = { 1: 'Kern', 2: 'Gut', 3: 'Optional' } as const

function RecommendedList({ title, items, type }: { title: string; items: RecommendedItem[]; type: 'weapon' | 'passive' }) {
  const { catalog } = useAppState()
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-white/70">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const entry = type === 'weapon' ? catalog.weapon(item.id) : catalog.passive(item.id)
          if (!entry) return null
          return (
            <li key={item.id}>
              <a
                href={type === 'weapon' ? weaponHref(item.id) : passiveHref(item.id)}
                className="flex items-start gap-3 rounded-xl p-2 hover:bg-white/5"
              >
                <EntryIcon entry={entry} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{entry.name}</span>
                    <Pill tone={item.priority === 1 ? 'gold' : 'neutral'}>{PRIORITY_LABEL[item.priority]}</Pill>
                  </span>
                  <span className="block text-sm text-white/60">{item.reason}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
