/**
 * Framework-agnostic month-view calendar keyboard roving (A-core controller).
 *
 * `IrisCalendar` in all four adapters used to hand-roll the same 8-case key
 * switch on top of a clamped LINEAR day model (`focusDate ± delta`), duplicating
 * the logic and diverging from the WAI-ARIA grid pattern. This controller is
 * the single shared implementation: it composes the pure 2D grid material
 * {@link nextGridCell} (from `roving.ts`) with core date math, so each adapter
 * bridge is a one-line `handleKey` dispatch.
 *
 * Semantics (registered, deliberate — see the design's behavior-change table):
 * - ArrowLeft/Right stay in the row: no wrap at row ends, no month flip mid-row.
 * - ArrowUp/Down stay in the column, skipping disabled cells; when a whole scan
 *   segment is disabled the focus STAYS (today's clamped model clamp-jumped to
 *   `min`/`max`).
 * - Home/End land on the nearest ENABLED cell of the row (disabled leading/
 *   trailing cells are skipped, not clamped onto).
 * - PageUp/PageDown are month arithmetic: the visible month flips by ±1 and the
 *   focus moves by ±1 month, clamped to `[min, max]`. The pre-existing quirk —
 *   a tight `min`/`max` can clamp the focus OUTSIDE the flipped month's matrix —
 *   is preserved and documented: in that state arrow/Home/End keys are handled
 *   (return `true`, adapter `preventDefault`s) but no-op, exactly like today's
 *   invisible-focus movement.
 * - After any arrow/Home/End move, the visible month flips to the target's month
 *   when it differs (uniform month-flip rule, matching the old `moveFocus`).
 *
 * Enter/Space (selection) stays in the adapters: `handleKey` returns `false` for
 * them. Options are captured at creation (the `createResourceController`
 * precedent): `min`/`max`/`weekStartsOn` changes while mounted require a remount.
 */
import { createStore, type Store } from './store'
import {
  addMonths,
  buildMonthMatrix,
  clampDate,
  isOutOfRange,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from './date'
import { nextGridCell, type GridCell, type GridNavKey } from './roving'

/** Roving state of a month-view calendar. */
export interface CalendarNavState {
  /** `startOfMonth` of the visible month (always normalized). */
  visibleMonth: Date
  /** The roving focus date. Grid movement never lands on a disabled date. */
  focusDate: Date
}

export interface CreateCalendarNavOptions {
  /** Initial visible month. Default `startOfMonth(new Date())`. */
  initialMonth?: Date
  /** Initial focus date. Default `clampDate(new Date(), min, max)`. */
  initialFocusDate?: Date
  /** 0–6, 0 = Sunday. Default 0. Cells are mapped with this. */
  weekStartsOn?: number
  /** Dates before `min` / after `max` are disabled cells (skipped by roving). */
  min?: Date
  max?: Date
}

export interface CalendarNav {
  /** Subscribable state — the bridge point for the four adapters. */
  store: Store<CalendarNavState>
  getState(): CalendarNavState
  getVisibleMonth(): Date
  getFocusDate(): Date
  /** Move the roving focus (adapter click / cell `onFocus` handlers). Not clamped. */
  setFocusDate(date: Date): void
  /** Set the visible month (adapter value-sync effect). Normalized to startOfMonth. */
  setVisibleMonth(month: Date): void
  /** Prev/next header buttons: `addMonths(visibleMonth, delta)`. Focus untouched. */
  goToMonth(delta: number): void
  /**
   * Dispatch a grid navigation key. Returns true when the key was handled
   * (ArrowLeft/Right/Up/Down, Home, End, PageUp, PageDown) so the adapter can
   * `preventDefault()`. Enter/Space and any other key return false — selection
   * stays in the adapters (scope guard). Never throws.
   */
  handleKey(key: string): boolean
}

const NAV_KEYS: readonly GridNavKey[] = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]

export function createCalendarNav(options: CreateCalendarNavOptions = {}): CalendarNav {
  const { weekStartsOn = 0, min, max } = options
  const store = createStore<CalendarNavState>({
    visibleMonth: startOfMonth(options.initialMonth ?? new Date()),
    focusDate: clampDate(options.initialFocusDate ?? new Date(), min, max),
  })

  return {
    store,
    getState: () => store.getState(),
    getVisibleMonth: () => store.getState().visibleMonth,
    getFocusDate: () => store.getState().focusDate,
    setFocusDate(date) {
      store.setState({ ...store.getState(), focusDate: date })
    },
    setVisibleMonth(month) {
      store.setState({ ...store.getState(), visibleMonth: startOfMonth(month) })
    },
    goToMonth(delta) {
      const { visibleMonth } = store.getState()
      store.setState({
        ...store.getState(),
        visibleMonth: startOfMonth(addMonths(visibleMonth, delta)),
      })
    },
    handleKey(key) {
      if (!(NAV_KEYS as readonly string[]).includes(key)) return false
      const { visibleMonth, focusDate } = store.getState()
      // PageUp/PageDown are MONTH arithmetic (not `nextGridCell` pageSize, which
      // would be ±7 days): flip the visible month and move the focus ±1 month,
      // clamped to [min, max]. This replicates the adapters' double update —
      // including the "clamped focus outside flipped matrix" quirk, preserved.
      if (key === 'PageUp' || key === 'PageDown') {
        const delta = key === 'PageUp' ? -1 : 1
        store.batch(() => {
          store.setState({
            ...store.getState(),
            visibleMonth: startOfMonth(addMonths(visibleMonth, delta)),
            focusDate: clampDate(addMonths(focusDate, delta), min, max),
          })
        })
        return true
      }
      const matrix = buildMonthMatrix(visibleMonth, weekStartsOn)
      // `focusDate` is canonical; the cell is derived (O(42) scan). Survives
      // month flips, external value changes, and the PageUp/PageDown clamp quirk.
      let cell: GridCell | null = null
      outer: for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < matrix[r].length; c += 1) {
          if (isSameDay(matrix[r][c], focusDate)) {
            cell = { row: r, col: c }
            break outer
          }
        }
      }
      // Quirk state: focus is outside the visible matrix (e.g. PageUp clamped it
      // while the month flipped). Handled but no-op — no visible cell can move.
      if (cell === null) return true
      const next = nextGridCell(cell, key as GridNavKey, {
        rowCount: matrix.length,
        colCount: matrix[0]?.length ?? 7,
        isEnabled: (c) => !isOutOfRange(matrix[c.row][c.col], min, max),
        loop: false,
      })
      const target = matrix[next.row][next.col]
      if (isSameDay(target, focusDate)) return true
      // One emit per keypress (the month flip is coalesced into the same flush).
      store.batch(() => {
        store.setState({ ...store.getState(), focusDate: target })
        if (!isSameMonth(target, visibleMonth)) {
          store.setState({ ...store.getState(), visibleMonth: startOfMonth(target) })
        }
      })
      return true
    },
  }
}
