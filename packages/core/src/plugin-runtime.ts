import { createEventBus } from './event-bus'
import {
  createNamespacedRegistry,
  detectNamespaceConflicts,
  validateNamespace,
  type CollectedRegistrations,
  type IrisPlugin,
  type PluginRegistry,
} from './plugin'

/** Map implementation used by the runtime to memoize lazy plugin stores. */
class PluginStoreMap extends Map<string, unknown> {
  private readonly lazyFactories = new Map<string, () => unknown>()

  registerLazy(key: string, factory: () => unknown): void {
    this.lazyFactories.set(key, factory)
  }

  override get(key: string): unknown {
    if (super.has(key)) return super.get(key)
    const factory = this.lazyFactories.get(key)
    if (!factory) return undefined
    const instance = factory()
    this.lazyFactories.delete(key)
    super.set(key, instance)
    return instance
  }

  override has(key: string): boolean {
    return super.has(key) || this.lazyFactories.has(key)
  }
}

function devWarn(message: string): void {
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') return
  console.warn(`[iris-ui] ${message}`)
}

/** Stable DFS post-order for plugins with dependencies. */
function orderPlugins(plugins: readonly IrisPlugin[]): IrisPlugin[] {
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]))
  const result: IrisPlugin[] = []
  const done = new Set<string>()
  const onStack = new Set<string>()

  const visit = (plugin: IrisPlugin): void => {
    if (done.has(plugin.name)) return
    if (onStack.has(plugin.name)) {
      devWarn(`plugin "${plugin.name}" is part of a dependency cycle; ignoring the back-edge.`)
      return
    }
    onStack.add(plugin.name)
    for (const dependency of plugin.dependsOn ?? []) {
      const dependencyPlugin = byName.get(dependency)
      if (!dependencyPlugin) {
        devWarn(`plugin "${plugin.name}" depends on "${dependency}", which is not installed.`)
        continue
      }
      visit(dependencyPlugin)
    }
    onStack.delete(plugin.name)
    done.add(plugin.name)
    result.push(plugin)
  }

  for (const plugin of plugins) visit(plugin)
  return result
}

function createInternalRegistry(
  tokens: Record<string, string>,
  messages: Record<string, Record<string, string>>,
  stores: PluginStoreMap,
  teardowns: Array<() => void>,
  bus: ReturnType<typeof createEventBus<Record<string, unknown>>>,
): PluginRegistry {
  return {
    registerTokens(next) {
      for (const [key, value] of Object.entries(next)) {
        if (key in tokens && tokens[key] !== value) {
          devWarn(`token "${key}" registered by multiple plugins; last value wins.`)
        }
        tokens[key] = value
      }
    },
    registerMessages(locale, next) {
      messages[locale] = { ...messages[locale], ...next }
    },
    registerStore(key, factory) {
      if (stores.has(key))
        devWarn(`store "${key}" registered by multiple plugins; last instance wins.`)
      stores.set(key, factory())
    },
    registerLazyStore(key, factory) {
      if (stores.has(key))
        devWarn(`store "${key}" registered by multiple plugins; last instance wins.`)
      stores.registerLazy(key, factory)
    },
    onTeardown(fn) {
      teardowns.push(fn)
    },
    readStore<T>(fullyQualifiedKey: string): T | undefined {
      return stores.get(fullyQualifiedKey) as T | undefined
    },
    bus,
  }
}

function installPlugins(
  plugins: readonly IrisPlugin[],
  internalRegistry: PluginRegistry,
  teardowns: Array<() => void>,
): void {
  const seenNames = new Set<string>()
  for (const plugin of plugins) {
    if (seenNames.has(plugin.name)) devWarn(`plugin "${plugin.name}" installed more than once.`)
    seenNames.add(plugin.name)
    const registry = plugin.namespace
      ? createNamespacedRegistry(internalRegistry, plugin.namespace)
      : internalRegistry
    const cleanup = plugin.install(registry)
    if (typeof cleanup === 'function') teardowns.push(cleanup)
  }
}

function createPluginTeardown(
  teardowns: Array<() => void>,
  bus: PluginRegistry['bus'],
): () => void {
  let torn = false
  return () => {
    if (torn) return
    torn = true
    for (let i = teardowns.length - 1; i >= 0; i -= 1) {
      try {
        teardowns[i]!()
      } catch (err) {
        devWarn(`a plugin teardown threw: ${String(err)}`)
      }
    }
    bus.clear()
  }
}

/** Run every plugin install hook and collect namespaced registrations. */
export function runPlugins(plugins: readonly IrisPlugin[]): CollectedRegistrations {
  const tokens: Record<string, string> = {}
  const messages: Record<string, Record<string, string>> = {}
  const stores = new PluginStoreMap()
  const teardowns: Array<() => void> = []
  const bus = createEventBus<Record<string, unknown>>()
  const internalRegistry = createInternalRegistry(tokens, messages, stores, teardowns, bus)

  const ordered = plugins.some((plugin) => plugin.dependsOn?.length)
    ? orderPlugins(plugins)
    : plugins

  detectNamespaceConflicts(ordered)
  for (const plugin of ordered) {
    validateNamespace(plugin.namespace ?? plugin.name, plugin.name)
  }

  installPlugins(ordered, internalRegistry, teardowns)

  return { tokens, messages, stores, bus, teardown: createPluginTeardown(teardowns, bus) }
}

/** Destroy removed plugins, then install the next plugin set. */
export function reloadPlugins(
  prev: readonly IrisPlugin[],
  next: readonly IrisPlugin[],
): CollectedRegistrations {
  const nextSet = new Set(next.map((plugin) => plugin.name))
  for (let i = prev.length - 1; i >= 0; i -= 1) {
    const plugin = prev[i]!
    if (!nextSet.has(plugin.name)) {
      try {
        plugin.destroy?.()
      } catch (err) {
        devWarn(`plugin "${plugin.name}" destroy() threw: ${String(err)}`)
      }
    }
  }
  return runPlugins(next)
}
