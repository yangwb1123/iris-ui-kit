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
  /** Virtual desktop (workspace) index this window lives on. */
  workspace: number
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
  /** Number of virtual desktops (workspaces). Default 1 (workspaces disabled). */
  workspaces?: number
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
  /** Virtual desktop to place it on; defaults to the current workspace. */
  workspace?: number
}

export interface WindowManagerState<Meta = unknown> {
  /** Windows in stable insertion order (NOT z-order — sort by `z` to render). */
  windows: DesktopWindow<Meta>[]
  focusedId: string | null
  workArea: WindowRect
  /** Number of virtual desktops. */
  workspaces: number
  /** The active virtual desktop; only its windows are shown. */
  currentWorkspace: number
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
  /** Switch the active virtual desktop (clamped); focuses that desktop's top window. */
  setWorkspace(index: number): void
  /** Move a window to another virtual desktop (clamped). */
  moveWindowToWorkspace(id: string, index: number): void
  /** Windows sorted by ascending z — the order to paint them. */
  ordered(): DesktopWindow<Meta>[]
  /** The geometry to actually render for a window (work area when maximized). */
  displayRect(window: DesktopWindow<Meta>): WindowRect
  isFocused(id: string): boolean
  /**
   * Rebalance z-values so they are compact and contiguous [1..n] without gaps.
   * Windows keep their relative stacking order. Safe to call at any time;
   * automatically triggered when the internal z-counter exceeds 100,000.
   */
  rebalanceZ(): void
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

/**
 * One window in a persisted session snapshot — the JSON-able subset needed to
 * recreate it (runtime-only fields like `id`/`z` are regenerated on restore).
 */
export interface WindowSessionEntry<Meta = unknown> {
  appId: string
  title: string
  /** The normal-state geometry (restore target). */
  rect: WindowRect
  state: WindowState
  minSize: WindowSize
  meta: Meta
  /** Virtual desktop the window was on. */
  workspace: number
  /** Whether this was the focused window. */
  focused: boolean
}

/** A serializable desktop session — windows in ascending z (paint/stack) order. */
export type WindowSession<Meta = unknown> = WindowSessionEntry<Meta>[]

/**
 * Snapshot the manager state into a JSON-able {@link WindowSession} (persist it to
 * a user profile, restore on reload). Windows are emitted in ascending z so
 * {@link restoreSession} recreates the same stacking by re-opening in order.
 *
 * **For compact z-values in the session**, call {@link WindowManager.rebalanceZ}
 * before `serializeSession` — the session snapshot is taken as-is from the
 * current state without mutating it.
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
 * Re-open the windows from a {@link WindowSession} into `wm` (typically empty, at
 * startup). Re-opening in array order reproduces the z-stacking; per-window
 * maximize/minimize and the focused window are reapplied. Pass an already-filtered
 * session (drop entries whose app no longer exists) — this opens whatever it's
 * given. Returns the new window ids in the same order.
 */
export function restoreSession<Meta = unknown>(
  wm: WindowManager<Meta>,
  session: WindowSession<Meta>,
): string[] {
  const ids: string[] = []
  let focusId: string | undefined
  for (const e of session) {
    const id = wm.open({
      appId: e.appId,
      title: e.title,
      rect: e.rect,
      minSize: e.minSize,
      meta: e.meta,
      workspace: e.workspace,
    })
    ids.push(id)
    if (e.state === 'maximized') wm.maximize(id)
    else if (e.state === 'minimized') wm.minimize(id)
    if (e.focused && e.state !== 'minimized') focusId = id
  }
  if (focusId) wm.focus(focusId)
  return ids
}

export function createWindowManager<Meta = unknown>(
  config: WindowManagerConfig = {},
): WindowManager<Meta> {
  const cascadeStep = config.cascadeStep ?? 28
  const defaultSize = config.defaultSize ?? DEFAULT_SIZE
  const workspaces = Math.max(1, config.workspaces ?? 1)
  /** Threshold above which a rebalanceZ() is triggered automatically. */
  const Z_REBALANCE_THRESHOLD = 100_000

  const clampWs = (n: number): number => Math.max(0, Math.min(Math.trunc(n), workspaces - 1))

  /**
   * Rebalance z-values so they are compact and contiguous [1..n] without gaps.
   * Windows keep their relative stacking order. Call this when {@link zCounter}
   * exceeds a threshold (e.g. 100,000) to avoid unbounded growth of z-values,
   * which can cause GPU compositing artifacts on some renderers and ensures
   * serialized sessions have compact z-values.
   *
   * After rebalancing, the focused window (if any) is raised to the top (z = n).
   * This is safe to call at any time — it is idempotent and non-destructive.
   */
  const rebalanceZ = (): void => {
    const s = store.getState()
    if (s.windows.length === 0) {
      zCounter = 0
      return
    }
    // Sort by current z to preserve stacking order
    const sorted = [...s.windows].sort((a, b) => a.z - b.z)
    // Assign new compact z values [1..n], keeping the focused window on top
    const focusedId = s.focusedId
    const focalIndex = sorted.findIndex((w) => w.id === focusedId)
    const winMap = new Map<string, DesktopWindow<Meta>>()
    let z = 1
    for (let i = 0; i < sorted.length; i++) {
      // Skip the focused window — place it last
      if (i === focalIndex) continue
      winMap.set(sorted[i]!.id, { ...sorted[i]!, z: z++ })
    }
    // Focused window gets the top z
    if (focusedId && focalIndex >= 0) {
      winMap.set(sorted[focalIndex]!.id, { ...sorted[focalIndex]!, z: z++ })
    }
    zCounter = sorted.length
    store.setState((st) => ({
      ...st,
      windows: s.windows.map((w) => winMap.get(w.id) ?? w),
    }))
  }

  /** Increment zCounter and check if rebalance is needed. */
  const raiseZ = (): number => {
    zCounter += 1
    if (zCounter > Z_REBALANCE_THRESHOLD) {
      rebalanceZ()
      // rebalanceZ resets zCounter; if rebalance happened, return the new top z
      return zCounter
    }
    return zCounter
  }

  let zCounter = 0
  let openCount = 0

  const store = createStore<WindowManagerState<Meta>>({
    windows: [],
    focusedId: null,
    workArea: config.workArea ?? DEFAULT_AREA,
    workspaces,
    currentWorkspace: 0,
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
    const z = raiseZ()
    store.setState((s) => ({
      ...s,
      focusedId: id,
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, z, focused: true } : w.focused ? { ...w, focused: false } : w,
      ),
    }))
  }

  /** Focus the top-most non-minimized window on the CURRENT workspace. */
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

    setWorkspace(index) {
      const next = clampWs(index)
      if (next === store.getState().currentWorkspace) return
      store.setState((s) => ({ ...s, currentWorkspace: next }))
      focusTop() // focus the top window on the newly-active desktop (or clear focus)
    },

    moveWindowToWorkspace(id, index) {
      const w = find(id)
      if (!w) return
      const ws = clampWs(index)
      patch(id, (win) => ({ ...win, workspace: ws }))
      // If we moved the focused window off the current desktop, refocus what's left.
      const s = store.getState()
      if (s.focusedId === id && ws !== s.currentWorkspace) focusTop()
    },

    ordered: () => [...store.getState().windows].sort((a, b) => a.z - b.z),

    displayRect(window) {
      return window.state === 'maximized' ? store.getState().workArea : window.rect
    },

    isFocused: (id) => store.getState().focusedId === id,

    rebalanceZ,
  }
}
