// Shared classes and helpers for the UI.

export const buttonClass = {
  primary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 font-semibold text-night-950 active:scale-[0.98] hover:bg-gold-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300',
  secondary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/8 px-4 font-medium text-white ring-1 ring-white/10 active:scale-[0.98] hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300',
  ghost:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-white/70 hover:bg-white/8 hover:text-white focus-visible:outline-2 focus-visible:outline-gold-300',
}

/** Normalizes text for search: ignores case and accents. */
export function matches(text: string, query: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
  const q = norm(query.trim())
  return q === '' || norm(text).includes(q)
}
