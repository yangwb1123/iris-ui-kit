import { createEffect, createMemo, onCleanup, type JSX } from 'solid-js'
import { runPlugins, type IrisPlugin } from '@iris-ui-kit/core'
import {
  applyCssVars,
  type CssVarEntries,
  type Direction,
  type ThemeStore,
} from '@iris-ui-kit/theme'
import type { SkinEngine } from '@iris-ui-kit/skins'
import { ThemeProvider } from '../theme'
import { SkinProvider } from '../skins'
import { IrisI18nProvider } from '../i18n'
import { PluginStoreContext, type PluginStoreContextValue } from './PluginStoreContext'

export interface IrisProviderProps {
  /** Theme store; wraps `<ThemeProvider>` only when supplied. */
  theme?: ThemeStore
  /** Skin engine; wraps `<SkinProvider>` only when supplied. */
  skin?: SkinEngine
  /** Writing direction (forwarded to `<ThemeProvider>`). */
  dir?: Direction
  /** Active BCP-47 locale; selects the plugin message slice. Default `'en-US'`. */
  locale?: string
  /** User message overrides — these WIN over plugin-supplied messages. */
  messages?: Record<string, string>
  /** Plugins to install (tokens / messages / stores). */
  plugins?: IrisPlugin[]
  /** Element to receive plugin tokens; default `document.documentElement`. */
  target?: HTMLElement | null
  children?: JSX.Element
}

/**
 * The single unified entry point. Runs the plugin registry (in core), applies
 * collected tokens as an additive CSS-var layer, merges plugin + user messages,
 * and provides the store sink — composing the existing Theme/Skin/I18n bridges.
 * Order when present: Theme → Skin → I18n → PluginStoreContext → children.
 */
export function IrisProvider(props: IrisProviderProps): JSX.Element {
  const collected = createMemo(() => runPlugins(props.plugins ?? []))
  const installed = createMemo(() => new Set((props.plugins ?? []).map((p) => p.name)))

  // Plugin messages as BASE, user-supplied `messages` win.
  const messages = createMemo(() => ({
    ...collected().messages[props.locale ?? 'en-US'],
    ...(props.messages ?? {}),
  }))

  // Apply collected tokens to the target; revert on change/unmount. SSR-guarded.
  createEffect(() => {
    const entries: CssVarEntries = Object.entries(collected().tokens)
    if (typeof document === 'undefined' || entries.length === 0) return
    const el = props.target ?? document.documentElement
    const applied = applyCssVars(entries, el)
    onCleanup(() => applied.revert())
  })

  // Run plugin teardowns when the plugins set is swapped (a new `collected`) or
  // on unmount, so eager stores / subscriptions / timers don't leak.
  createEffect(() => {
    const current = collected()
    onCleanup(() => current.teardown())
  })

  const value: PluginStoreContextValue = {
    get stores() {
      return collected().stores
    },
    get installed() {
      return installed()
    },
  }

  const withI18n = (): JSX.Element => (
    <IrisI18nProvider locale={props.locale} messages={messages()}>
      <PluginStoreContext.Provider value={value}>{props.children}</PluginStoreContext.Provider>
    </IrisI18nProvider>
  )

  const withSkin = (): JSX.Element =>
    props.skin ? (
      <SkinProvider engine={props.skin} target={props.target}>
        {withI18n()}
      </SkinProvider>
    ) : (
      withI18n()
    )

  return props.theme ? (
    <ThemeProvider store={props.theme} dir={props.dir} target={props.target}>
      {withSkin()}
    </ThemeProvider>
  ) : (
    withSkin()
  )
}
