import * as React from 'react'
import { createCommandRegistry, type Command, type CommandHit } from '@iris-ui-kit/core/commands'

/**
 * React glue around ONE `@iris-ui-kit/core/commands` registry — the substrate behind
 * the ⌘K command palette. A single registry instance lives in context; app /
 * window / system actions `register` into it, and the palette `search`es + `run`s
 * it. Apps register via {@link useRegisterCommands} (effect-scoped, auto-cleanup);
 * the palette reads live results via {@link useCommandSearch}.
 */

type Registry = ReturnType<typeof createCommandRegistry>

const CommandsContext = React.createContext<Registry | null>(null)

/** Provides the single shared command registry to the desktop subtree. */
export function CommandsProvider({ children }: { children: React.ReactNode }) {
  // One registry for the lifetime of the provider.
  const registry = React.useRef<Registry | null>(null)
  registry.current ??= createCommandRegistry()
  return <CommandsContext.Provider value={registry.current}>{children}</CommandsContext.Provider>
}

/** The shared command registry. Throws outside a {@link CommandsProvider}. */
export function useCommands(): Registry {
  const registry = React.useContext(CommandsContext)
  if (!registry) throw new Error('useCommands must be used within <CommandsProvider>')
  return registry
}

/**
 * Register `commands` for as long as this component is mounted, re-registering
 * whenever `deps` change (so commands track live state). Cleans up on unmount /
 * before each re-run via the `registerMany` unregister.
 */
export function useRegisterCommands(commands: Command[], deps: unknown[]): void {
  const registry = useCommands()
  // The caller owns the dependency contract: re-register when `deps` change.
  React.useEffect(() => registry.registerMany(commands), [registry, ...deps])
}

/**
 * Live search over the registry: subscribes to the registry store so results
 * re-derive when commands (or their enabled state) change, and re-runs whenever
 * `query` changes.
 */
export function useCommandSearch(query: string): CommandHit[] {
  const registry = useCommands()
  // Snapshot the registry state so useSyncExternalStore re-renders on changes;
  // the search itself is derived from that snapshot + the query.
  const state = React.useSyncExternalStore(registry.subscribe, registry.getState, registry.getState)
  // `state` is the change signal for the registry contents.
  return React.useMemo(() => registry.search(query), [registry, query, state])
}
