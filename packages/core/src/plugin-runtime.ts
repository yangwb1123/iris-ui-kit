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
  private readonly evaluatingLazy = new Set<string>()

  registerLazy(key: string, factory: () => unknown): void {
    // A lazy registration is still a registration: it replaces an eager value
    // already under the same key, just as an eager registration replaces a
    // lazy factory below.
    super.delete(key)
    this.lazyFactories.set(key, factory)
  }

  setEager(key: string, instance: unknown): void {
    this.lazyFactories.delete(key)
    super.set(key, instance)
  }

  override get(key: string): unknown {
    if (super.has(key)) return super.get(key)
    const factory = this.lazyFactories.get(key)
    if (!factory) return undefined
    if (this.evaluatingLazy.has(key)) {
      throw new Error(`[iris-ui] Reentrant lazy store factory for "${key}".`)
    }
    this.evaluatingLazy.add(key)
    try {
      const instance = factory()
      this.lazyFactories.delete(key)
      super.set(key, instance)
      return instance
    } finally {
      this.evaluatingLazy.delete(key)
    }
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
  // Names are not unique at runtime: duplicate names are warned about, but
  // both definitions are still installed for backwards compatibility.
  const done = new Set<IrisPlugin>()
  const onStack = new Set<IrisPlugin>()

  const visit = (plugin: IrisPlugin): void => {
    if (done.has(plugin)) return
    if (onStack.has(plugin)) {
      devWarn(`plugin "${plugin.name}" is part of a dependency cycle; ignoring the back-edge.`)
      return
    }
    onStack.add(plugin)
    for (const dependency of plugin.dependsOn ?? []) {
      const dependencyPlugin = byName.get(dependency)
      if (!dependencyPlugin) {
        devWarn(`plugin "${plugin.name}" depends on "${dependency}", which is not installed.`)
        continue
      }
      visit(dependencyPlugin)
    }
    onStack.delete(plugin)
    done.add(plugin)
    result.push(plugin)
  }

  for (const plugin of plugins) visit(plugin)
  return result
}

function validateRuntimePlugins(plugins: readonly IrisPlugin[]): void {
  if (!Array.isArray(plugins)) {
    throw new TypeError('[iris-ui] runPlugins() expects an array of plugin definitions.')
  }
  for (let index = 0; index < plugins.length; index += 1) {
    const plugin = plugins[index] as IrisPlugin | null | undefined
    if (!plugin || typeof plugin !== 'object') {
      throw new TypeError(`[iris-ui] Plugin at index ${index} is not an object.`)
    }
    if (typeof plugin.name !== 'string' || plugin.name.length === 0) {
      throw new TypeError(`[iris-ui] Plugin at index ${index} must have a non-empty string name.`)
    }
    if (typeof plugin.install !== 'function') {
      throw new TypeError(`[iris-ui] Plugin "${plugin.name}" must have an install function.`)
    }
    if (plugin.namespace !== undefined && typeof plugin.namespace !== 'string') {
      throw new TypeError(`[iris-ui] Plugin "${plugin.name}" has an invalid namespace.`)
    }
    if (
      plugin.dependsOn !== undefined &&
      (!Array.isArray(plugin.dependsOn) ||
        plugin.dependsOn.some((name) => typeof name !== 'string'))
    ) {
      throw new TypeError(`[iris-ui] Plugin "${plugin.name}" has invalid dependsOn entries.`)
    }
  }
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
        if (Object.prototype.hasOwnProperty.call(tokens, key) && tokens[key] !== value) {
          devWarn(`token "${key}" registered by multiple plugins; last value wins.`)
        }
        Object.defineProperty(tokens, key, {
          configurable: true,
          enumerable: true,
          value,
          writable: true,
        })
      }
    },
    registerMessages(locale, next) {
      const previous = Object.prototype.hasOwnProperty.call(messages, locale)
        ? messages[locale]
        : undefined
      Object.defineProperty(messages, locale, {
        configurable: true,
        enumerable: true,
        value: { ...previous, ...next },
        writable: true,
      })
    },
    registerStore(key, factory) {
      if (stores.has(key))
        devWarn(`store "${key}" registered by multiple plugins; last instance wins.`)
      stores.setEager(key, factory())
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
  validateRuntimePlugins(plugins)
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

  const teardown = createPluginTeardown(teardowns, bus)
  try {
    installPlugins(ordered, internalRegistry, teardowns)
  } catch (err) {
    // An install hook can fail after registering stores, listeners, or cleanup
    // callbacks. Do not leak the partially-built provider-owned runtime.
    teardown()
    throw err
  }

  return { tokens, messages, stores, bus, teardown }
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
