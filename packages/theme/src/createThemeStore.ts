import { createStore, type Store } from '@iris-ui-kit/core'
import type { IrisTheme } from '@iris-ui-kit/tokens'

export interface ThemeStoreConfig {
  themes: Record<string, IrisTheme>
  /** Name of the default theme. Must be a key in `themes`. */
  default: string
}

export interface ThemeStore {
  store: Store<IrisTheme>
  /** Switch theme by name (must be a key in `themes`) or by passing a theme directly. */
  setTheme(target: string | IrisTheme): void
  /** All available themes registered with this store. */
  availableThemes: Record<string, IrisTheme>
}

/**
 * Create a subscribable theme store. **Pure**: this function never touches
 * the DOM. Adapters (like Vue `ThemeProvider`) subscribe and call
 * `applyTheme` as a side-effect.
 */
export function createThemeStore(config: ThemeStoreConfig): ThemeStore {
  const initial = config.themes[config.default]
  if (!initial) {
    throw new Error(
      `[iris-ui] createThemeStore: default theme "${config.default}" not in themes map`,
    )
  }

  const store = createStore<IrisTheme>(initial)

  return {
    store,
    availableThemes: config.themes,
    setTheme(target) {
      if (typeof target === 'string') {
        const next = config.themes[target]
        if (!next) {
          throw new Error(`[iris-ui] setTheme: unknown theme "${target}"`)
        }
        store.setState(next)
      } else {
        store.setState(target)
      }
    },
  }
}
