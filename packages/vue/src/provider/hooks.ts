import { inject } from 'vue'
import { PluginStoreContextKey } from './context'

/** Whether the named plugin is installed by the nearest `<IrisProvider>`. */
export function usePlugin(name: string): boolean {
  const ctx = inject(PluginStoreContextKey, null)
  return ctx ? ctx.installed.has(name) : false
}

/**
 * Read a plugin-registered store by `key`. Plugins ship typed wrappers around
 * this (e.g. `useEditorStore = () => usePluginStore<EditorStore>('editor')`).
 * Throws a clear error when used outside an `<IrisProvider>`.
 */
export function usePluginStore<T>(key: string): T {
  const ctx = inject(PluginStoreContextKey, null)
  if (!ctx) {
    throw new Error(`[iris-ui] usePluginStore("${key}"): no <IrisProvider> ancestor found`)
  }
  return ctx.stores.get(key) as T
}
