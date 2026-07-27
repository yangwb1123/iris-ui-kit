import { createSignal, onCleanup, onMount, type Accessor } from 'solid-js'
import { getColorScheme, watchColorScheme, type ColorScheme } from '@iris-ui-kit/theme'

/**
 * Reactive system color scheme (`'light'` / `'dark'`) accessor from
 * `prefers-color-scheme`. SSR-safe (reports `'light'` until mounted). Wire it to
 * a theme store to auto-follow the system:
 *
 * ```tsx
 * const scheme = useColorScheme()
 * createEffect(() => store.setTheme(scheme() === 'dark' ? 'dark' : 'light'))
 * ```
 */
export function useColorScheme(): Accessor<ColorScheme> {
  const [scheme, setScheme] = createSignal<ColorScheme>(getColorScheme())
  onMount(() => {
    setScheme(getColorScheme())
    onCleanup(watchColorScheme((value) => setScheme(value)))
  })
  return scheme
}
