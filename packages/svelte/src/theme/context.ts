import type { Snippet } from 'svelte'
import type { Readable } from 'svelte/store'
import type { Direction, ThemeStore } from '@iris-ui-kit/theme'
import type { IrisTheme } from '@iris-ui-kit/tokens'

/** Context key for the Iris theme — a module-singleton Symbol. */
export const THEME_KEY = Symbol('iris-ui:theme')

export interface IrisThemeContextValue {
  store: ThemeStore
  /** Active theme as a Svelte store — `$theme` re-renders on change. */
  current: Readable<IrisTheme>
  /** Writing direction as a Svelte store. */
  dir: Readable<Direction>
}

export interface ThemeProviderProps {
  store: ThemeStore
  /** Apply target; defaults to `document.documentElement`. */
  target?: HTMLElement | null
  /** Writing direction; sets `dir` on the target for RTL. Default `'ltr'`. */
  dir?: Direction
  /** CSP nonce for injected inline stylesheets. */
  cspNonce?: string
  children?: Snippet
}
