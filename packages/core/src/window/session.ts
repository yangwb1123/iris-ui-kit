import type { WindowManager, WindowManagerState, WindowSession } from './types'

/**
 * Snapshot the manager state into a JSON-able session. Windows are emitted in
 * ascending z so restoring them in array order recreates the same stacking.
 */
export function serializeSession<Meta = unknown>(
  state: WindowManagerState<Meta>,
): WindowSession<Meta> {
  return [...state.windows]
    .sort((a, b) => a.z - b.z)
    .map((w) => ({
      appId: w.appId,
      title: w.title,
      rect: w.rect,
      state: w.state,
      minSize: w.minSize,
      meta: w.meta,
      workspace: w.workspace,
      focused: w.focused,
    }))
}

/**
 * Re-open windows from a persisted session into `wm`. Runtime ids and z values
 * are regenerated; state, geometry, workspace, and focus are reapplied.
 */
export function restoreSession<Meta = unknown>(
  wm: WindowManager<Meta>,
  session: WindowSession<Meta>,
): string[] {
  const ids: string[] = []
  let focusId: string | undefined
  for (const entry of session) {
    const id = wm.open({
      appId: entry.appId,
      title: entry.title,
      rect: entry.rect,
      minSize: entry.minSize,
      meta: entry.meta,
      workspace: entry.workspace,
    })
    ids.push(id)
    if (entry.state === 'maximized') wm.maximize(id)
    else if (entry.state === 'minimized') wm.minimize(id)
    if (entry.focused && entry.state !== 'minimized') focusId = id
  }
  if (focusId) wm.focus(focusId)
  return ids
}
