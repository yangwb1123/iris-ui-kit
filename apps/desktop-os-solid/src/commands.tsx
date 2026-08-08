import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
  type JSX,
} from 'solid-js'
import { type Command, type CommandHit, type CommandRegistry } from '@iris-ui-kit/core/commands'
import { OS_ORDER, CHROMES } from './os'
import { useWm, useWmState } from './wm'
import { useApps, useLaunchApp } from './profile'
import { useOs } from './os-state'

/**
 * Solid glue around ONE `@iris-ui-kit/core/commands` registry — the substrate behind
 * the ⌘K command palette AND an agent/automation layer. A single registry lives
 * in context; app / window / system actions `register` into it (via
 * {@link registerCommands}), and the palette `search`es + `run`s it
 * ({@link useCommandSearch}). The SAME engine the React desktop drives, on Solid.
 */
const CommandsContext = createContext<CommandRegistry>()

export function CommandsProvider(props: {
  registry: CommandRegistry
  children: JSX.Element
}): JSX.Element {
  return (
    <CommandsContext.Provider value={props.registry}>{props.children}</CommandsContext.Provider>
  )
}

/** The shared command registry. Throws outside a {@link CommandsProvider}. */
export function useCommands(): CommandRegistry {
  const registry = useContext(CommandsContext)
  if (!registry) throw new Error('useCommands must be used within <CommandsProvider>')
  return registry
}

/**
 * Register the commands produced by `commands()` for as long as the owning scope
 * is alive, re-registering whenever the accessor's result changes (so commands
 * track live state). Cleans up via the `registerMany` unregister.
 */
export function registerCommands(commands: () => Command[]): void {
  const registry = useCommands()
  createEffect(() => {
    const unregister = registry.registerMany(commands())
    onCleanup(unregister)
  })
}

/**
 * Live search over the registry as a Solid accessor: tracks the registry store
 * (so results re-derive when commands or their enabled state change) and re-runs
 * whenever `query()` changes.
 */
export function useCommandSearch(query: () => string): () => CommandHit[] {
  const registry = useCommands()
  const [version, setVersion] = createSignal(0)
  const unsubscribe = registry.subscribe(() => setVersion((v) => v + 1))
  onCleanup(unsubscribe)
  return createMemo(() => {
    version() // re-run when the registry contents change
    return registry.search(query())
  })
}

/**
 * Build the live desktop `Command[]` from the current shell state — the set of
 * actions the ⌘K palette searches + runs. Three groups:
 *  - `Apps`   — "Open {name}" per currently-shown app (launch via the WM).
 *  - `Window` — act on the focused window (close / minimize / (un)maximize /
 *               snap); all gated on there being a focused window.
 *  - `System` — switch OS skin (per {@link OS_ORDER}) + open the App Store.
 *
 * Returns a Solid accessor so the registry re-registers when the relevant state
 * actually changes (apps installed, focus / maximize state).
 */
export function useDesktopCommands(): () => Command[] {
  const wm = useWm()
  const state = useWmState()
  const apps = useApps()
  const launch = useLaunchApp()
  const { setOs } = useOs()

  const focused = createMemo(() => {
    const s = state()
    return s.windows.find((w) => w.id === s.focusedId) ?? null
  })

  return createMemo<Command[]>(() => {
    const hasFocus = (): boolean => wm.getState().focusedId != null
    const withFocus =
      (fn: (id: string) => void): (() => void) =>
      () => {
        const id = wm.getState().focusedId
        if (id != null) fn(id)
      }

    const appCommands: Command[] = apps().map((app) => ({
      id: `app:${app.id}`,
      title: `Open ${app.name}`,
      keywords: `${app.name} ${app.description ?? ''} launch open app`,
      group: 'Apps',
      icon: app.icon,
      run: () => launch(app.id),
    }))

    const target = focused()?.title ?? 'window'
    const windowCommands: Command[] = [
      {
        id: 'window:close',
        title: `Close ${target}`,
        keywords: 'close window quit',
        group: 'Window',
        icon: '✕',
        enabled: hasFocus,
        run: withFocus((id) => wm.close(id)),
      },
      {
        id: 'window:minimize',
        title: `Minimize ${target}`,
        keywords: 'minimize hide window',
        group: 'Window',
        icon: '—',
        enabled: hasFocus,
        run: withFocus((id) => wm.minimize(id)),
      },
      {
        id: 'window:maximize',
        title: `${focused()?.state === 'maximized' ? 'Restore' : 'Maximize'} ${target}`,
        keywords: 'maximize restore fullscreen window zoom',
        group: 'Window',
        icon: '▢',
        enabled: hasFocus,
        run: withFocus((id) => wm.toggleMaximize(id)),
      },
      {
        id: 'window:snap-left',
        title: `Snap ${target} Left`,
        keywords: 'snap tile left half window',
        group: 'Window',
        icon: '◧',
        enabled: hasFocus,
        run: withFocus((id) => wm.snap(id, 'left')),
      },
      {
        id: 'window:snap-right',
        title: `Snap ${target} Right`,
        keywords: 'snap tile right half window',
        group: 'Window',
        icon: '◨',
        enabled: hasFocus,
        run: withFocus((id) => wm.snap(id, 'right')),
      },
    ]

    const systemCommands: Command[] = [
      ...OS_ORDER.map((id): Command => ({
        id: `system:os:${id}`,
        title: `Switch to ${CHROMES[id].label}`,
        keywords: `${CHROMES[id].label} skin theme os switch appearance`,
        group: 'System',
        icon: '🖥️',
        run: () => setOs(id),
      })),
      {
        id: 'system:appstore',
        title: 'Open App Store',
        keywords: 'app store install browse apps',
        group: 'System',
        icon: '🛍️',
        run: () => launch('appstore'),
      },
      {
        id: 'system:workspace:next',
        title: 'Next desktop',
        keywords: 'workspace virtual desktop next switch pager',
        group: 'System',
        icon: '🗗',
        enabled: () => wm.getState().workspaces > 1,
        run: () => {
          const s = wm.getState()
          wm.setWorkspace((s.currentWorkspace + 1) % s.workspaces)
        },
      },
      {
        id: 'system:workspace:prev',
        title: 'Previous desktop',
        keywords: 'workspace virtual desktop previous switch pager',
        group: 'System',
        icon: '🗗',
        enabled: () => wm.getState().workspaces > 1,
        run: () => {
          const s = wm.getState()
          wm.setWorkspace((s.currentWorkspace - 1 + s.workspaces) % s.workspaces)
        },
      },
      {
        // A PARAMETERIZED command: the agent fills `query` from the request
        // (e.g. "search the web for otters"). Projected into the MCP tool schema
        // via Command.params; the ⌘K palette runs it arg-less (no-op).
        id: 'system:search',
        title: 'Search the web',
        keywords: 'search web query find lookup google duckduckgo',
        group: 'System',
        icon: '🔎',
        params: {
          query: { type: 'string', description: 'The search terms', required: true },
        },
        run: (args) => {
          const query = typeof args?.query === 'string' ? args.query.trim() : ''
          if (!query) return
          globalThis.open?.(
            `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            '_blank',
            'noopener',
          )
        },
      },
    ]

    return [...appCommands, ...windowCommands, ...systemCommands]
  })
}
