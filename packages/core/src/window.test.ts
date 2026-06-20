import { describe, it, expect } from 'vitest'
import {
  createWindowManager,
  snapRect,
  clampRect,
  serializeSession,
  restoreSession,
  type WindowManager,
} from './window'

const AREA = { x: 0, y: 0, width: 1000, height: 600 }
const make = (): WindowManager =>
  createWindowManager({ workArea: AREA, defaultSize: { width: 400, height: 300 } })

describe('createWindowManager — open / focus / z-order', () => {
  it('opens windows, cascades, and focuses the newest', () => {
    const wm = make()
    wm.open({ appId: 'files', title: 'A' })
    const b = wm.open({ appId: 'files', title: 'B' })
    expect(wm.getState().windows).toHaveLength(2)
    expect(wm.getState().focusedId).toBe(b)
    // Cascade: B is offset from A.
    const [wa, wb] = wm.getState().windows
    expect(wb!.rect.x).toBeGreaterThan(wa!.rect.x)
    // z-order: B on top.
    expect(wb!.z).toBeGreaterThan(wa!.z)
    expect(wm.ordered().map((w) => w.title)).toEqual(['A', 'B'])
  })

  it('focus raises a window to the front + flips focused flags', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A' })
    wm.open({ appId: 'x', title: 'B' })
    wm.focus(a)
    expect(wm.getState().focusedId).toBe(a)
    expect(wm.isFocused(a)).toBe(true)
    expect(wm.ordered().map((w) => w.title)).toEqual(['B', 'A']) // A now on top
    expect(wm.getState().windows.filter((w) => w.focused)).toHaveLength(1)
  })

  it('re-opening an existing id just focuses it (no duplicate)', () => {
    const wm = make()
    wm.open({ id: 'solo', appId: 'x', title: 'Solo' })
    wm.open({ appId: 'x', title: 'Other' })
    const id = wm.open({ id: 'solo', appId: 'x', title: 'Solo' })
    expect(id).toBe('solo')
    expect(wm.getState().windows).toHaveLength(2)
    expect(wm.getState().focusedId).toBe('solo')
  })
})

describe('createWindowManager — close / minimize', () => {
  it('closing the focused window focuses the next top-most', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A' })
    const b = wm.open({ appId: 'x', title: 'B' })
    wm.close(b)
    expect(wm.getState().windows).toHaveLength(1)
    expect(wm.getState().focusedId).toBe(a)
  })

  it('minimize hides from focus; focus() restores prior state', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A' })
    const b = wm.open({ appId: 'x', title: 'B' })
    wm.minimize(b)
    expect(wm.getState().windows.find((w) => w.id === b)!.state).toBe('minimized')
    expect(wm.getState().focusedId).toBe(a) // focus fell to A
    wm.focus(b)
    expect(wm.getState().windows.find((w) => w.id === b)!.state).toBe('normal')
    expect(wm.getState().focusedId).toBe(b)
  })

  it('minimizing a maximized window restores to maximized', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A' })
    wm.maximize(a)
    wm.minimize(a)
    expect(wm.getState().windows[0]!.state).toBe('minimized')
    wm.focus(a)
    expect(wm.getState().windows[0]!.state).toBe('maximized')
  })
})

