import * as React from 'react'

/**
 * A tiny built-in hash router — no router dependency. The active route is the
 * URL fragment (`#/all-users` → `all-users`); it survives refresh + deep-links
 * and reacts to browser back/forward via the `hashchange` event. The shell binds
 * its active nav key / tab to this so every page is linkable and the history
 * buttons work.
 */
const PREFIX = '#/'

/** Parse the current `window.location.hash` into a bare route key. */
export function routeFromHash(fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const raw = window.location.hash
  if (!raw || raw === '#' || raw === PREFIX) return fallback
  const key = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw.replace(/^#/, '')
  const decoded = decodeURIComponent(key).trim()
  return decoded || fallback
}

/** Serialize a route key into a hash string. */
export function hashFromRoute(key: string): string {
  return `${PREFIX}${encodeURIComponent(key)}`
}

export interface HashRoute {
  /** The current route key (in sync with the URL fragment). */
  route: string
  /** Navigate: pushes a new hash (adds a history entry → back/forward works). */
  navigate: (key: string) => void
  /** Replace the current hash without adding a history entry. */
  replace: (key: string) => void
}

/**
 * Subscribe to the URL hash as the single source of truth for the active route.
 * On mount it normalizes the URL (so a bare `#` deep-links to `fallback`) and
 * thereafter mirrors `hashchange` (incl. browser back/forward) into React state.
 */
export function useHashRoute(fallback: string): HashRoute {
  const [route, setRoute] = React.useState(() => routeFromHash(fallback))

  React.useEffect(() => {
    const sync = (): void => setRoute(routeFromHash(fallback))
    // Normalize an empty/partial hash on first load so the URL is always canonical.
    if (typeof window !== 'undefined' && !window.location.hash) {
      window.history.replaceState(null, '', hashFromRoute(routeFromHash(fallback)))
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [fallback])

  const navigate = React.useCallback((key: string) => {
    if (typeof window === 'undefined') return
    if (routeFromHash('') === key) return
    window.location.hash = hashFromRoute(key)
  }, [])

  const replace = React.useCallback((key: string) => {
    if (typeof window === 'undefined') return
    window.history.replaceState(null, '', hashFromRoute(key))
    setRoute(key)
  }, [])

  return { route, navigate, replace }
}
