import { createContext } from 'react'

/**
 * What `<IrisProvider>` hands to descendants: the eagerly-built plugin stores
 * (keyed by registration name) plus the set of installed plugin names.
 *
 * Named `*Context` so the manifest's discover step EXCLUDES it — only
 * `Iris*`-prefixed, non-`Context` exports become manifest components.
 */
export interface PluginStoreContextValue {
  stores: Map<string, unknown>
  installed: Set<string>
}

export const PluginStoreContext = createContext<PluginStoreContextValue | null>(null)
