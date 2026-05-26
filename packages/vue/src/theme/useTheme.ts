import { computed, type ComputedRef } from 'vue'
import type { IrisTheme } from '@iris-ui/tokens'
import { useThemeContext } from './ThemeProvider'

export interface UseThemeReturn {
  /** Reactive ref to the active theme. */
  theme: ComputedRef<IrisTheme>
  /** Switch by name or by passing a theme directly. */
  setTheme: (target: string | IrisTheme) => void
  /** Map of all themes registered with the store. */
  availableThemes: Record<string, IrisTheme>
}

/**
 * Read and write the current theme from anywhere inside a <ThemeProvider>.
 *
 * @example
 * const { theme, setTheme } = useTheme()
 * theme.value.colors['iris.primary']
 * setTheme('dark')
 */
export function useTheme(): UseThemeReturn {
  const ctx = useThemeContext()
  return {
    theme: computed(() => ctx.current.value),
    setTheme: ctx.store.setTheme,
    availableThemes: ctx.store.availableThemes,
  }
}
