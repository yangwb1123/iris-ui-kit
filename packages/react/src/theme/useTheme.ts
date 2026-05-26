import type { IrisTheme } from '@iris-ui/tokens'
import { useThemeContext } from './ThemeProvider'

export interface UseThemeReturn {
  theme: IrisTheme
  setTheme: (target: string | IrisTheme) => void
  availableThemes: Record<string, IrisTheme>
}

/**
 * Read and write the current theme from anywhere inside a `<ThemeProvider>`.
 *
 * @example
 *   const { theme, setTheme } = useTheme()
 *   setTheme('dark')
 */
export function useTheme(): UseThemeReturn {
  const ctx = useThemeContext()
  return {
    theme: ctx.current,
    setTheme: ctx.store.setTheme,
    availableThemes: ctx.store.availableThemes,
  }
}
