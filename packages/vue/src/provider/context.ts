import { type InjectionKey } from 'vue'

/**
 * Shape carried by the plugin-store context: the live store instances collected
 * from every installed plugin, plus the set of installed plugin names. Surfaced
 * to descendants through `usePluginStore` / `usePlugin`.
 */
export interface PluginStoreContext {
  stores: Map<string, unknown>
  installed: Set<string>
}

/**
 * Injection key for the {@link PluginStoreContext}. The name ends in `Key` (and
 * the type in `Context`) so the manifest's discover step never mistakes it for a
 * component export.
 */
export const PluginStoreContextKey: InjectionKey<PluginStoreContext> = Symbol('IrisPluginStore')
