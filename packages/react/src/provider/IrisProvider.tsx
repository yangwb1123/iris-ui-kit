import { useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { runPlugins, type IrisPlugin } from '@iris-ui/core'
import {
  applyCssVars,
  type ApplyCssVarsResult,
  type Direction,
  type ThemeStore,
} from '@iris-ui/theme'
import type { SkinEngine } from '@iris-ui/skins'
import { ThemeProvider } from '../theme'
import { SkinProvider } from '../skins'
import { IrisI18nProvider } from '../i18n'
import { PluginStoreContext } from './context'

export interface IrisProviderProps {
  /** Active theme store. When passed, wraps children in `<ThemeProvider>`. */
  theme?: ThemeStore
  /** Active skin engine. When passed, wraps children in `<SkinProvider>`. */
  skin?: SkinEngine
  /** Writing direction; forwarded to `<ThemeProvider>`. Default `'ltr'`. */
  dir?: Direction
  /** BCP-47 locale; selects which plugin message slice is applied. */
  locale?: string
  /** User message overrides — these WIN over plugin-registered messages. */
  messages?: Record<string, string>
  /** Plugins to install. Their tokens / messages / stores are collected once. */
  plugins?: IrisPlugin[]
  /** Element to receive plugin tokens. Defaults to `document.documentElement`. */
  target?: HTMLElement | null
  children?: ReactNode
}

/**
 * The single unified entry point. Runs the plugins, applies their additive
 * token layer over the active theme, merges their messages under the user's,
 * and exposes their stores via `PluginStoreContext`. The existing
 * Theme / Skin / I18n providers are composed in around it.
 *
 * **Zero business logic** — `runPlugins` / `applyCssVars` do the work; this is a
 * thin React bridge. Client boundary (tsup prepends `'use client'`).
 */
export function IrisProvider({
  theme,
  skin,
  dir = 'ltr',
  locale,
  messages,
  plugins,
  target = null,
  children,
}: IrisProviderProps) {
  const collected = useMemo(() => runPlugins(plugins ?? []), [plugins])
  const appliedRef = useRef<ApplyCssVarsResult | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const el = target ?? document.documentElement
    appliedRef.current?.revert()
    appliedRef.current = applyCssVars(Object.entries(collected.tokens), el)
    return () => {
      appliedRef.current?.revert()
      appliedRef.current = null
    }
  }, [collected, target])

  const value = useMemo(
    () => ({ stores: collected.stores, installed: new Set((plugins ?? []).map((p) => p.name)) }),
    [collected, plugins],
  )

  // Plugin messages are the BASE; user-supplied messages win.
  const merged = { ...collected.messages[locale ?? 'en-US'], ...(messages ?? {}) }

  // Order (innermost-out): Theme → Skin → I18n → PluginContext → children.
  let tree: ReactNode = (
    <IrisI18nProvider locale={locale} messages={merged}>
      <PluginStoreContext.Provider value={value}>{children}</PluginStoreContext.Provider>
    </IrisI18nProvider>
  )
  if (skin) {
    tree = (
      <SkinProvider engine={skin} target={target}>
        {tree}
      </SkinProvider>
    )
  }
  if (theme) {
    tree = (
      <ThemeProvider store={theme} dir={dir} target={target}>
        {tree}
      </ThemeProvider>
    )
  }
  return tree
}

/** Whether a plugin with `name` is installed under the nearest `<IrisProvider>`. */
export function usePlugin(name: string): boolean {
  return useContext(PluginStoreContext)?.installed.has(name) ?? false
}

/**
 * Read a plugin-registered store by `key`. Throws a clear error when there is
 * no `<IrisProvider>` ancestor. Plugins export typed wrappers narrowing `T`.
 */
export function usePluginStore<T>(key: string): T {
  const ctx = useContext(PluginStoreContext)
  if (!ctx) {
    throw new Error(`[iris-ui] usePluginStore("${key}"): no <IrisProvider> ancestor found`)
  }
  return ctx.stores.get(key) as T
}
