import { inject } from 'vue'
import { PluginStoreContextKey } from './context'

/** Whether the named plugin is installed by the nearest `<IrisProvider>`. */
export function usePlugin(name: string): boolean {
  const ctx = inject(PluginStoreContextKey, null)
  return ctx ? ctx.installed.has(name) : false
}

// Tracks ambiguous store key warnings to avoid spamming the console.
const warnedKeys = new Map<string, boolean>()

/**
 * Read a plugin-registered store by `key` (backward-compatible single-arg form).
 * Throws a clear error when used outside an `<IrisProvider>`.
 */
export function usePluginStore<T>(key: string): T

/**
 * Read a plugin-registered store by `namespace` + `key`.
 */
export function usePluginStore<T>(namespace: string, key: string): T

export function usePluginStore<T>(nsOrKey: string, key?: string): T {
  const ctx = inject(PluginStoreContextKey, null)
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
        // Warn at most once per ambiguous key.
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
