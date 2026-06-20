import * as React from 'react'
import { type Command } from '@iris-ui/core/commands'
import { OS_ORDER, CHROMES } from './os'
import { useApps, useLaunchApp, useOs, useWm, useWmState } from './shell'

/**
 * Build the live desktop `Command[]` from the current shell state — the set of
 * actions the ⌘K palette searches + runs. Three groups:
 *  - `Apps`   — "Open {name}" per currently-shown app (launch via the WM).
 *  - `Window` — act on the focused window (close / minimize / (un)maximize /
 *               snap); all gated on there being a focused window.
 *  - `System` — switch OS skin (per {@link OS_ORDER}) + open the App Store.
 *
 * Memoized on the inputs it reads so the registry only re-registers when the
 * relevant state actually changes.
 */
export function useDesktopCommands(): Command[] {
  const wm = useWm()
  const { windows, focusedId } = useWmState()
  const { setOs } = useOs()
  const apps = useApps()
  const launch = useLaunchApp()

  const focused = React.useMemo(
    () => windows.find((w) => w.id === focusedId) ?? null,
    [windows, focusedId],
  )
  const focusedTitle = focused?.title
  const focusedState = focused?.state

  return React.useMemo<Command[]>(() => {
    const hasFocus = (): boolean => wm.getState().focusedId != null
    const withFocus =
      (fn: (id: string) => void): (() => void) =>
      () => {
        const id = wm.getState().focusedId
        if (id != null) fn(id)
      }

    const appCommands: Command[] = apps.map((app) => ({
      id: `app:${app.id}`,
      title: `Open ${app.name}`,
      keywords: `${app.name} ${app.description ?? ''} launch open app`,
      group: 'Apps',
      icon: app.icon,
      run: () => launch(app.id),
    }))

    const target = focusedTitle ?? 'window'
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
        title: `${focusedState === 'maximized' ? 'Restore' : 'Maximize'} ${target}`,
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
      ...OS_ORDER.map(
        (id): Command => ({
          id: `system:os:${id}`,
          title: `Switch to ${CHROMES[id].label}`,
          keywords: `${CHROMES[id].label} skin theme os switch`,
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
        run: () => launch('appstore'),
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
  }, [wm, apps, launch, setOs, focusedTitle, focusedState])
}
