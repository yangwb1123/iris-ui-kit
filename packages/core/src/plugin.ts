/**
 * Framework-agnostic plugin contract. The four adapters (`@iris-ui/{react,vue,
 * solid,svelte}`) each ship an `IrisProvider` that calls {@link runPlugins} and
 * wires the collected registrations into the theme / i18n / context layers.
 *
 * Plugins are **additive**: they register new tokens, messages, and stores.
 * They cannot mutate existing core components or schemas. New UI components a
 * plugin ships are imported statically by the consumer (preserving types,
 * tree-shaking, and the manifest) — they are *not* registered by name here.
 */

/** A short, side-effecting collector handed to each plugin's `install`. */
export interface PluginRegistry {
  /**
   * Register CSS custom properties (e.g. `{ '--iris-editor-bg': '#1e1e1e' }`).
   * The provider applies them as an additive layer over the active theme.
   * A later registration of the same var wins (with a dev warning).
   */
  registerTokens(tokens: Record<string, string>): void
  /**
   * Register translation strings for a BCP-47 `locale`. Merged with any other
   * messages for the same locale; the provider applies the slice matching the
   * active locale (user-supplied messages still win).
   */
  registerMessages(locale: string, messages: Record<string, string>): void
  /**
   * Register a store under a unique `key`. The `factory` is invoked once,
   * eagerly, during {@link runPlugins}. Consumers read it via the adapter's
   * `usePluginStore(key)`. A duplicate key wins-last (with a dev warning).
   */
  registerStore(key: string, factory: () => unknown): void
  /**
   * Register a store whose `factory` is invoked LAZILY — on first
   * `usePluginStore(key)` access — and memoized thereafter. Opt-in for stores
   * that are expensive and not always used (e.g. a heavy client-only editor
   * engine). Trade-off vs {@link registerStore}: a lazy store is NOT guaranteed
   * to be the same instance across an SSR server/client boundary (it
   * materializes wherever first accessed), and its factory runs after `install`
   * so it cannot register an `onTeardown` — prefer an eager store when either
   * matters. A duplicate key wins-last (with a dev warning).
   */
  registerLazyStore(key: string, factory: () => unknown): void
  /**
   * Register a cleanup to run when the provider unmounts or the `plugins` set
   * is swapped — so eager stores / subscriptions / timers don't leak. An
   * alternative to returning a teardown from `install`; both are collected.
   */
  onTeardown(fn: () => void): void
}

/**
 * A plugin: a name plus an `install` hook that registers into the registry.
 * `install` may optionally return a teardown function (run on unmount/swap).
 */
export interface IrisPlugin {
  readonly name: string
  install(registry: PluginRegistry): void | (() => void)
  /**
   * Names of plugins this one must install AFTER (e.g. it reads a store or
   * tokens they register). {@link runPlugins} topologically orders installs so
   * dependencies run first; teardown then runs LIFO (dependents unwind first).
   * Missing names and cycles are dev-warned and degrade gracefully. Omit for an
   * independent plugin (the common case — install order then follows the array).
   */
  readonly dependsOn?: readonly string[]
}

/** The merged result of running every plugin's `install`. */
export interface CollectedRegistrations {
  /** Merged CSS custom properties across all plugins. */
  tokens: Record<string, string>
  /** locale → merged messages, across all plugins. */
  messages: Record<string, Record<string, string>>
  /**
   * store key → instance. Eager stores are already invoked; a lazily-registered
   * store materializes (once, memoized) on first `.get(key)` / `.has(key)`, so
   * the adapter's `usePluginStore` resolves both transparently.
   */
  stores: Map<string, unknown>
  /**
   * Run every registered teardown (from `install` return values and
   * `registry.onTeardown`) in LIFO order. Each is isolated (a throwing teardown
   * doesn't block the others) and the whole call is idempotent. The adapter
   * `IrisProvider` invokes this on unmount.
   */
  teardown(): void
}

/**
 * A `Map` of plugin stores that also materializes LAZILY-registered factories
 * on first access (memoizing the instance). Eager stores live in the Map
 * directly; lazy factories are invoked the first time `get`/`has` asks for them.
 * It IS a `Map`, so it satisfies the public `stores` type and the adapters'
 * `ctx.stores.get(key)` works unchanged.
 */
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
    super.set(key, instance) // memoize
    return instance
  }

  override has(key: string): boolean {
    return super.has(key) || this.lazyFactories.has(key)
  }
}

