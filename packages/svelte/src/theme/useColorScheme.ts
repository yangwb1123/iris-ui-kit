import { readable, type Readable } from 'svelte/store'
import { getColorScheme, watchColorScheme, type ColorScheme } from '@iris-ui-kit/theme'

/**
 * Reactive system color scheme (`'light'` / `'dark'`) store from
 * `prefers-color-scheme`. SSR-safe (seeds from `getColorScheme()`); the
 * `watchColorScheme` listener is attached only once a subscriber exists and is
 * torn down by the `readable` stop function. Wire it to a theme store to
 * auto-follow the system:
 *
 * ```svelte
 * const scheme = useColorScheme()
 * $effect(() => store.setTheme($scheme === 'dark' ? 'dark' : 'light'))
 * ```
 */
export function useColorScheme(): Readable<ColorScheme> {
  return readable<ColorScheme>(getColorScheme(), (set) => {
    set(getColorScheme())
    return watchColorScheme((value) => set(value))
  })
}
