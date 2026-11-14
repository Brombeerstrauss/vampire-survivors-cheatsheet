import { useState, type ReactNode } from 'react'
import { gameData } from '../data/index.ts'
import type { PackId } from '../data/types.ts'

const iconBase = `${import.meta.env.BASE_URL}custom-icons/`

/** Eigenes Icon aus `public/custom-icons/`, sonst das Platzhalter-Emoji. */
export function EntryIcon({
  entry,
  size = 'md',
}: {
  entry: { name: string; emoji?: string; icon?: string }
  size?: 'sm' | 'md' | 'lg'
}) {
  const [broken, setBroken] = useState(false)
  const box = { sm: 'size-8 text-lg', md: 'size-11 text-2xl', lg: 'size-16 text-4xl' }[size]
  return (
    <span
      className={`${box} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-night-700/80 ring-1 ring-white/10`}
      aria-hidden="true"
    >
      {entry.icon && !broken ? (
        <img
          src={iconBase + entry.icon}
          alt=""
          className="size-full object-contain [image-rendering:pixelated]"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="leading-none">{entry.emoji ?? '❔'}</span>
      )}
    </span>
  )
}

const packNames = new Map(gameData.packs.map((p) => [p.id, p.name]))

export function SourceBadge({ source }: { source: PackId }) {
  if (source === 'base') return null
  return (
    <span className="inline-flex items-center rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-medium text-violet-200 ring-1 ring-violet-400/20">
      {packNames.get(source) ?? source}
    </span>
  )
}

export function UnverifiedBadge({ verified }: { verified: boolean }) {
  if (verified) return null
  return (
    <span
      title="Dieser Eintrag ist noch nicht gegen das Wiki geprüft."
      className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-200 ring-1 ring-amber-400/25"
    >
      ungeprüft
    </span>
  )
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'red' }) {
  const tones = {
    neutral: 'bg-white/5 text-white/70 ring-white/10',
    gold: 'bg-gold-500/15 text-gold-300 ring-gold-500/30',
    red: 'bg-blood-500/15 text-red-200 ring-blood-500/30',
  }
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/40" aria-hidden="true">
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-white/10 bg-night-800 py-2.5 pr-3 pl-10 text-base text-white placeholder:text-white/40 focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/30 focus:outline-none"
      />
    </label>
  )
}

export function Section({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-gold-300 uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/8 bg-night-800/80 p-3 ${className}`}>{children}</div>
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-sm text-white/55">{children}</p>
}
