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

  // Run plugin teardowns when the plugins set is swapped (a new `collected`) or
  // on unmount, so eager stores / subscriptions / timers don't leak.
  useEffect(() => () => collected.teardown(), [collected])

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

// Tracks ambiguous store key warnings to avoid spamming the console.
// Hoisted BEFORE overload signatures (TS requires overloads immediately before implementation).
const warnedKeys = new Map<string, boolean>()

/**
 * Read a plugin-registered store by `key` (backward-compatible single-arg form).
 * Falls back to `{namespace}::{key}` lookup if bare key not found.
 * Throws a clear error when there is no `<IrisProvider>` ancestor.
 * Plugins export typed wrappers narrowing `T`.
 */
export function usePluginStore<T>(key: string): T

/**
 * Read a plugin-registered store by `namespace` + `key`.
 * Equivalent to `usePluginStore('{namespace}::{key}')`.
 */
export function usePluginStore<T>(namespace: string, key: string): T

export function usePluginStore<T>(nsOrKey: string, key?: string): T {
  const ctx = useContext(PluginStoreContext)
  if (!ctx) {
    const displayKey = key !== undefined ? `${nsOrKey}::${key}` : nsOrKey
    throw new Error(`[iris-ui] usePluginStore("${displayKey}"): no <IrisProvider> ancestor found`)
  }

  const fullKey = key !== undefined ? `${nsOrKey}::${key}` : nsOrKey

  // 1. Direct lookup using the constructed key
  let store = ctx.stores.get(fullKey) as T | undefined
  if (store !== undefined) return store

  // 2. Single-arg: try without namespace first (backward compat for unnamespaced plugins)
  if (key === undefined) {
    // Try the key as a bare key (for plugins without namespace)
    store = ctx.stores.get(nsOrKey) as T | undefined
    if (store !== undefined) return store

    // Try as {namespace}::{key} where namespace may equal the key segment
    // e.g. usePluginStore('settings') → try 'default::settings', 'editor::settings', etc.
    // This handles plugins where namespace === name (the common case).
    for (const k of ctx.stores.keys()) {
      if (typeof k === 'string' && k.endsWith(`::${nsOrKey}`)) {
        // Warn at most once per ambiguous key.
        if (!warnedKeys.has(nsOrKey)) {
          warnedKeys.set(nsOrKey, true)
          console.warn(
            `[iris-ui] Ambiguous plugin store key "${nsOrKey}". ` +
              `Found "${k}". Use the namespaced form for clarity: ` +
              `usePluginStore("${k}").`,
          )
        }
        return ctx.stores.get(k) as T
      }
    }
  }

  throw new Error(
    `[iris-ui] Plugin store "${fullKey}" not found. ` +
      `Ensure the plugin is installed in IrisProvider and the key is correct.`,
  )
}