describe('createWindowManager — maximize / restore / displayRect', () => {
  it('toggleMaximize flips maximized↔normal; displayRect uses work area when maximized', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A', rect: { x: 10, y: 10, width: 400, height: 300 } })
    wm.toggleMaximize(a)
    let win = wm.getState().windows[0]!
    expect(win.state).toBe('maximized')
    expect(wm.displayRect(win)).toEqual(AREA) // shows full work area
    expect(win.rect).toEqual({ x: 10, y: 10, width: 400, height: 300 }) // restore target preserved
    wm.toggleMaximize(a)
    win = wm.getState().windows[0]!
    expect(win.state).toBe('normal')
    expect(wm.displayRect(win)).toEqual(win.rect)
  })

  it('move / resize are no-ops while maximized, clamped while normal', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A', rect: { x: 50, y: 50, width: 400, height: 300 } })
    wm.maximize(a)
    wm.move(a, 999, 999)
    expect(wm.getState().windows[0]!.rect).toEqual({ x: 50, y: 50, width: 400, height: 300 })
    wm.restore(a)
    wm.move(a, 5000, 5000) // clamps inside the area
    const r = wm.getState().windows[0]!.rect
    expect(r.x).toBe(AREA.width - r.width)
    expect(r.y).toBe(AREA.height - r.height)
  })

  it('resize enforces minSize', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A', minSize: { width: 250, height: 150 } })
    wm.resize(a, 10, 10)
    expect(wm.getState().windows[0]!.rect.width).toBe(250)
    expect(wm.getState().windows[0]!.rect.height).toBe(150)
  })
})

describe('createWindowManager — snap', () => {
  it('snaps to the left half', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A' })
    wm.snap(a, 'left')
    expect(wm.getState().windows[0]!.rect).toEqual({ x: 0, y: 0, width: 500, height: 600 })
    expect(wm.getState().windows[0]!.state).toBe('normal')
  })

  it('snap maximize sets maximized state', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A' })
    wm.snap(a, 'maximize')
    expect(wm.getState().windows[0]!.state).toBe('maximized')
  })
})

describe('createWindowManager — setWorkArea re-clamps windows', () => {
  it('keeps windows inside a shrunken work area', () => {
    const wm = make()
    const a = wm.open({ appId: 'x', title: 'A', rect: { x: 800, y: 500, width: 200, height: 100 } })
    wm.setWorkArea({ x: 0, y: 0, width: 600, height: 400 })
    const r = wm.getState().windows[0]!.rect
    expect(r.x + r.width).toBeLessThanOrEqual(600)
    expect(r.y + r.height).toBeLessThanOrEqual(400)
    void a
  })
})

describe('pure geometry helpers', () => {
  it('snapRect computes halves and quadrants', () => {
    const area = { x: 0, y: 0, width: 1000, height: 600 }
    expect(snapRect('right', area)).toEqual({ x: 500, y: 0, width: 500, height: 600 })
    expect(snapRect('top', area)).toEqual({ x: 0, y: 0, width: 1000, height: 300 })
    expect(snapRect('bottom-right', area)).toEqual({ x: 500, y: 300, width: 500, height: 300 })
    expect(snapRect('maximize', area)).toEqual(area)
  })

  it('clampRect keeps a rect inside the area and respects minSize', () => {
    const area = { x: 0, y: 0, width: 800, height: 600 }
    expect(
      clampRect({ x: -50, y: -50, width: 100, height: 100 }, area, { width: 50, height: 50 }),
    ).toEqual({ x: 0, y: 0, width: 100, height: 100 })
    expect(
      clampRect({ x: 0, y: 0, width: 10, height: 10 }, area, { width: 50, height: 40 }),
    ).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 40,
    })
  })
})

