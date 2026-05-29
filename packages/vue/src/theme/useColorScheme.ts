import { onBeforeUnmount, ref, type Ref } from 'vue'
import { getColorScheme, watchColorScheme, type ColorScheme } from '@iris-ui/theme'

/**
 * Reactive system color scheme (`'light'` / `'dark'`) from
 * `prefers-color-scheme`. SSR-safe (reports `'light'` until matchMedia is
 * available). Wire it to a theme store to auto-follow the system:
 *
 * ```ts
 * const scheme = useColorScheme()
 * watch(scheme, (s) => store.setTheme(s === 'dark' ? 'dark' : 'light'), { immediate: true })
 * ```
 */
export function useColorScheme(): Ref<ColorScheme> {
  const scheme = ref<ColorScheme>(getColorScheme())
  const stop = watchColorScheme((s) => {
    scheme.value = s
  })
  onBeforeUnmount(stop)
  return scheme
}
