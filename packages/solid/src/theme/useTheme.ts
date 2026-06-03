import type { Accessor } from 'solid-js'
import type { IrisTheme } from '@iris-ui/tokens'
import { useThemeContext } from './ThemeProvider'

export interface UseThemeReturn {
  theme: Accessor<IrisTheme>
  setTheme: (target: string | IrisTheme) => void
  availableThemes: Record<string, IrisTheme>
}

/**
 * Read + control the active theme from anywhere inside a `<ThemeProvider>`.
 * `theme` is a Solid accessor (reads re-run on change), mirroring Vue's
 * `ComputedRef` and React's re-rendered value.
 */
export function useTheme(): UseThemeReturn {
  const ctx = useThemeContext()
  return {
    theme: ctx.current,
    setTheme: ctx.store.setTheme,
    availableThemes: ctx.store.availableThemes,
  }
}
