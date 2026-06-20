/**
 * Vue glue around ONE `@iris-ui/core/commands` registry — the substrate behind
 * the ⌘K / Ctrl+K command palette. A single registry instance lives as a module
 * singleton (mirrors the wm.ts / profile.ts pattern); app / window / system
 * actions register into it, and the palette searches + runs it.
 */
import { computed, watchEffect, type ComputedRef } from 'vue'
import {
  createCommandRegistry,
  type Command,
  type CommandHit,
  type CommandRegistry,
} from '@iris-ui/core/commands'
import { wm, useWmState } from './wm'
import { useApps, launchApp } from './profile'
import { useOs } from './os-state'
import { OS_ORDER, CHROMES } from './os'

/** The single, app-wide command registry. */
export const registry: CommandRegistry = createCommandRegistry()

/** The shared command registry. */
export function useCommands(): CommandRegistry {
  return registry
}

/**
 * Build the live desktop `Command[]` from the current shell state — the set of
 * actions the palette searches + runs. Three groups:
 *  - `Apps`   — "Open {name}" per currently-shown app (launch via the WM).
 *  - `Window` — act on the focused window (close / minimize / (un)maximize);
 *               all gated on there being a focused window.
 *  - `System` — switch OS skin (per {@link OS_ORDER}) + open the App Store +
 *               search the web.
 */
export function useDesktopCommands(): ComputedRef<Command[]> {
  const apps = useApps()
  const state = useWmState()
  const { setOs } = useOs()

  return computed<Command[]>(() => {
    const wmState = state.value
    const focused = wmState.windows.find((w) => w.id === wmState.focusedId) ?? null

    const hasFocus = (): boolean => wm.getState().focusedId != null
    const withFocus =
      (fn: (id: string) => void): (() => void) =>
      () => {
        const id = wm.getState().focusedId
        if (id != null) fn(id)
      }

    const appCommands: Command[] = apps.value.map((app) => ({
      id: `app:${app.id}`,
      title: `Open ${app.name}`,
      keywords: `${app.name} ${app.description ?? ''} launch open app`,
      group: 'Apps',
      icon: app.icon,
      run: () => launchApp(app.id),
    }))

    const target = focused?.title ?? 'window'
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
        title: `${focused?.state === 'maximized' ? 'Restore' : 'Maximize'} ${target}`,
        keywords: 'maximize restore fullscreen window zoom',
        group: 'Window',
        icon: '▢',
        enabled: hasFocus,
        run: withFocus((id) => wm.toggleMaximize(id)),
      },
    ]

    const systemCommands: Command[] = [
      ...OS_ORDER.map(
        (id): Command => ({
          id: `system:os:${id}`,
          title: `Switch to ${CHROMES[id].label}`,
          keywords: `${CHROMES[id].label} skin theme os switch windows macos`,
          group: 'System',
          icon: '🖥️',
          run: () => setOs(id),
        }),
      ),
      {
        id: 'system:appstore',
        title: 'Open App Store',
        keywords: 'app store install browse apps',
        group: 'System',
        icon: '🛍️',
        run: () => launchApp('appstore'),
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

/**
 * Keep the shared registry in sync with the live desktop commands for the
 * lifetime of the caller's scope. Re-registers whenever the derived command set
 * changes (apps installed/removed, focus changes, …) and cleans up on scope stop.
 */
export function useRegisterDesktopCommands(): void {
  const commands = useDesktopCommands()
  watchEffect((onCleanup) => {
    const unregister = registry.registerMany(commands.value)
    onCleanup(unregister)
  })
}

export type { Command, CommandHit }
