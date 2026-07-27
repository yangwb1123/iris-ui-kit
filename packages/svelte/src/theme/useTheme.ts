import { getContext } from 'svelte'
import { readable, type Readable } from 'svelte/store'
import type { Direction } from '@iris-ui-kit/theme'
import type { IrisTheme } from '@iris-ui-kit/tokens'
import { THEME_KEY, type IrisThemeContextValue } from './context'

export interface UseThemeReturn {
  /** Active theme as a Svelte store — use `$theme` in markup. */
  theme: Readable<IrisTheme>
  setTheme: (target: string | IrisTheme) => void
  availableThemes: Record<string, IrisTheme>
}

export function useThemeContext(): IrisThemeContextValue {
  const ctx = getContext<IrisThemeContextValue | undefined>(THEME_KEY)
  if (!ctx) throw new Error('[iris-ui] useTheme(): no <ThemeProvider> ancestor found')
  return ctx
}

/**
 * Read + control the active theme from anywhere inside a `<ThemeProvider>`.
 * `theme` is a Svelte store (mirrors Solid's accessor / Vue's `ComputedRef`).
 */
export function useTheme(): UseThemeReturn {
  const ctx = useThemeContext()
  return {
    theme: ctx.current,
    setTheme: ctx.store.setTheme,
    availableThemes: ctx.store.availableThemes,
  }
}

/** Non-throwing read for theme-aware primitives that may render standalone. */
export function useThemeOptional(): Readable<IrisTheme> | undefined {
  return getContext<IrisThemeContextValue | undefined>(THEME_KEY)?.current
}

/** Current writing direction store (`'ltr'` when there is no provider). */
export function useDirection(): Readable<Direction> {
  const ctx = getContext<IrisThemeContextValue | undefined>(THEME_KEY)
  return ctx ? ctx.dir : readable<Direction>('ltr')
}
