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

/** Read a plugin-registered store by `key`; throws when outside `<IrisProvider>`. */
export function usePluginStore<T>(key: string): T {
  const ctx = useContext(PluginStoreContext)
  if (!ctx) throw new Error(`[iris-ui] usePluginStore("${key}"): no <IrisProvider> ancestor found`)
  return ctx.stores.get(key) as T
}
