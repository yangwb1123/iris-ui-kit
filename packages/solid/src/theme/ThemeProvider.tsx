import {
  createContext,
  createEffect,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js'
import {
  applyDirection,
  applyTheme,
  injectGlobalStyles,
  type Direction,
  type ThemeStore,
} from '@iris-ui-kit/theme'
import type { IrisTheme } from '@iris-ui-kit/tokens'
import { useStore } from '../useStore'

interface IrisThemeContextValue {
  store: ThemeStore
  current: Accessor<IrisTheme>
  dir: Accessor<Direction>
}

const IrisThemeContext = createContext<IrisThemeContextValue>()

export interface ThemeProviderProps {
  store: ThemeStore
  target?: HTMLElement | null
  /** Writing direction; sets `dir` on the target for RTL. Default `'ltr'`. */
  dir?: Direction
  /** CSP nonce for injected inline stylesheets. */
  cspNonce?: string
  children?: JSX.Element
}

/**
 * Renderless provider mirroring the React/Vue `ThemeProvider`: subscribes to the
 * theme store, applies CSS variables to `target` (or `document.documentElement`)
 * via a `createEffect`, and reverts on change/unmount through `onCleanup`.
 * **Zero business logic** — `applyTheme` / `createThemeStore` come from
 * `@iris-ui-kit/theme`; this is just the thin Solid bridge.
 */
export function ThemeProvider(props: ThemeProviderProps): JSX.Element {
  const current = useStore(props.store.store)
  const dir = (): Direction => props.dir ?? 'ltr'

  createEffect(() => {
    injectGlobalStyles(props.cspNonce)
    const el = props.target ?? document.documentElement
    const appliedTheme = applyTheme(current(), el)
    const appliedDir = applyDirection(dir(), el)
    onCleanup(() => {
      appliedTheme.revert()
      appliedDir.revert()
    })
  })

  return (
    <IrisThemeContext.Provider value={{ store: props.store, current, dir }}>
      {props.children}
    </IrisThemeContext.Provider>
  )
}

export function useThemeContext(): IrisThemeContextValue {
  const ctx = useContext(IrisThemeContext)
  if (!ctx) throw new Error('[iris-ui] useTheme(): no <ThemeProvider> ancestor found')
  return ctx
}

/** Non-throwing read for theme-aware primitives that may render standalone. */
export function useThemeOptional(): Accessor<IrisTheme> | undefined {
  return useContext(IrisThemeContext)?.current
}

/** Current writing direction accessor (`'ltr'` when there is no provider). */
export function useDirection(): Accessor<Direction> {
  const ctx = useContext(IrisThemeContext)
  return ctx ? ctx.dir : () => 'ltr'
}
