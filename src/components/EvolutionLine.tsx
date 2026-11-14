import type { Evolution } from '../data/types.ts'
import { KIND_LABEL } from './evolutionText.ts'
import type { Catalog } from '../logic/catalog.ts'
import type { EvolutionCheck, RequirementCheck } from '../logic/evolution.ts'
import { characterHref, passiveHref, weaponHref } from '../state/route.ts'
import { EntryIcon, Pill, UnverifiedBadge } from './ui.tsx'

function StateMark({ check }: { check?: RequirementCheck }) {
  if (!check) return null
  if (check.state === 'ok') return <span className="text-emerald-300" aria-label="vorhanden">✓</span>
  if (check.state === 'level')
    return (
      <span className="text-amber-200 tabular-nums" aria-label={`Stufe ${check.level} von ${check.maxLevel}`}>
        {check.level}/{check.maxLevel}
      </span>
    )
  return <span className="text-red-300" aria-label="fehlt">✗</span>
}

function Chip({
  href,
  entry,
  requirement,
  check,
  highlight,
  extra,
}: {
  href: string
  entry: { name: string; emoji?: string; icon?: string } | undefined
  requirement?: 'max' | 'any'
  check?: RequirementCheck
  highlight?: boolean
  extra?: string
}) {
  const tone =
    check?.state === 'missing'
      ? 'ring-red-400/30 bg-red-500/5'
      : check?.state === 'level'
        ? 'ring-amber-300/30 bg-amber-400/5'
        : highlight
          ? 'ring-gold-500/50 bg-gold-500/10'
          : 'ring-white/10 bg-white/5'
  return (
    <a
      href={href}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-xl py-1 pr-2.5 pl-1 text-sm ring-1 hover:bg-white/10 ${tone}`}
    >
      {entry && <EntryIcon entry={entry} size="sm" />}
      <span className="truncate">{entry?.name ?? '?'}</span>
      {requirement === 'max' && <Pill>Max</Pill>}
      {extra && <Pill>{extra}</Pill>}
      <StateMark check={check} />
    </a>
  )
}

/**
 * Eine Entwicklung als Zeile: Zutaten + Ergebnis.
 * Mit `check` werden die Zutaten nach Stand im aktuellen Lauf eingefärbt.
 */
export function EvolutionLine({
  evolution,
  catalog,
  check,
  showKind = true,
}: {
  evolution: Evolution
  catalog: Catalog
  check?: EvolutionCheck
  showKind?: boolean
}) {
  const reqCheck = (type: 'weapon' | 'passive', id: string) =>
    check?.requirements.find((r) => r.type === type && r.id === id)
  const result = catalog.weapon(evolution.result)

  return (
    <div className="space-y-2">
      {showKind && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="gold">{KIND_LABEL[evolution.kind]}</Pill>
          <UnverifiedBadge verified={evolution.verified} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {evolution.weapons.map((w, i) => (
          <span key={w.id} className="contents">
            {i > 0 && <span className="text-white/40">+</span>}
            <Chip
              href={weaponHref(w.id)}
              entry={catalog.weapon(w.id)}
              requirement={(w.level ?? 'max') === 'max' && (catalog.weapon(w.id)?.maxLevel ?? 1) > 1 ? 'max' : undefined}
              check={reqCheck('weapon', w.id)}
            />
          </span>
        ))}
        {evolution.passives.map((p) => (
          <span key={p.id} className="contents">
            <span className="text-white/40">+</span>
            <Chip
              href={passiveHref(p.id)}
              entry={catalog.passive(p.id)}
              requirement={p.level === 'max' ? 'max' : undefined}
              check={reqCheck('passive', p.id)}
              extra={p.consumed ? 'wird verbraucht' : undefined}
            />
          </span>
        ))}
        <span className="px-0.5 text-gold-300" aria-label="ergibt">
          →
        </span>
        <Chip href={weaponHref(evolution.result)} entry={result} highlight />
      </div>
      {evolution.characters && (
        <p className="text-xs text-white/60">
          Nur für{' '}
          {evolution.characters.map((id, i) => (
            <span key={id}>
              {i > 0 && ', '}
              <a className="underline decoration-white/30 underline-offset-2 hover:text-white" href={characterHref(id)}>
                {catalog.character(id)?.name ?? id}
              </a>
            </span>
          ))}
          .
        </p>
      )}
      {evolution.conditions && evolution.conditions.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-white/60">
          {evolution.conditions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      {evolution.note && <p className="text-xs text-white/45">{evolution.note}</p>}
    </div>
  )
}
