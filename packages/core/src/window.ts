import { createStore, type Store } from './store'
import { generateId } from './utils'

/**
 * `@iris-ui/core/window` — a framework-agnostic WINDOW MANAGER: the state engine
 * behind a desktop-environment UI (Windows / macOS / KDE style shells). Owns the
 * window lifecycle — open/close, focus + z-order (raise-to-front), minimize,
 * maximize/restore, move/resize geometry, and edge-snap/tiling — over a
 * subscribable {@link Store}. Pure logic + pure geometry helpers; the framework
 * adapter renders windows and wires drag/resize (e.g. IrisMovable/IrisResizable)
 * to `move`/`resize`. The three OS looks are skins over the SAME manager.
 *
 * Off the core path (its own subpath) — desktop shells opt in; the base bundle
 * never pays for it.
 */

export type WindowState = 'normal' | 'minimized' | 'maximized'

/** Edge/quadrant snap targets (+ `maximize` for full work-area, `center`). */
export type SnapZone =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'maximize'
  | 'center'

export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowSize {
  width: number
  height: number
}

export interface DesktopWindow<Meta = unknown> {
  id: string
  /** App identity (multiple windows can share an appId). */
  appId: string
  title: string
  /** The "normal" geometry — the restore target; maximize/minimize don't mutate it. */
  rect: WindowRect
  /** Stacking order; higher is closer to the front. */
  z: number
  state: WindowState
  focused: boolean
  /** Minimum size enforced by `resize`. */
  minSize: WindowSize
  /** App-specific payload (icon id, component key, route, …). */
  meta: Meta
  /** Internal: the state to return to when a minimized window is restored. */
  prevState: Exclude<WindowState, 'minimized'>
}

export interface WindowManagerConfig {
  /** Usable desktop area (exclude the taskbar/panel). Drives snap + maximize. */
  workArea?: WindowRect
  /** Default size for a newly-opened window. */
  defaultSize?: WindowSize
  /** Cascade offset (px) applied per concurrently-open window. Default 28. */
  cascadeStep?: number
}

export interface OpenWindowOptions<Meta = unknown> {
  /** Stable id; auto-generated when omitted. */
  id?: string
  appId: string
  title: string
  /** Initial geometry; missing fields are cascaded / defaulted. */
  rect?: Partial<WindowRect>
  minSize?: Partial<WindowSize>
  meta?: Meta
}

export interface WindowManagerState<Meta = unknown> {
  /** Windows in stable insertion order (NOT z-order — sort by `z` to render). */
  windows: DesktopWindow<Meta>[]
  focusedId: string | null
  workArea: WindowRect
}

export interface WindowManager<Meta = unknown> {
  store: Store<WindowManagerState<Meta>>
  getState(): WindowManagerState<Meta>
  subscribe(listener: (state: WindowManagerState<Meta>) => void): () => void
  /** Open (or re-focus an existing id), cascading placement + raising to front. Returns the id. */
  open(options: OpenWindowOptions<Meta>): string
  close(id: string): void
  /** Raise to front + focus; restores a minimized window. */
  focus(id: string): void
  minimize(id: string): void
  /** Maximize ↔ restore. */
  toggleMaximize(id: string): void
  maximize(id: string): void
  restore(id: string): void
  /** Move the normal-state rect (clamped into the work area). No-op while maximized. */
  move(id: string, x: number, y: number): void
  /** Resize the normal-state rect (clamped to minSize). No-op while maximized. */
  resize(id: string, width: number, height: number): void
  setRect(id: string, rect: Partial<WindowRect>): void
  /** Snap to an edge/quadrant/maximize/center, computed from the work area. */
  snap(id: string, zone: SnapZone): void
  setWorkArea(rect: WindowRect): void
  /** Windows sorted by ascending z — the order to paint them. */
  ordered(): DesktopWindow<Meta>[]
  /** The geometry to actually render for a window (work area when maximized). */
  displayRect(window: DesktopWindow<Meta>): WindowRect
  isFocused(id: string): boolean
}

const DEFAULT_AREA: WindowRect = { x: 0, y: 0, width: 1280, height: 720 }
const DEFAULT_SIZE: WindowSize = { width: 720, height: 480 }
const DEFAULT_MIN: WindowSize = { width: 200, height: 120 }

/** Geometry for a snap zone within `area`. Pure. */
export function snapRect(zone: SnapZone, area: WindowRect): WindowRect {
  const { x, y, width: w, height: h } = area
  const halfW = Math.round(w / 2)
  const halfH = Math.round(h / 2)
  switch (zone) {
    case 'maximize':
      return { x, y, width: w, height: h }
    case 'left':
      return { x, y, width: halfW, height: h }
    case 'right':
      return { x: x + halfW, y, width: w - halfW, height: h }
    case 'top':
      return { x, y, width: w, height: halfH }
    case 'bottom':
      return { x, y: y + halfH, width: w, height: h - halfH }
    case 'top-left':
      return { x, y, width: halfW, height: halfH }
    case 'top-right':
      return { x: x + halfW, y, width: w - halfW, height: halfH }
    case 'bottom-left':
      return { x, y: y + halfH, width: halfW, height: h - halfH }
    case 'bottom-right':
      return { x: x + halfW, y: y + halfH, width: w - halfW, height: h - halfH }
    case 'center': {
      const cw = Math.round(w * 0.6)
      const ch = Math.round(h * 0.6)
      return {
        x: x + Math.round((w - cw) / 2),
        y: y + Math.round((h - ch) / 2),
        width: cw,
        height: ch,
      }
    }
  }
}

