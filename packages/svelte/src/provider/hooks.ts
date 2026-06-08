import { getContext } from 'svelte'
import { PLUGIN_STORE_KEY, type PluginStoreContextValue } from './context'

/** Whether the named plugin is installed by the enclosing `IrisProvider`. */
export function usePlugin(name: string): boolean {
  const ctx = getContext<PluginStoreContextValue | undefined>(PLUGIN_STORE_KEY)
  return ctx?.installed.has(name) ?? false
}

/**
 * Read a plugin-registered store by key. Throws a clear error when no
 * `IrisProvider` is mounted above the calling component.
 */
export function usePluginStore<T>(key: string): T {
  const ctx = getContext<PluginStoreContextValue | undefined>(PLUGIN_STORE_KEY)
  if (!ctx) {
    throw new Error(
      `[iris-ui] usePluginStore("${key}"): no IrisProvider found in the component tree.`,
    )
  }
  return ctx.stores.get(key) as T
}
