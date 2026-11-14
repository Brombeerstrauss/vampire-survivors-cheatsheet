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
import type { Character, PassiveItem, Weapon } from '../data/types.ts'
import { useAppState } from '../state/context.ts'
import { characterHref, passiveHref, routeHref, weaponHref } from '../state/route.ts'

type WeaponFilter = 'all' | 'base' | 'evolved'

export function LibraryView({ tab, selectedId }: { tab: 'weapons' | 'passives'; selectedId?: string }) {
  const { catalog } = useAppState()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<WeaponFilter>('all')

  const weapons = catalog.weapons.filter(
    (w) => (filter === 'all' || w.kind === filter) && (matches(w.name, query) || matches(w.description, query)),
  )
  const passives = catalog.passives.filter((p) => matches(p.name, query) || matches(p.description, query))
  const selectedWeapon = tab === 'weapons' && selectedId ? catalog.weapon(selectedId) : undefined
  const selectedPassive = tab === 'passives' && selectedId ? catalog.passive(selectedId) : undefined
  const hasSelection = Boolean(selectedWeapon || selectedPassive)

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start">
      <div className={`space-y-3 ${hasSelection ? 'hidden md:block' : ''}`}>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-night-800 p-1" role="tablist" aria-label="Bibliothek">
          {(
            [
              ['weapons', 'Waffen'],
              ['passives', 'Gegenstände'],
            ] as const
          ).map(([value, label]) => (
            <a
              key={value}
              role="tab"
              aria-selected={tab === value}
              href={routeHref({ view: 'library', tab: value })}
              className={`rounded-lg py-2 text-center text-sm font-medium ${
                tab === value ? 'bg-night-700 text-gold-300 shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              {label}
            </a>
          ))}
        </div>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={tab === 'weapons' ? 'Waffe suchen' : 'Gegenstand suchen'}
        />
        {tab === 'weapons' && (
          <div className="flex gap-1.5" role="group" aria-label="Waffenart">
            {(
              [
                ['all', 'Alle'],
                ['base', 'Basis'],
                ['evolved', 'Entwickelt'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-9 rounded-full px-3 text-sm ring-1 ${
                  filter === value ? 'bg-gold-500/15 text-gold-300 ring-gold-500/40' : 'text-white/60 ring-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <ul className="space-y-1.5 md:max-h-[calc(100dvh-16rem)] md:overflow-y-auto md:pr-1">
          {(tab === 'weapons' ? weapons : passives).map((entry) => (
            <li key={entry.id}>
              <a
                href={tab === 'weapons' ? weaponHref(entry.id) : passiveHref(entry.id)}
                aria-current={entry.id === selectedId ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-2xl border p-2.5 ${
                  entry.id === selectedId
                    ? 'border-gold-500/50 bg-gold-500/10'
                    : 'border-white/8 bg-night-800/70 hover:bg-night-700/70'
                }`}
              >
                <EntryIcon entry={entry} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{entry.name}</span>
                    {'kind' in entry && entry.kind === 'evolved' && <Pill tone="gold">entwickelt</Pill>}
                    <SourceBadge source={entry.source} />
                  </span>
                  <span className="block truncate text-sm text-white/55">{entry.description}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        {(tab === 'weapons' ? weapons : passives).length === 0 && <EmptyHint>Nichts gefunden.</EmptyHint>}
      </div>

      <div className={hasSelection ? '' : 'hidden md:block'}>
        {selectedWeapon ? (
          <WeaponDetail weapon={selectedWeapon} />
        ) : selectedPassive ? (
          <PassiveDetail passive={selectedPassive} />
        ) : (
          <EmptyHint>Wähle links einen Eintrag, um Entwicklung und passende Charaktere zu sehen.</EmptyHint>
        )}
      </div>
    </div>
  )
}

function DetailHeader({ entry, children }: { entry: Weapon | PassiveItem; children?: React.ReactNode }) {
  return (
    <header className="flex items-start gap-4">
      <EntryIcon entry={entry} size="lg" />
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl leading-tight font-bold">{entry.name}</h1>
        <div className="flex flex-wrap gap-1.5">
          {children}
          <Pill>Max. Stufe {entry.maxLevel}</Pill>
          <SourceBadge source={entry.source} />
          <UnverifiedBadge verified={entry.verified} />
        </div>
        <p className="text-white/80">{entry.description}</p>
        {entry.note && <p className="text-sm text-white/50">{entry.note}</p>}
      </div>
    </header>
  )
}

function WeaponDetail({ weapon }: { weapon: Weapon }) {
  const { catalog, settings } = useAppState()
  const evolvesInto = catalog.evolutionsFromWeapon(weapon.id)
  const comesFrom = catalog.evolutionsToWeapon(weapon.id)
  const visible = (c: Character) => settings.showSecrets || !c.secret
  const starters = catalog.charactersStartingWith(weapon.id).filter(visible)
  const recommenders = catalog.charactersRecommending(weapon.id).filter(visible)

  return (
    <article className="space-y-6">
      <a href={routeHref({ view: 'library', tab: 'weapons' })} className={`${buttonClass.ghost} -ml-3 md:hidden`}>
        ‹ Alle Waffen
      </a>
      <DetailHeader entry={weapon}>
        <Pill tone={weapon.kind === 'evolved' ? 'gold' : 'neutral'}>
          {weapon.kind === 'evolved' ? 'Entwickelte Waffe' : 'Basiswaffe'}
        </Pill>
      </DetailHeader>

      {comesFrom.length > 0 && (
        <Section title="So bekommst du sie">
          <div className="space-y-3">
            {comesFrom.map((evo) => (
              <Card key={evo.id}>
                <EvolutionLine evolution={evo} catalog={catalog} />
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title="Entwicklung">
        {evolvesInto.length === 0 ? (
          <EmptyHint>
            {weapon.kind === 'evolved'
              ? 'Entwickelt sich nicht weiter.'
              : 'Diese Waffe hat keine Entwicklung (mit deinen freigeschalteten Inhalten).'}
          </EmptyHint>
        ) : (
          <div className="space-y-3">
            {evolvesInto.map((evo) => (
              <Card key={evo.id}>
                <EvolutionLine evolution={evo} catalog={catalog} />
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Passt gut zu">
        <CharacterReasons
          weaponOrPassiveId={weapon.id}
          starters={starters}
          recommenders={recommenders}
          empty="Bisher bei keinem Charakter als Empfehlung hinterlegt."
        />
      </Section>
    </article>
  )
}

function PassiveDetail({ passive }: { passive: PassiveItem }) {
  const { catalog, settings } = useAppState()
  const usedIn = catalog.evolutionsWithPassive(passive.id)
  const recommenders = catalog.charactersRecommending(passive.id).filter((c) => settings.showSecrets || !c.secret)

  return (
    <article className="space-y-6">
      <a href={routeHref({ view: 'library', tab: 'passives' })} className={`${buttonClass.ghost} -ml-3 md:hidden`}>
        ‹ Alle Gegenstände
      </a>
      <DetailHeader entry={passive}>
        {passive.stageOnly && <Pill tone="gold">Nur als Fundstück</Pill>}
        {passive.noSlot && <Pill>Belegt keinen Slot</Pill>}
      </DetailHeader>

      <Section title="Gebraucht für">
        {usedIn.length === 0 ? (
          <EmptyHint>Wird für keine Entwicklung gebraucht (mit deinen freigeschalteten Inhalten).</EmptyHint>
        ) : (
          <div className="space-y-3">
            {usedIn.map((evo) => (
              <Card key={evo.id}>
                <EvolutionLine evolution={evo} catalog={catalog} />
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Empfohlen für">
        <CharacterReasons
          weaponOrPassiveId={passive.id}
          starters={[]}
          recommenders={recommenders}
          empty="Bisher bei keinem Charakter als Empfehlung hinterlegt."
        />
      </Section>
    </article>
  )
}

function CharacterReasons({
  weaponOrPassiveId,
  starters,
  recommenders,
  empty,
}: {
  weaponOrPassiveId: string
  starters: Character[]
  recommenders: Character[]
  empty: string
}) {
  const { catalog } = useAppState()
  const rows = new Map<string, { character: Character; reasons: string[] }>()
  for (const c of starters) rows.set(c.id, { character: c, reasons: ['Startwaffe'] })
  for (const c of recommenders) {
    const reasons = catalog
      .recommendationsFor(c.id)
      .flatMap((r) => [...r.weapons, ...r.passives])
      .filter((item) => item.id === weaponOrPassiveId)
      .map((item) => item.reason)
    const row = rows.get(c.id) ?? { character: c, reasons: [] }
    // „Startwaffe“ nicht doppelt nennen, wenn die Empfehlung es schon sagt
    if (reasons.some((r) => r.startsWith('Startwaffe'))) row.reasons = row.reasons.filter((r) => r !== 'Startwaffe')
    for (const reason of reasons) if (!row.reasons.includes(reason)) row.reasons.push(reason)
    rows.set(c.id, row)
  }

  if (rows.size === 0) return <EmptyHint>{empty}</EmptyHint>
  return (
    <ul className="space-y-1.5">
      {[...rows.values()].map(({ character, reasons }) => (
        <li key={character.id}>
          <a href={characterHref(character.id)} className="flex items-start gap-3 rounded-xl p-2 hover:bg-white/5">
            <EntryIcon entry={character} size="sm" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{character.name}</span>
                <SourceBadge source={character.source} />
              </span>
              <span className="block text-sm text-white/60">{reasons.join(' · ')}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
