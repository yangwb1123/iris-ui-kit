import type { Snippet } from 'svelte'
import type { I18nMessages, IrisPlugin } from '@iris-ui-kit/core'
import type { Direction, ThemeStore } from '@iris-ui-kit/theme'
import type { SkinEngine } from '@iris-ui-kit/skins'

/**
 * Context key for the collected plugin layer — a module-singleton Symbol. Named
 * `...KEY` (not `Iris*`) so the manifest discover step never treats it as a
 * component; only `IrisProvider` from this folder is a real component.
 */
export const PLUGIN_STORE_KEY = Symbol('iris-ui:plugin-store')

/** What `IrisProvider` provides to descendants for `usePlugin`/`usePluginStore`. */
export interface PluginStoreContextValue {
  /** store key → instance (factories already invoked by `runPlugins`). */
  stores: Map<string, unknown>
  /** names of every installed plugin. */
  installed: Set<string>
}

export interface IrisProviderProps {
  /** Theme store — when passed, an inner `ThemeProvider` is rendered. */
  theme?: ThemeStore
  /** Skin engine — when passed, an inner `SkinProvider` is rendered. */
  skin?: SkinEngine
  /** Writing direction; forwarded to the theme layer. Default `'ltr'`. */
  dir?: Direction
  /** Active BCP-47 locale. Default `'en-US'`. */
  locale?: string
  /** User messages — these WIN over plugin-registered messages. */
  messages?: I18nMessages
  /** Plugins to install (tokens + messages + stores). */
  plugins?: IrisPlugin[]
  /** Token apply target; defaults to `document.documentElement`. */
  target?: HTMLElement | null
  children?: Snippet
}
