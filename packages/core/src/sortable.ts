import { createStore, type Store } from './store'

/** A point in client coordinates (e.g. a pointer position from `useDrag`). */
export interface SortablePoint {
  x: number
  y: number
}

/**
 * A drop target: a stable `id` plus its bounding rectangle in client
 * coordinates. The framework binding builds these from `getBoundingClientRect()`
 * — core never touches the DOM.
 */
export interface SortableRect {
  id: string
  /** Left edge (client x). */
  left: number
  /** Top edge (client y). */
  top: number
  width: number
  height: number
}

export interface SortableState {
  /** The id of the item currently being dragged, or null when idle. */
  activeId: string | null
  /** The id of the drop target under the pointer, or null. */
  overId: string | null
}

export interface SortableController {
  /** Read the raw store state (`activeId` + `overId`). */
  getState(): SortableState
  subscribe(cb: (s: SortableState) => void): () => void
  /** Begin dragging `id`; clears any previous `overId`. */
  start(id: string): void
  /**
   * Record a PENDING press at `(x, y)` without activating the drag. Pending
   * state lives OUTSIDE the store, so a press (and a press→release tap) causes
   * NO subscriber notification / re-render. Promote it to an active drag with
   * {@link tryStart} once the pointer moves past a threshold.
   */
  press(id: string, x: number, y: number): void
  /** True while a press is pending but not yet promoted to an active drag. */
  isPending(): boolean
  /**
   * If a press is pending and the pointer has moved more than `threshold` px
   * (default 4) from the press point on either axis, promote it to an active
   * drag (sets `activeId`) and return `true` EXACTLY ONCE (so the binding can
   * collect drop-target rects at that moment). Otherwise return `false`.
   */
  tryStart(x: number, y: number, threshold?: number): boolean
  /** Set the drop target currently under the pointer (ignored when idle). */
  over(id: string | null): void
  /**
   * Convenience: run `closestCenter(point, targets)` and store the winner as
   * `overId` (ignored when idle). Returns the resolved id. Lets a binding's
   * `onDrag` handler be a single call.
   */
  moveOver(point: SortablePoint, targets: SortableRect[]): string | null
  /**
   * Finish the drag. Returns the resolved `{ activeId, overId }` (captured
   * before clearing) so the caller can commit the move, then resets to idle.
   */
  end(): { activeId: string | null; overId: string | null }
  /** Abort the drag without resolving (resets to idle). */
  cancel(): void
  /** True while `id` is the item being dragged. */
  isActive(id: string): boolean
  /** True while `id` is the drop target under the pointer. */
  isOver(id: string): boolean
}

interface PendingSortablePress {
  id: string
  x: number
  y: number
}

/**
 * Squared distance from `point` to the center of `rect`. Avoids a `sqrt` — the
 * ordering is identical to true distance, which is all `closestCenter` needs.
 */
function centerDistanceSq(point: SortablePoint, rect: SortableRect): number {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = point.x - cx
  const dy = point.y - cy
  return dx * dx + dy * dy
}

/**
 * Collision strategy (the "closest center" algorithm popularised by dnd-kit):
 * returns the id of the target whose center is nearest `point`, or null when
 * there are no targets. Ties resolve to the earliest target in `targets`.
 *
 * Pure + DOM-free so it behaves identically across React / Vue / Solid /
 * Svelte; the framework binding supplies `point` (from the pointer-based
 * `useDrag` primitive) and the target rects (from `getBoundingClientRect`).
 */
export function closestCenter(point: SortablePoint, targets: SortableRect[]): string | null {
  let best: string | null = null
  let bestDist = Infinity
  for (const target of targets) {
    const dist = centerDistanceSq(point, target)
    if (dist < bestDist) {
      bestDist = dist
      best = target.id
    }
  }
  return best
}

function setSortableOver(store: Store<SortableState>, id: string | null): void {
  store.setState((prev) =>
    prev.activeId === null || prev.overId === id ? prev : { ...prev, overId: id },
  )
}

function resetSortable(
  store: Store<SortableState>,
  pending: { value: PendingSortablePress | null },
): void {
  pending.value = null
  const { activeId, overId } = store.getState()
  if (activeId === null && overId === null) return
  store.setState({ activeId: null, overId: null })
}

function tryStartSortable(
  store: Store<SortableState>,
  pending: { value: PendingSortablePress | null },
  x: number,
  y: number,
  threshold: number,
): boolean {
  const press = pending.value
  if (!press) return false
  if (Math.abs(x - press.x) < threshold && Math.abs(y - press.y) < threshold) return false
  pending.value = null
  store.setState({ activeId: press.id, overId: null })
  return true
}

function createSortableController(
  store: Store<SortableState>,
  pending: { value: PendingSortablePress | null },
): SortableController {
  return {
    getState: () => store.getState(),
    subscribe: (cb) => store.subscribe(cb),
    start(id) {
      pending.value = null
      store.setState({ activeId: id, overId: null })
    },
    press(id, x, y) {
      pending.value = { id, x, y }
    },
    isPending: () => pending.value !== null,
    tryStart: (x, y, threshold = 4) => tryStartSortable(store, pending, x, y, threshold),
    over: (id) => setSortableOver(store, id),
    moveOver(point, targets) {
      const id = closestCenter(point, targets)
      setSortableOver(store, id)
      return id
    },
    end() {
      const { activeId, overId } = store.getState()
      resetSortable(store, pending)
      return { activeId, overId }
    },
    cancel: () => resetSortable(store, pending),
    isActive: (id) => store.getState().activeId === id,
    isOver: (id) => store.getState().overId === id,
  }
}

/**
 * Framework-agnostic drag-to-reorder controller. Pairs with each adapter's
 * pointer-based `useDrag` primitive to give kanban / dashboard / pro-table a
 * **touch-capable** reorder that the legacy HTML5-DnD path cannot — native drag
 * events never fire on touch (Android System WebView / iOS WKWebView), so the
 * three plugins were unusable under Cordova and on touch laptops.
 *
 * Core holds only the `{ activeId, overId }` state + the pure `closestCenter`
 * strategy; the binding owns the DOM (collecting rects, feeding pointer coords).
 * State lives in a `createStore` instance so any adapter can bridge it with its
 * own reactivity (useSyncExternalStore / shallowRef / createSignal / toStore).
 */
export function createSortable(): SortableController {
  const store: Store<SortableState> = createStore<SortableState>({
    activeId: null,
    overId: null,
  })

  // Pending press lives OUTSIDE the store so a press / tap never re-renders.
  const pending: { value: PendingSortablePress | null } = { value: null }
  return createSortableController(store, pending)
}
