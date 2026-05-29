/**
 * System color-scheme detection via `prefers-color-scheme`. Framework-agnostic
 * and SSR-safe: with no `window.matchMedia` (server, or jsdom without a mock)
 * it reports `'light'` and the watcher is a no-op. Adapters wrap this with
 * `useColorScheme`; consumers map the result onto a theme:
 *
 * ```ts
 * const scheme = useColorScheme()
 * useEffect(() => themeStore.setTheme(scheme === 'dark' ? 'dark' : 'light'), [scheme])
 * ```
 */
export type ColorScheme = 'light' | 'dark'

const QUERY = '(prefers-color-scheme: dark)'

function mediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(QUERY)
}

/** Current system color scheme (`'light'` when undetectable). */
export function getColorScheme(): ColorScheme {
  return mediaQueryList()?.matches ? 'dark' : 'light'
}

/**
 * Subscribe to system color-scheme changes. Returns an unsubscribe function
 * (a no-op when `matchMedia` is unavailable). Uses `addEventListener` and
 * falls back to the legacy `addListener` for older WebKit.
 */
export function watchColorScheme(onChange: (scheme: ColorScheme) => void): () => void {
  const mql = mediaQueryList()
  if (!mql) return () => {}
  const handler = (event: MediaQueryListEvent): void => onChange(event.matches ? 'dark' : 'light')
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }
  // Legacy Safari < 14.
  mql.addListener(handler)
  return () => mql.removeListener(handler)
}