/** Clamp `rect` to sit within `area`, enforcing `minSize`. Pure. */
export function clampRect(rect: WindowRect, area: WindowRect, minSize: WindowSize): WindowRect {
  const width = Math.max(minSize.width, Math.min(rect.width, area.width))
  const height = Math.max(minSize.height, Math.min(rect.height, area.height))
  const x = Math.max(area.x, Math.min(rect.x, area.x + area.width - width))
  const y = Math.max(area.y, Math.min(rect.y, area.y + area.height - height))
  return { x, y, width, height }
}

/** Cascade placement for the Nth concurrently-open window. Pure. */
export function cascadeRect(
  index: number,
  area: WindowRect,
  size: WindowSize,
  step: number,
): WindowRect {
  const span = 6 // wrap the cascade so it never marches off-screen
  const off = (index % span) * step
  return clampRect({ x: area.x + 32 + off, y: area.y + 24 + off, ...size }, area, size)
}

export function createWindowManager<Meta = unknown>(
  config: WindowManagerConfig = {},
): WindowManager<Meta> {
  const cascadeStep = config.cascadeStep ?? 28
  const defaultSize = config.defaultSize ?? DEFAULT_SIZE
  let zCounter = 0
  let openCount = 0

  const store = createStore<WindowManagerState<Meta>>({
    windows: [],
    focusedId: null,
    workArea: config.workArea ?? DEFAULT_AREA,
  })

  const find = (id: string): DesktopWindow<Meta> | undefined =>
    store.getState().windows.find((w) => w.id === id)

  /** Immutably patch one window + optionally set focus, in a single emit. */
  const patch = (id: string, next: (w: DesktopWindow<Meta>) => DesktopWindow<Meta>): void =>
    store.setState((s) => ({
      ...s,
      windows: s.windows.map((w) => (w.id === id ? next(w) : w)),
    }))

  const raise = (id: string): void => {
    zCounter += 1
    const z = zCounter
    store.setState((s) => ({
      ...s,
      focusedId: id,
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, z, focused: true } : w.focused ? { ...w, focused: false } : w,
      ),
    }))
  }

  /** Focus the top-most non-minimized window (after a close/minimize). */
  const focusTop = (): void => {
    const candidates = store
      .getState()
      .windows.filter((w) => w.state !== 'minimized')
      .sort((a, b) => b.z - a.z)
    const next = candidates[0]
    if (next) raise(next.id)
    else store.setState((s) => ({ ...s, focusedId: null }))
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,

    open(options) {
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
      zCounter += 1
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
            z: zCounter,
            state: 'normal',
            focused: true,
            minSize,
            meta: (options.meta ?? undefined) as Meta,
            prevState: 'normal',
          },
        ],
      }))
      return id
    },

    close(id) {
      const wasFocused = store.getState().focusedId === id
      store.setState((s) => ({ ...s, windows: s.windows.filter((w) => w.id !== id) }))
      if (wasFocused) focusTop()
    },

    focus(id) {
      const w = find(id)
      if (!w) return
      if (w.state === 'minimized') patch(id, (win) => ({ ...win, state: win.prevState }))
      raise(id)
    },

    minimize(id) {
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

    maximize(id) {
      patch(id, (w) => ({ ...w, state: 'maximized' }))
      this.focus(id)
    },

    restore(id) {
      patch(id, (w) => ({ ...w, state: 'normal' }))
      this.focus(id)
    },

    toggleMaximize(id) {
      const w = find(id)
      if (!w) return
      if (w.state === 'maximized') this.restore(id)
      else this.maximize(id)
    },

    move(id, x, y) {
      const w = find(id)
      if (!w || w.state === 'maximized') return
      const area = store.getState().workArea
      patch(id, (win) => ({ ...win, rect: clampRect({ ...win.rect, x, y }, area, win.minSize) }))
    },

    resize(id, width, height) {
      const w = find(id)
      if (!w || w.state === 'maximized') return
      const area = store.getState().workArea
      patch(id, (win) => ({
        ...win,
        rect: clampRect({ ...win.rect, width, height }, area, win.minSize),
      }))
    },

    setRect(id, rect) {
      const w = find(id)
      if (!w) return
      const area = store.getState().workArea
      patch(id, (win) => ({ ...win, rect: clampRect({ ...win.rect, ...rect }, area, win.minSize) }))
    },

    snap(id, zone) {
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

    setWorkArea(rect) {
      store.setState((s) => ({
        ...s,
        workArea: rect,
        // Keep normal-state windows inside the new area.
        windows: s.windows.map((w) => ({ ...w, rect: clampRect(w.rect, rect, w.minSize) })),
      }))
    },

    ordered: () => [...store.getState().windows].sort((a, b) => a.z - b.z),

    displayRect(window) {
      return window.state === 'maximized' ? store.getState().workArea : window.rect
    },

    isFocused: (id) => store.getState().focusedId === id,
  }
}
