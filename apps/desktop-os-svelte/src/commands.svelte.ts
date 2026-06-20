/**
 * The ONE command registry for this desktop shell — a module singleton over the
 * framework-agnostic `@iris-ui/core/commands` (`createCommandRegistry`). It's the
 * substrate behind the ⌘K / Ctrl+K command palette: app / window / system
 * actions `register` into it; the palette `search`es + `run`s it.
 *
 * `buildDesktopCommands` re-derives the live `Command[]` from a profile + WM
 * snapshot; the palette overlay re-registers them whenever that snapshot changes,
 * so commands always track the current apps + focused window.
 */
import {
  createCommandRegistry,
  type Command,
  type CommandHit,
  type CommandRegistry,
} from '@iris-ui/core/commands'
import type { WindowManagerState } from '@iris-ui/core/window'
import type { ProfileData } from '@iris-ui/core/profile'
import { wm } from './wm.svelte'
import { getApps, launchApp } from './profile.svelte'

export const registry: CommandRegistry = createCommandRegistry()

/**
 * The shared command registry — the Svelte counterpart of React's `useCommands()`
 * (in `apps/desktop-os/src/commands-context.tsx`). The shell keeps ONE module
 * singleton `registry`, so this is a thin accessor that lets app views (the
 * Assistant) read the same live registry the ⌘K palette searches + runs.
 */
export function useCommands(): CommandRegistry {
  return registry
}

/**
 * Build the live desktop `Command[]` from the current shell state — the set of
 * actions the ⌘K palette searches + runs. Three groups:
 *  - `Apps`   — "Open {name}" per currently-shown app (launch via the WM).
 *  - `Window` — act on the focused window (close / minimize / (un)maximize /
 *               snap); all gated on there being a focused window.
 *  - `System` — open the App Store.
 */
export function buildDesktopCommands(
  profileState: ProfileData,
  wmState: WindowManagerState,
): Command[] {
  const hasFocus = (): boolean => wm.getState().focusedId != null
  const withFocus =
    (fn: (id: string) => void): (() => void) =>
    () => {
      const id = wm.getState().focusedId
      if (id != null) fn(id)
    }

  const focused = wmState.windows.find((w) => w.id === wmState.focusedId) ?? null
  const target = focused?.title ?? 'window'
  const focusedState = focused?.state

  const appCommands: Command[] = getApps(profileState).map((app) => ({
    id: `app:${app.id}`,
    title: `Open ${app.name}`,
    keywords: `${app.name} ${app.description ?? ''} launch open app`,
    group: 'Apps',
    icon: app.icon,
    run: () => launchApp(app.id),
  }))

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
    {
      id: 'system:appstore',
      title: 'Open App Store',
      keywords: 'app store install browse apps',
      group: 'System',
      icon: '🛍️',
      run: () => launchApp('appstore'),
    },
  ]

  return [...appCommands, ...windowCommands, ...systemCommands]
}

export type { Command, CommandHit }