describe('session serialize / restore', () => {
  it('serializes windows in ascending z with state + focus, and round-trips', () => {
    const wm = make()
    const a = wm.open({ appId: 'files', title: 'Files', rect: { x: 10, y: 10 } })
    const b = wm.open({ appId: 'notes', title: 'Notes', rect: { x: 60, y: 60 } })
    wm.maximize(a) // a now focused + maximized, raised above b
    const session = serializeSession(wm.getState())

    expect(session.map((e) => e.appId)).toEqual(['notes', 'files']) // ascending z: b then a
    const filesEntry = session.find((e) => e.appId === 'files')!
    expect(filesEntry.state).toBe('maximized')
    expect(filesEntry.focused).toBe(true)
    expect(session.find((e) => e.appId === 'notes')!.focused).toBe(false)
    void b

    // Restore into a fresh manager.
    const wm2 = make()
    const ids = restoreSession(wm2, session)
    expect(ids).toHaveLength(2)
    const s2 = wm2.getState()
    expect(s2.windows.map((w) => w.appId).sort()).toEqual(['files', 'notes'])
    const files2 = s2.windows.find((w) => w.appId === 'files')!
    expect(files2.state).toBe('maximized')
    expect(s2.focusedId).toBe(files2.id) // focus reapplied to the maximized window
    // The non-maximized window kept its normal rect.
    expect(s2.windows.find((w) => w.appId === 'notes')!.rect).toMatchObject({ x: 60, y: 60 })
  })

  it('restores a minimized window without focusing it', () => {
    const wm = make()
    wm.open({ appId: 'a', title: 'A' })
    const b = wm.open({ appId: 'b', title: 'B' })
    wm.minimize(b)
    const restored = make()
    restoreSession(restored, serializeSession(wm.getState()))
    const s = restored.getState()
    expect(s.windows.find((w) => w.appId === 'b')!.state).toBe('minimized')
    // focus landed on the non-minimized 'a'
    expect(s.windows.find((w) => w.id === s.focusedId)!.appId).toBe('a')
  })

  it('empty session restores nothing', () => {
    const wm = make()
    expect(restoreSession(wm, serializeSession(wm.getState()))).toEqual([])
    expect(wm.getState().windows).toHaveLength(0)
  })

  it('round-trips the per-window workspace', () => {
    const wm = createWindowManager({ workArea: AREA, workspaces: 3 })
    wm.open({ appId: 'a', title: 'A' }) // ws 0
    wm.setWorkspace(2)
    wm.open({ appId: 'b', title: 'B' }) // ws 2
    const session = serializeSession(wm.getState())
    expect(session.find((e) => e.appId === 'b')!.workspace).toBe(2)
    const wm2 = createWindowManager({ workArea: AREA, workspaces: 3 })
    restoreSession(wm2, session)
    expect(wm2.getState().windows.find((w) => w.appId === 'b')!.workspace).toBe(2)
    expect(wm2.getState().windows.find((w) => w.appId === 'a')!.workspace).toBe(0)
  })
})

describe('virtual desktops (workspaces)', () => {
  const wsWm = () => createWindowManager({ workArea: AREA, workspaces: 3 })

  it('defaults to 1 workspace; new windows land on the current desktop', () => {
    const plain = make()
    expect(plain.getState().workspaces).toBe(1)
    expect(plain.getState().currentWorkspace).toBe(0)
    const wm = wsWm()
    const a = wm.open({ appId: 'a', title: 'A' })
    expect(wm.getState().windows.find((w) => w.id === a)!.workspace).toBe(0)
    wm.setWorkspace(1)
    const b = wm.open({ appId: 'b', title: 'B' })
    expect(wm.getState().windows.find((w) => w.id === b)!.workspace).toBe(1)
    expect(wm.getState().currentWorkspace).toBe(1)
  })

  it('setWorkspace clamps and focuses the top window of the active desktop', () => {
    const wm = wsWm()
    const a = wm.open({ appId: 'a', title: 'A' }) // ws 0, focused
    wm.setWorkspace(1) // empty desktop → no focus
    expect(wm.getState().focusedId).toBeNull()
    wm.setWorkspace(99) // clamps to 2 (max), still empty
    expect(wm.getState().currentWorkspace).toBe(2)
    wm.setWorkspace(0) // back to ws 0 → refocuses 'a'
    expect(wm.getState().focusedId).toBe(a)
  })

  it('moveWindowToWorkspace moves a window and refocuses if it left the active desktop', () => {
    const wm = wsWm()
    const a = wm.open({ appId: 'a', title: 'A' })
    const b = wm.open({ appId: 'b', title: 'B' }) // focused, ws 0
    wm.moveWindowToWorkspace(b, 2)
    expect(wm.getState().windows.find((w) => w.id === b)!.workspace).toBe(2)
    // b was focused but moved off ws 0 → focus falls back to 'a'
    expect(wm.getState().focusedId).toBe(a)
  })
})
