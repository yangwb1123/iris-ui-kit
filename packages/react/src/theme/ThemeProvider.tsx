import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { applyTheme, type ApplyThemeResult, type ThemeStore } from '@iris-ui/theme'
import type { IrisTheme } from '@iris-ui/tokens'
import { useStore } from '../useStore'

interface IrisThemeContextValue {
  store: ThemeStore
  current: IrisTheme
}

const IrisThemeContext = createContext<IrisThemeContextValue | null>(null)

export interface ThemeProviderProps {
  store: ThemeStore
  target?: HTMLElement | null
  children?: ReactNode
}

/**
 * Renderless provider that mirrors `<IrisThemeProvider>` from `@iris-ui/vue`:
 * subscribes to the theme store, applies CSS variables to `target` (or
 * `document.documentElement`), reverts on unmount.
 *
 * **Zero business logic** — `applyTheme` / `createThemeStore` come straight
 * from `@iris-ui/theme`. This component is just a 30-line React adapter.
 */
export function ThemeProvider({ store, target = null, children }: ThemeProviderProps) {
  const current = useStore(store.store)
  const appliedRef = useRef<ApplyThemeResult | null>(null)

  useEffect(() => {
    const el = target ?? document.documentElement
    appliedRef.current?.revert()
    appliedRef.current = applyTheme(current, el)
    return () => {
      appliedRef.current?.revert()
      appliedRef.current = null
    }
  }, [current, target])

  return (
    <IrisThemeContext.Provider value={{ store, current }}>{children}</IrisThemeContext.Provider>
  )
}

export function useThemeContext(): IrisThemeContextValue {
  const ctx = useContext(IrisThemeContext)
  if (!ctx) {
    throw new Error('[iris-ui] useTheme(): no <ThemeProvider> ancestor found')
  }
  return ctx
}

/**
 * Read the current theme without throwing when there is no `<ThemeProvider>`
 * ancestor. Returns `undefined` outside a provider. Used by theme-aware
 * primitives (e.g. `IrisIcon`) that must still render standalone.
 */
export function useThemeOptional(): IrisTheme | undefined {
  return useContext(IrisThemeContext)?.current
}
