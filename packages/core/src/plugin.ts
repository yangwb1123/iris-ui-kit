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
}

/** The merged result of running every plugin's `install`. */
export interface CollectedRegistrations {
  /** Merged CSS custom properties across all plugins. */
  tokens: Record<string, string>
  /** locale → merged messages, across all plugins. */
  messages: Record<string, Record<string, string>>
  /** store key → the instance returned by its factory (already invoked). */
  stores: Map<string, unknown>
  /**
   * Run every registered teardown (from `install` return values and
   * `registry.onTeardown`) in LIFO order. Each is isolated (a throwing teardown
   * doesn't block the others) and the whole call is idempotent. The adapter
   * `IrisProvider` invokes this on unmount.
   */
  teardown(): void
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
 * Pure, synchronous, deterministic. Runs every plugin's `install` and collects
 * the registrations. This is the system's only real logic — the four adapter
 * providers delegate to it, so there is one implementation and one test suite.
 *
 * Store factories are invoked **eagerly** (once each) so server and client see
 * the same instances in SSR. Duplicate tokens / store keys win-last with a dev
 * warning; messages for a locale are deep-merged across plugins.
 */
export function runPlugins(plugins: readonly IrisPlugin[]): CollectedRegistrations {
  const tokens: Record<string, string> = {}
  const messages: Record<string, Record<string, string>> = {}
  const stores = new Map<string, unknown>()
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
    onTeardown(fn) {
      teardowns.push(fn)
    },
  }

  for (const plugin of plugins) {
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
