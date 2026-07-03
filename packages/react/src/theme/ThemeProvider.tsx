import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import {
  applyDirection,
  applyTheme,
  injectGlobalStyles,
  type ApplyThemeResult,
  type Direction,
  type ThemeStore,
} from '@iris-ui/theme'
import type { IrisTheme } from '@iris-ui/tokens'
import { useStore } from '../useStore'

interface IrisThemeContextValue {
  store: ThemeStore
  current: IrisTheme
  dir: Direction
}

const IrisThemeContext = createContext<IrisThemeContextValue | null>(null)

export interface ThemeProviderProps {
  store: ThemeStore
  target?: HTMLElement | null
  /** Writing direction; sets `dir` on the target for RTL. Default `'ltr'`. */
  dir?: Direction
  /** CSP nonce for the injected global stylesheet. Pass the `nonce` from your
   *  server-rendered CSP header when you use `style-src: 'nonce-...'`. */
  cspNonce?: string
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
export function ThemeProvider({
  store,
  target = null,
  dir = 'ltr',
  cspNonce,
  children,
}: ThemeProviderProps) {
  const current = useStore(store.store)
  const appliedRef = useRef<ApplyThemeResult | null>(null)

  useEffect(() => {
    injectGlobalStyles(cspNonce)
    const el = target ?? document.documentElement
    appliedRef.current?.revert()
    appliedRef.current = applyTheme(current, el)
    const dirApplied = applyDirection(dir, el)
    return () => {
      appliedRef.current?.revert()
      appliedRef.current = null
      dirApplied.revert()
    }
  }, [current, target, dir])

  return (
    <IrisThemeContext.Provider value={{ store, current, dir }}>
      {children}
    </IrisThemeContext.Provider>
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

/**
 * Current writing direction (`'ltr'` / `'rtl'`) from the nearest
 * `<ThemeProvider>`, or `'ltr'` when there is none. For components that need to
 * branch on direction beyond what CSS logical properties already handle.
 */
export function useDirection(): Direction {
  return useContext(IrisThemeContext)?.dir ?? 'ltr'
}
