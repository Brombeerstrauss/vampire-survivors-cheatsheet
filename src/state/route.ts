import { useEffect, useState } from 'react'

/**
 * Minimal hash routing (`#/run`, `#/characters/antonio-belpaese`).
 * Works without any server configuration, on GitHub Pages and offline.
 * The German paths of earlier versions (`#/lauf`, `#/charaktere`, …) still work.
 */
export type Route =
  | { view: 'characters'; id?: string }
  | { view: 'run' }
  | { view: 'library'; tab: 'weapons' | 'passives'; id?: string }
  | { view: 'settings' }

export function parseRoute(hash: string): Route {
  const [first, second] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  switch (first) {
    case 'run':
    case 'lauf':
      return { view: 'run' }
    case 'weapons':
    case 'waffen':
      return { view: 'library', tab: 'weapons', id: second || undefined }
    case 'items':
    case 'gegenstaende':
      return { view: 'library', tab: 'passives', id: second || undefined }
    case 'settings':
    case 'einstellungen':
      return { view: 'settings' }
    default:
      return { view: 'characters', id: second || undefined }
  }
}

export function routeHref(route: Route): string {
  switch (route.view) {
    case 'run':
      return '#/run'
    case 'settings':
      return '#/settings'
    case 'library': {
      const base = route.tab === 'weapons' ? '#/weapons' : '#/items'
      return route.id ? `${base}/${encodeURIComponent(route.id)}` : base
    }
    case 'characters':
      return route.id ? `#/characters/${encodeURIComponent(route.id)}` : '#/characters'
  }
}

export const weaponHref = (id: string) => routeHref({ view: 'library', tab: 'weapons', id })
export const passiveHref = (id: string) => routeHref({ view: 'library', tab: 'passives', id })
export const characterHref = (id: string) => routeHref({ view: 'characters', id })

export function navigate(route: Route): void {
  window.location.hash = routeHref(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
