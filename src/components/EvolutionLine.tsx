import type { Evolution } from '../data/types.ts'
import { useI18n } from '../i18n/index.ts'
import type { Catalog } from '../logic/catalog.ts'
import type { EvolutionCheck, RequirementCheck } from '../logic/evolution.ts'
import { characterHref, passiveHref, weaponHref } from '../state/route.ts'
import { EntryIcon, EntryName, Pill, UnverifiedBadge } from './ui.tsx'

function StateMark({ check }: { check?: RequirementCheck }) {
  const { t } = useI18n()
  if (!check) return null
  return check.owned ? (
    <span className="text-emerald-300" aria-label={t.owned}>
      ✓
    </span>
  ) : (
    <span className="text-red-300" aria-label={t.missingLabel}>
      ✗
    </span>
  )
}

function Chip({
  href,
  entry,
  check,
  highlight,
  extra,
}: {
  href: string
  entry: { name: string; nameDe?: string; nameDeHint?: string; emoji?: string; icon?: string; image?: string } | undefined
  check?: RequirementCheck
  highlight?: boolean
  /** Zusatz hinter dem Namen, z. B. „Max“ oder „wird verbraucht“. */
  extra?: string[]
}) {
  const tone =
    check && !check.owned
      ? 'ring-red-400/30 bg-red-500/5'
      : highlight
        ? 'ring-gold-500/50 bg-gold-500/10'
        : 'ring-white/10 bg-white/5'
  return (
    <a
      href={href}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-xl py-1 pr-2.5 pl-1 text-sm ring-1 hover:bg-white/10 ${tone}`}
    >
      {entry && <EntryIcon entry={entry} size="sm" />}
      {entry ? <EntryName entry={entry} className="truncate" /> : <span>?</span>}
      {extra?.map((text) => <Pill key={text}>{text}</Pill>)}
      <StateMark check={check} />
    </a>
  )
}

/**
 * Eine Entwicklung als Zeile: Zutaten + Ergebnis.
 * Mit `check` wird markiert, welche Zutaten im aktuellen Lauf schon da sind.
 *
 * Dass die Waffe auf Maximalstufe sein muss, gilt für fast jede Entwicklung
 * und steht deshalb nicht an jeder Waffe. Markiert werden nur Gegenstände,
 * die ausnahmsweise ebenfalls auf Maximalstufe sein müssen.
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
  const { t, text, shortName } = useI18n()
  const reqCheck = (type: 'weapon' | 'passive', id: string) =>
    check?.requirements.find((r) => r.type === type && r.id === id)
  const result = catalog.weapon(evolution.result)

  return (
    <div className="space-y-2">
      {showKind && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="gold">{t.kind[evolution.kind]}</Pill>
          <UnverifiedBadge verified={evolution.verified} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {evolution.weapons.map((w, i) => (
          <span key={w.id} className="contents">
            {i > 0 && <span className="text-white/40">+</span>}
            <Chip href={weaponHref(w.id)} entry={catalog.weapon(w.id)} check={reqCheck('weapon', w.id)} />
          </span>
        ))}
        {evolution.passives.map((p) => {
          const extra = [
            p.level === 'max' && (catalog.passive(p.id)?.maxLevel ?? 1) > 1 ? 'Max' : null,
            p.consumed ? t.consumed : null,
          ].filter((value): value is string => value !== null)
          return (
            <span key={p.id} className="contents">
              <span className="text-white/40">+</span>
              <Chip
                href={passiveHref(p.id)}
                entry={catalog.passive(p.id)}
                check={reqCheck('passive', p.id)}
                extra={extra}
              />
            </span>
          )
        })}
        <span className="px-0.5 text-gold-300" aria-label={t.resultsIn}>
          →
        </span>
        <Chip href={weaponHref(evolution.result)} entry={result} highlight />
      </div>
      {evolution.characters && (
        <p className="text-xs text-white/60">
          {t.onlyFor}{' '}
          {evolution.characters.map((id, i) => {
            const character = catalog.character(id)
            return (
              <span key={id}>
                {i > 0 && ', '}
                <a className="underline decoration-white/30 underline-offset-2 hover:text-white" href={characterHref(id)}>
                  {character ? shortName(character) : id}
                </a>
              </span>
            )
          })}
          .
        </p>
      )}
      {evolution.conditions && evolution.conditions.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-white/60">
          {evolution.conditions.map((c) => (
            <li key={c.en}>{text(c)}</li>
          ))}
        </ul>
      )}
      {evolution.note && <p className="text-xs text-white/45">{text(evolution.note)}</p>}
    </div>
  )
}
