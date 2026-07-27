import * as React from 'react'
import { getColorScheme, watchColorScheme, type ColorScheme } from '@iris-ui-kit/theme'

/**
 * Reactive system color scheme (`'light'` / `'dark'`) from
 * `prefers-color-scheme`. Re-renders the host when the OS preference flips.
 * SSR-safe (reports `'light'` until mounted). Wire it to a theme store to
 * auto-follow the system:
 *
 * ```tsx
 * const scheme = useColorScheme()
 * React.useEffect(() => store.setTheme(scheme === 'dark' ? 'dark' : 'light'), [scheme])
 * ```
 */
export function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = React.useState<ColorScheme>(getColorScheme)
  React.useEffect(() => {
    // Re-sync in case the preference changed between render and effect.
    setScheme(getColorScheme())
    return watchColorScheme(setScheme)
  }, [])
  return scheme
}