function devWarn(message: string): void {
  // Guarded so production bundles can drop it; safe when `process` is absent.
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
    return
  }
  console.warn(`[iris-ui] ${message}`)
}

/**
 * Identity helper with dev-time validation. Authoring a plugin is just:
 *
 * ```ts
 * export const editorPlugin = createPlugin({
 *   name: 'editor',
 *   install(reg) {
 *     reg.registerTokens({ '--iris-editor-bg': '#1e1e1e' })
 *     reg.registerStore('editor', () => createEditorStore())
 *   },
 * })
 * ```
 */
export function createPlugin(def: IrisPlugin): IrisPlugin {
  if (!def.name || typeof def.name !== 'string') {
    devWarn('createPlugin(): a plugin must have a non-empty string `name`.')
  }
  if (typeof def.install !== 'function') {
    devWarn(`createPlugin(): plugin "${def.name}" must have an \`install\` function.`)
  }
  return def
}

/**
 * Order plugins so every plugin installs AFTER the ones it `dependsOn`, while
 * preserving the original array order for independent plugins (stable DFS
 * post-order topological sort). Missing dependency names are dev-warned and
 * skipped; a dependency cycle is dev-warned and its back-edge ignored so the
 * run still completes deterministically.
 */
function orderPlugins(plugins: readonly IrisPlugin[]): IrisPlugin[] {
  const byName = new Map(plugins.map((p) => [p.name, p]))
  const result: IrisPlugin[] = []
  const done = new Set<string>()
  const onStack = new Set<string>()
  const visit = (p: IrisPlugin): void => {
    if (done.has(p.name)) return
    if (onStack.has(p.name)) {
      devWarn(`plugin "${p.name}" is part of a dependency cycle; ignoring the back-edge.`)
      return
    }
    onStack.add(p.name)
    for (const dep of p.dependsOn ?? []) {
      const depPlugin = byName.get(dep)
      if (!depPlugin) {
        devWarn(`plugin "${p.name}" depends on "${dep}", which is not installed.`)
        continue
      }
      visit(depPlugin)
    }
    onStack.delete(p.name)
    done.add(p.name)
    result.push(p)
  }
  for (const p of plugins) visit(p)
  return result
}

/**
 * Pure, synchronous, deterministic. Runs every plugin's `install` and collects
 * the registrations. This is the system's only real logic — the four adapter
 * providers delegate to it, so there is one implementation and one test suite.
 *
 * Store factories are invoked **eagerly** (once each) so server and client see
 * the same instances in SSR. Duplicate tokens / store keys win-last with a dev
 * warning; messages for a locale are deep-merged across plugins. Plugins that
 * declare {@link IrisPlugin.dependsOn} are topologically ordered first.
 */
export function runPlugins(plugins: readonly IrisPlugin[]): CollectedRegistrations {
  const tokens: Record<string, string> = {}
  const messages: Record<string, Record<string, string>> = {}
  const stores = new PluginStoreMap()
  const seenNames = new Set<string>()
  const teardowns: Array<() => void> = []

  const registry: PluginRegistry = {
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
      if (stores.has(key)) {
        devWarn(`store "${key}" registered by multiple plugins; last instance wins.`)
      }
      stores.set(key, factory())
    },
    registerLazyStore(key, factory) {
      if (stores.has(key)) {
        devWarn(`store "${key}" registered by multiple plugins; last instance wins.`)
      }
      stores.registerLazy(key, factory)
    },
    onTeardown(fn) {
      teardowns.push(fn)
    },
  }

  // Only reorder when a plugin actually declares a dependency — otherwise the
  // install order is the array order (zero behavior change for independent plugins).
  const ordered = plugins.some((p) => p.dependsOn?.length) ? orderPlugins(plugins) : plugins
  for (const plugin of ordered) {
    if (seenNames.has(plugin.name)) {
      devWarn(`plugin "${plugin.name}" installed more than once.`)
    }
    seenNames.add(plugin.name)
    const cleanup = plugin.install(registry)
    if (typeof cleanup === 'function') teardowns.push(cleanup)
  }

  let torn = false
  const teardown = (): void => {
    if (torn) return // idempotent
    torn = true
    // LIFO: tear down in reverse install order so later plugins that depend on
    // earlier ones unwind first. Each is isolated — a throwing teardown is
    // reported but never blocks the rest.
    for (let i = teardowns.length - 1; i >= 0; i -= 1) {
      try {
        teardowns[i]!()
      } catch (err) {
        devWarn(`a plugin teardown threw: ${String(err)}`)
      }
    }
  }

  return { tokens, messages, stores, teardown }
}
