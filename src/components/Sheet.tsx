import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/index.ts'
import { searchNames } from '../i18n/names.ts'
import { buttonClass, matches } from './styles.ts'
import { EntryIcon, EntryName, Pill, SearchField, SourceBadge } from './ui.tsx'

/** Fenster, das auf dem Handy von unten hereinfährt und auf dem Desktop mittig erscheint. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n()
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const previousFocus = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('input, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label={t.close}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl border border-white/10 bg-night-900 shadow-2xl sm:max-w-lg sm:rounded-3xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" className={buttonClass.ghost} onClick={onClose}>
            {t.done}
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  )
}

export interface PickerItem {
  id: string
  name: string
  nameDe?: string
  nameDeHint?: string
  emoji?: string
  icon?: string
  image?: string
  source: string
  /** Zusatzinfo unter dem Namen. */
  detail?: string
  /** Hervorgehobene Hinweise, z. B. „Partner für Whip“. */
  tags?: string[]
  /** Sortierung nach den hervorgehobenen Einträgen; kleiner steht weiter oben. */
  rank?: number
}

/** Auswahl-Liste mit Suche; hervorgehobene Einträge stehen oben. */
export function ItemPicker({
  title,
  items,
  onPick,
  onClose,
  emptyText,
}: {
  title: string
  items: PickerItem[]
  onPick: (id: string) => void
  onClose: () => void
  emptyText: string
}) {
  const { t, fullName } = useI18n()
  const [query, setQuery] = useState('')
  const visible = items
    .filter((item) => matches(searchNames(item), query))
    .sort(
      (a, b) =>
        Math.sign(b.tags?.length ?? 0) - Math.sign(a.tags?.length ?? 0) ||
        (a.rank ?? 0) - (b.rank ?? 0) ||
        fullName(a).localeCompare(fullName(b)),
    )

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-3">
        <SearchField value={query} onChange={setQuery} placeholder={t.search} />
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/55">{emptyText}</p>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item.id)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/8 focus-visible:bg-white/8 focus-visible:outline-none"
                >
                  <EntryIcon entry={item} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <EntryName entry={item} className="font-medium" />
                      <SourceBadge source={item.source} />
                    </span>
                    {item.detail && <span className="block truncate text-xs text-white/55">{item.detail}</span>}
                    {item.tags && item.tags.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <Pill key={tag} tone="gold">
                            {tag}
                          </Pill>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="text-xl text-gold-300" aria-hidden="true">
                    ＋
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}
