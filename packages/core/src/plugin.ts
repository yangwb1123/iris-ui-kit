import type { EventBus } from './event-bus'

/**
 * Framework-agnostic plugin contract. The four adapters (`@iris-ui-kit/{react,vue,
 * solid,svelte}`) each ship an `IrisProvider` that calls {@link runPlugins} and
 * wires the collected registrations into the theme / i18n / context layers.
 *
 * Plugins are **additive**: they register new tokens, messages, and stores.
 * They cannot mutate existing core components or schemas. New UI components a
 * plugin ships are imported statically by the consumer (preserving types,
 * tree-shaking, and the manifest) — they are *not* registered by name here.
 */

/**
 * Separator used between namespace and store key inside the stores map.
 * `::` is not valid in JS identifiers, so it cannot collide with a real key.
 */
export const NAMESPACE_SEPARATOR = '::'

/**
 * Transform a token key to include the namespace prefix.
 *
 * Rules:
 * 1. If key starts with `--iris-`: insert namespace after `--iris-`
 *    e.g. `--iris-bg` + ns=`editor` → `--iris-editor-bg`
 * 2. If key starts with `--` but NOT `--iris-`: insert namespace after `--`
 *    e.g. `--custom-x` + ns=`editor` → `--editor-custom-x`
 * 3. If key does NOT start with `--`: prefix with `--{ns}-`
 *    (edge case: invalid CSS var, but handled gracefully)
 *
 * Idempotent: if key already contains the namespace, return as-is.
 */
export function namespaceTokenKey(key: string, namespace: string): string {
  if (key.startsWith(`--iris-${namespace}-`)) return key // idempotent
  if (key.startsWith('--iris-')) {
    return key.replace(/^--iris-/, `--iris-${namespace}-`)
  }
  if (key.startsWith('--')) {
    return `--${namespace}-${key.slice(2)}`
  }
  // Fallback: prefix with namespace
  return `--${namespace}-${key}`
}

/**
 * Transform a store key to include the namespace prefix.
 * Idempotent: if key already contains `::`, return as-is.
 */
export function namespaceStoreKey(key: string, namespace: string): string {
  return key.includes(NAMESPACE_SEPARATOR) ? key : `${namespace}${NAMESPACE_SEPARATOR}${key}`
}

const NAMESPACE_RE = /^[a-z0-9-]+$/

/** Validate namespace string; throws TypeError if invalid. */
export function validateNamespace(namespace: string, pluginName: string): void {
  if (!NAMESPACE_RE.test(namespace)) {
    throw new TypeError(
      `[iris-ui] Plugin "${pluginName}" has invalid namespace "${namespace}". ` +
        `Only lowercase alphanumeric and hyphens allowed.`,
    )
  }
}

/** Warn if multiple plugins share the same namespace. */
export function detectNamespaceConflicts(plugins: readonly IrisPlugin[]): void {
  const sharing = new Map<string, string[]>()
  for (const p of plugins) {
    const ns = p.namespace ?? p.name
    const list = sharing.get(ns)
    if (list) list.push(p.name)
    else sharing.set(ns, [p.name])
  }
  for (const [ns, names] of sharing) {
    if (names.length > 1) {
      devWarn(
        `Namespace "${ns}" is used by multiple plugins: [${names.join(', ')}]. ` +
          `Each plugin should use a unique namespace.`,
      )
    }
  }
}

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
  /**
   * Read a store registered by another plugin using its fully-qualified key.
   * Returns `undefined` if the key doesn't exist (does NOT throw).
   * Can only be called during `install` (after dependency plugins have run).
   *
   * @example
   * ```ts
   * reg.readStore<EditorSettings>('editor::settings')
   * ```
   */
  readStore<T = unknown>(fullyQualifiedKey: string): T | undefined
  /**
   * A shared {@link EventBus} for cross-plugin pub/sub. One instance is
   * created per {@link runPlugins} call and handed to every plugin's
   * `install` — it is the SAME instance for all of them (not namespaced),
   * because the entire point is letting plugins `emit`/`on` each other's
   * events without a hard import. Event names are plugin-namespaced by
   * CONVENTION only (e.g. `'pro-table:row-selected'`): `IrisPlugin` doesn't
   * declare a shared `Events` shape, so this is intentionally loosely typed
   * (`Record<string, unknown>`) at the registry boundary — a plugin author
   * can locally cast to a more specific `EventBus<MyEvents>` if desired. A
   * plugin that subscribes during `install` and wants automatic cleanup
   * should register the returned unsubscribe function via {@link onTeardown}.
   */
  bus: EventBus<Record<string, unknown>>
}

/**
 * A plugin: a name plus an `install` hook that registers into the registry.
 * `install` may optionally return a teardown function (run on unmount/swap).
 */
export interface IrisPlugin {
  readonly name: string
  /**
   * Optional namespace for token and store key isolation.
   * - Defaults to `name` if omitted.
   * - Only lowercase alphanumeric and hyphens allowed: `[a-z0-9-]+`
   * - Used as prefix: `--iris-{namespace}-{key}` for tokens,
   *   `'{namespace}::{key}'` for store keys.
   */
  readonly namespace?: string
  install(registry: PluginRegistry): void | (() => void)
  /**
   * Called when this plugin is REMOVED from the running set while the provider
   * stays mounted (e.g. dynamic plugin toggling). Runs after the teardowns
   * collected during `install`. Use it for cleanup that `teardown` cannot reach
   * because the plugin's whole install context is gone by then — unregistering
   * global event listeners, closing WebSocket connections, flushing caches.
   * Default (absent) is a no-op.
   */
  destroy?(): void
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
   * The same shared {@link EventBus} instance handed to every plugin as
   * `registry.bus` (see there for the cross-plugin pub/sub rationale). Exposed
   * here too so host application code — a framework adapter's `IrisProvider`,
   * or the consuming app itself — can also `emit`/`on` alongside the plugins.
   */
  bus: EventBus<Record<string, unknown>>
  /**
   * Run every registered teardown (from `install` return values and
   * `registry.onTeardown`) in LIFO order. Each is isolated (a throwing teardown
   * doesn't block the others) and the whole call is idempotent. The adapter
   * `IrisProvider` invokes this on unmount.
   */
  teardown(): void
}

/** Internal registry — same shape as PluginRegistry. */
type InternalRegistry = PluginRegistry

/**
 * Wrap a registry so token / store keys auto-prefix with `namespace`.
 * Plugin code calls the same methods unchanged.
 */
export function createNamespacedRegistry(
  base: InternalRegistry,
  namespace: string,
): PluginRegistry {
  const ns = namespace
  return {
    registerTokens(tokens) {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(tokens)) out[namespaceTokenKey(k, ns)] = v
      base.registerTokens(out)
    },
    registerMessages(locale, messages) {
      base.registerMessages(locale, messages)
    },
    registerStore(key, factory) {
      base.registerStore(namespaceStoreKey(key, ns), factory)
    },
    registerLazyStore(key, factory) {
      base.registerLazyStore(namespaceStoreKey(key, ns), factory)
    },
    onTeardown(fn) {
      base.onTeardown(fn)
    },
    readStore<T>(k: string): T | undefined {
      return base.readStore(k) as T | undefined
    },
    // Not namespaced: the whole point of the bus is letting plugins reach
    // each other without a hard import, so every plugin — namespaced or not —
    // shares the exact same instance.
    bus: base.bus,
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

export { runPlugins, reloadPlugins } from './plugin-runtime'
