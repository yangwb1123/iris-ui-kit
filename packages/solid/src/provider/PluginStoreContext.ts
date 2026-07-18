import { createContext, useContext } from 'solid-js'

/**
 * Shared sink carried by {@link PluginStoreContext}: the eagerly-built store
 * instances (key → store) plus the set of installed plugin names. Both are
 * surfaced through getters so they stay reactive to the provider's memo.
 */
export interface PluginStoreContextValue {
  stores: Map<string, unknown>
  installed: Set<string>
}

// Name ends in `Context` so the manifest discover step excludes it — only the
// `Iris*`-prefixed `IrisProvider` export becomes a manifest component.
export const PluginStoreContext = createContext<PluginStoreContextValue>()

/** Is a plugin with this `name` installed in the nearest `<IrisProvider>`? */
export function usePlugin(name: string): boolean {
  const ctx = useContext(PluginStoreContext)
  if (!ctx) throw new Error(`[iris-ui] usePlugin("${name}"): no <IrisProvider> ancestor found`)
  return ctx.installed.has(name)
}

// Tracks ambiguous store key warnings to avoid spamming the console.
// Hoisted BEFORE overload signatures (TS requires overloads immediately before implementation).
const warnedKeys = new Map<string, boolean>()

/**
 * Read a plugin-registered store by `key` (backward-compatible single-arg form).
 * Throws when outside `<IrisProvider>`.
 */
export function usePluginStore<T>(key: string): T

/**
 * Read a plugin-registered store by `namespace` + `key`.
 */
export function usePluginStore<T>(namespace: string, key: string): T

/** Read a plugin-registered store; throws when outside `<IrisProvider>`. */
export function usePluginStore<T>(nsOrKey: string, key?: string): T {
  const ctx = useContext(PluginStoreContext)
  if (!ctx) {
    const displayKey = key !== undefined ? `${nsOrKey}::${key}` : nsOrKey
    throw new Error(`[iris-ui] usePluginStore("${displayKey}"): no <IrisProvider> ancestor found`)
  }

  const fullKey = key !== undefined ? `${nsOrKey}::${key}` : nsOrKey

  // 1. Direct lookup
  let store = ctx.stores.get(fullKey) as T | undefined
  if (store !== undefined) return store

  // 2. Single-arg fallback
  if (key === undefined) {
    store = ctx.stores.get(nsOrKey) as T | undefined
    if (store !== undefined) return store

    for (const k of ctx.stores.keys()) {
      if (typeof k === 'string' && k.endsWith(`::${nsOrKey}`)) {
        // Warn at most once per ambiguous key (suppress after first).
        if (!warnedKeys.has(nsOrKey)) {
          warnedKeys.set(nsOrKey, true)
          console.warn(
            `[iris-ui] Ambiguous plugin store key "${nsOrKey}". ` +
              `Found "${k}". Use the namespaced form: usePluginStore("${k}").`,
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
