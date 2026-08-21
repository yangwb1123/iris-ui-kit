import { createStore } from '../store'
import { generateId } from '../utils'
import { clampRect, cascadeRect, snapRect } from './geometry'
import type {
  DesktopWindow,
  OpenWindowOptions,
  SnapZone,
  WindowManager,
  WindowManagerConfig,
  WindowManagerState,
  WindowRect,
  WindowSize,
} from './types'

const DEFAULT_AREA: WindowRect = { x: 0, y: 0, width: 1280, height: 720 }
const DEFAULT_SIZE: WindowSize = { width: 720, height: 480 }
const DEFAULT_MIN: WindowSize = { width: 200, height: 120 }

export function createWindowManager<Meta = unknown>(
  config: WindowManagerConfig = {},
): WindowManager<Meta> {
  const cascadeStep = config.cascadeStep ?? 28
  const defaultSize = config.defaultSize ?? DEFAULT_SIZE
  const workspaces = Math.max(1, config.workspaces ?? 1)
  const Z_REBALANCE_THRESHOLD = 100_000

  const clampWs = (n: number): number => Math.max(0, Math.min(Math.trunc(n), workspaces - 1))

  let zCounter = 0
  let openCount = 0

  const store = createStore<WindowManagerState<Meta>>({
    windows: [],
    focusedId: null,
    workArea: config.workArea ?? DEFAULT_AREA,
    workspaces,
    currentWorkspace: 0,
  })

  const rebalanceZ = (): void => {
    const s = store.getState()
    if (s.windows.length === 0) {
      zCounter = 0
      return
    }
    const sorted = [...s.windows].sort((a, b) => a.z - b.z)
    const focusedId = s.focusedId
    const focalIndex = sorted.findIndex((w) => w.id === focusedId)
    const winMap = new Map<string, DesktopWindow<Meta>>()
    let z = 1
    for (let i = 0; i < sorted.length; i++) {
      if (i === focalIndex) continue
      winMap.set(sorted[i]!.id, { ...sorted[i]!, z: z++ })
    }
    if (focusedId && focalIndex >= 0) {
      winMap.set(sorted[focalIndex]!.id, { ...sorted[focalIndex]!, z: z++ })
    }
    zCounter = sorted.length
    store.setState((st) => ({
      ...st,
      windows: s.windows.map((w) => winMap.get(w.id) ?? w),
    }))
  }

  const raiseZ = (): number => {
    zCounter += 1
    if (zCounter > Z_REBALANCE_THRESHOLD) {
      rebalanceZ()
      return zCounter
    }
    return zCounter
  }

  const find = (id: string): DesktopWindow<Meta> | undefined =>
    store.getState().windows.find((w) => w.id === id)

  /** Immutably patch one window in a single store update. */
  const patch = (id: string, next: (w: DesktopWindow<Meta>) => DesktopWindow<Meta>): void =>
    store.setState((s) => ({
      ...s,
      windows: s.windows.map((w) => (w.id === id ? next(w) : w)),
    }))

  const raise = (id: string): void => {
    const z = raiseZ()
    store.setState((s) => ({
      ...s,
      focusedId: id,
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, z, focused: true } : w.focused ? { ...w, focused: false } : w,
      ),
    }))
  }

  /** Focus the top-most non-minimized window on the current workspace. */
  const focusTop = (): void => {
    const s = store.getState()
    const candidates = s.windows
      .filter((w) => w.state !== 'minimized' && w.workspace === s.currentWorkspace)
      .sort((a, b) => b.z - a.z)
    const next = candidates[0]
    if (next) raise(next.id)
    else store.setState((st) => ({ ...st, focusedId: null }))
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,

    open(options: OpenWindowOptions<Meta>) {
      const existing = options.id ? find(options.id) : undefined
      if (existing) {
        this.focus(existing.id)
        return existing.id
      }
      const id = options.id ?? generateId('win')
      const area = store.getState().workArea
      const minSize = { ...DEFAULT_MIN, ...options.minSize }
      const size = {
        width: options.rect?.width ?? defaultSize.width,
        height: options.rect?.height ?? defaultSize.height,
      }
      const base = cascadeRect(openCount, area, size, cascadeStep)
      const rect = clampRect(
        { x: options.rect?.x ?? base.x, y: options.rect?.y ?? base.y, ...size },
        area,
        minSize,
      )
      openCount += 1
      const z = raiseZ()
      store.setState((s) => ({
        ...s,
        focusedId: id,
        windows: [
          ...s.windows.map((w) => (w.focused ? { ...w, focused: false } : w)),
          {
            id,
            appId: options.appId,
            title: options.title,
            rect,
            z,
            state: 'normal',
            focused: true,
            minSize,
            meta: (options.meta ?? undefined) as Meta,
            workspace: clampWs(options.workspace ?? store.getState().currentWorkspace),
            prevState: 'normal',
          },
        ],
      }))
      return id
    },

    close(id: string) {
      const wasFocused = store.getState().focusedId === id
      store.setState((s) => ({ ...s, windows: s.windows.filter((w) => w.id !== id) }))
      if (wasFocused) focusTop()
    },

    focus(id: string) {
      const w = find(id)
      if (!w) return
      if (w.state === 'minimized') patch(id, (win) => ({ ...win, state: win.prevState }))
      raise(id)
    },

    minimize(id: string) {
      const w = find(id)
      if (!w || w.state === 'minimized') return
      patch(id, (win) => ({
        ...win,
        prevState: win.state === 'maximized' ? 'maximized' : 'normal',
        state: 'minimized',
        focused: false,
      }))
      if (store.getState().focusedId === id) focusTop()
    },

    maximize(id: string) {
      patch(id, (w) => ({ ...w, state: 'maximized' }))
      this.focus(id)
    },

    restore(id: string) {
      patch(id, (w) => ({ ...w, state: 'normal' }))
      this.focus(id)
    },

    toggleMaximize(id: string) {
      const w = find(id)
      if (!w) return
      if (w.state === 'maximized') this.restore(id)
      else this.maximize(id)
    },

    move(id: string, x: number, y: number) {
      const w = find(id)
      if (!w || w.state === 'maximized') return
      const area = store.getState().workArea
      patch(id, (win) => ({ ...win, rect: clampRect({ ...win.rect, x, y }, area, win.minSize) }))
    },

    resize(id: string, width: number, height: number) {
      const w = find(id)
      if (!w || w.state === 'maximized') return
      const area = store.getState().workArea
      patch(id, (win) => ({
        ...win,
        rect: clampRect({ ...win.rect, width, height }, area, win.minSize),
      }))
    },

    setRect(id: string, rect: Partial<WindowRect>) {
      const w = find(id)
      if (!w) return
      const area = store.getState().workArea
      patch(id, (win) => ({ ...win, rect: clampRect({ ...win.rect, ...rect }, area, win.minSize) }))
    },

    snap(id: string, zone: SnapZone) {
      const w = find(id)
      if (!w) return
      if (zone === 'maximize') {
        this.maximize(id)
        return
      }
      const rect = snapRect(zone, store.getState().workArea)
      patch(id, (win) => ({ ...win, state: 'normal', rect }))
      this.focus(id)
    },

    setWorkArea(rect: WindowRect) {
      store.setState((s) => ({
        ...s,
        workArea: rect,
        windows: s.windows.map((w) => ({ ...w, rect: clampRect(w.rect, rect, w.minSize) })),
      }))
    },

    setWorkspace(index: number) {
      const next = clampWs(index)
      if (next === store.getState().currentWorkspace) return
      store.setState((s) => ({ ...s, currentWorkspace: next }))
      focusTop()
    },

    moveWindowToWorkspace(id: string, index: number) {
      const w = find(id)
      if (!w) return
      const ws = clampWs(index)
      patch(id, (win) => ({ ...win, workspace: ws }))
      const s = store.getState()
      if (s.focusedId === id && ws !== s.currentWorkspace) focusTop()
    },

    ordered: () => [...store.getState().windows].sort((a, b) => a.z - b.z),

    displayRect(window: DesktopWindow<Meta>) {
      return window.state === 'maximized' ? store.getState().workArea : window.rect
    },

    isFocused: (id: string) => store.getState().focusedId === id,

    rebalanceZ,
  }
}
