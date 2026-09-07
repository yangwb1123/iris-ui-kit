import { describe, it, expect } from 'vitest'
import { createWindowManager, type WindowManager } from './window'

const AREA = { x: 0, y: 0, width: 1000, height: 600 }
const make = (): WindowManager =>
  createWindowManager({ workArea: AREA, defaultSize: { width: 400, height: 300 } })

describe('window input ownership and workspace invariants', () => {
  it('copies the configured work area instead of observing later caller mutation', () => {
    const area = { ...AREA }
    const wm = createWindowManager({ workArea: area })
    area.width = 1
    expect(wm.getState().workArea).toEqual(AREA)
  })

  it('normalizes malformed manager config without poisoning state', () => {
    const wm = createWindowManager({
      workArea: { x: Number.NaN, y: -10, width: Number.NaN, height: -20 },
      defaultSize: { width: Number.NaN, height: Number.POSITIVE_INFINITY },
      cascadeStep: Number.NaN,
      workspaces: Number.NaN,
    })
    const id = wm.open({ appId: 'x', title: 'X', workspace: Number.NaN })
    const state = wm.getState()
    const win = state.windows.find((entry) => entry.id === id)!
    expect(state.workspaces).toBe(1)
    expect(state.currentWorkspace).toBe(0)
    expect(
      [state.workArea, win.rect, win.minSize].flatMap(Object.values).every(Number.isFinite),
    ).toBe(true)
    expect(win.workspace).toBe(0)
  })

  it('clears the focused flag when switching to an empty workspace', () => {
    const wm = createWindowManager({ workArea: AREA, workspaces: 2 })
    const id = wm.open({ appId: 'x', title: 'X' })
    wm.setWorkspace(1)
    expect(wm.getState().focusedId).toBeNull()
    expect(wm.getState().windows.find((entry) => entry.id === id)!.focused).toBe(false)
  })

  it('does not focus a window on an inactive workspace', () => {
    const wm = createWindowManager({ workArea: AREA, workspaces: 2 })
    wm.setWorkspace(1)
    const id = wm.open({ appId: 'x', title: 'X', workspace: 0 })
    wm.focus(id)
    expect(wm.getState().focusedId).toBeNull()
    expect(wm.getState().windows.find((entry) => entry.id === id)!.focused).toBe(false)
  })

  it('does not leave a removed window focused after a re-entrant subscriber callback', () => {
    const wm = make()
    const id = wm.open({ appId: 'x', title: 'X' })
    wm.minimize(id)
    let closed = false
    const unsubscribe = wm.subscribe((state) => {
      if (!closed && state.windows.find((entry) => entry.id === id)?.state === 'normal') {
        closed = true
        wm.close(id)
      }
    })
    wm.focus(id)
    unsubscribe()
    expect(wm.getState().windows).toEqual([])
    expect(wm.getState().focusedId).toBeNull()
  })
})
