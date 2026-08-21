import type { Store } from '../store'

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
  /** Rebalance z-values so they are compact and contiguous [1..n] without gaps. */
  rebalanceZ(): void
}

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
