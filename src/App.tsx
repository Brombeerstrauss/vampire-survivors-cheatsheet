import { evolutionsForOwnedWeapon } from './logic/evolution.ts'
import { AppStateProvider } from './state/AppState.tsx'
import { useAppState } from './state/context.ts'
import { routeHref, useRoute, type Route } from './state/route.ts'
import { CharactersView } from './views/CharactersView.tsx'
import { LibraryView } from './views/LibraryView.tsx'
import { RunView } from './views/RunView.tsx'
import { SettingsView } from './views/SettingsView.tsx'

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  )
}

const NAV: { view: Route['view']; label: string; icon: string; route: Route }[] = [
  { view: 'characters', label: 'Charaktere', icon: '🧛', route: { view: 'characters' } },
  { view: 'run', label: 'Lauf', icon: '⚔️', route: { view: 'run' } },
  { view: 'library', label: 'Waffen', icon: '📜', route: { view: 'library', tab: 'weapons' } },
  { view: 'settings', label: 'Einstellungen', icon: '⚙️', route: { view: 'settings' } },
]

function Shell() {
  const route = useRoute()
  const { run, catalog, notice, dismissNotice } = useAppState()
  const ready = run.weapons.reduce(
    (sum, w) => sum + evolutionsForOwnedWeapon(w.id, run, catalog).filter((c) => c.ready).length,
    0,
  )

  return (
    <div className="min-h-dvh">
      <header
        className="sticky top-0 z-30 border-b border-white/8 bg-night-900/90 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div
          className="mx-auto flex h-14 max-w-6xl items-center gap-4"
          style={{
            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          <a href="#/charaktere" className="flex items-center gap-2 font-bold text-gold-300">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-7 rounded-lg" />
            VS Companion
          </a>
          <nav className="ml-auto hidden gap-1 md:flex" aria-label="Hauptnavigation">
            {NAV.map((item) => (
              <NavLink key={item.view} item={item} active={route.view === item.view} badge={item.view === 'run' ? ready : 0} />
            ))}
          </nav>
        </div>
      </header>

      <main
        className="mx-auto max-w-6xl pt-5 pb-28 md:pb-12"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        {route.view === 'characters' && <CharactersView selectedId={route.id} />}
        {route.view === 'run' && <RunView />}
        {route.view === 'library' && <LibraryView tab={route.tab} selectedId={route.id} />}
        {route.view === 'settings' && <SettingsView />}
      </main>

      {notice && (
        <div
          className="fixed inset-x-0 z-40 flex justify-center px-4 md:bottom-6"
          style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
          role="status"
        >
          <div className="flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-night-700 py-2 pr-2 pl-4 shadow-xl">
            <span className="text-sm">{notice.message}</span>
            {notice.undo && (
              <button
                type="button"
                className="min-h-10 rounded-xl px-3 text-sm font-semibold text-gold-300 hover:bg-white/8"
                onClick={() => {
                  notice.undo?.()
                  dismissNotice()
                }}
              >
                Rückgängig
              </button>
            )}
            <button type="button" aria-label="Meldung schließen" className="min-h-10 px-2 text-white/50" onClick={dismissNotice}>
              ✕
            </button>
          </div>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-night-900/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Hauptnavigation"
      >
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = route.view === item.view
            return (
              <a
                key={item.view}
                href={routeHref(item.route)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  active ? 'text-gold-300' : 'text-white/55'
                }`}
              >
                <span className={`text-xl ${active ? '' : 'opacity-70 grayscale'}`} aria-hidden="true">
                  {item.icon}
                </span>
                {item.view === 'settings' ? 'Mehr' : item.label}
                {item.view === 'run' && ready > 0 && <ReadyBadge count={ready} />}
              </a>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function ReadyBadge({ count }: { count: number }) {
  return (
    <span
      className="absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-emerald-500 px-1.5 text-center text-[11px] leading-5 font-bold text-night-950"
      aria-label={`${count} Entwicklung bereit`}
    >
      {count}
    </span>
  )
}

function NavLink({ item, active, badge }: { item: (typeof NAV)[number]; active: boolean; badge: number }) {
  return (
    <a
      href={routeHref(item.route)}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium ${
        active ? 'bg-white/8 text-gold-300' : 'text-white/65 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span aria-hidden="true">{item.icon}</span>
      {item.label}
      {badge > 0 && (
        <span className="rounded-full bg-emerald-500 px-1.5 text-[11px] leading-5 font-bold text-night-950">{badge}</span>
      )}
    </a>
  )
}
