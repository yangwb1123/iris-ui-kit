/**
 * Framework-agnostic keyboard navigation controller — the A-layer **core behavior**
 * behind list, menu, tabs, combobox, select, tree, segmented, toolbar, rating,
 * slider, time-picker, cascader, toggle-group, and transfer keyboard interactions
 * (each previously re-implemented the same ArrowUp/Down/Home/End pattern per
 * component per framework).
 *
 * The controller owns the **active index** in a subscribable `Store` and provides
 * a single `handleKeyDown(event)` that returns the action the adapter should
 * perform. The adapter keeps only the bridge: reading `controller.index` and
 * calling `element.focus()` / handling the returned action — no more 30-line
 * switch/case per component.
 */

import { createStore, type Store } from './store'
import { nextEnabledIndex, firstEnabledIndex, lastEnabledIndex, matchTypeahead } from './roving'

// ─── Action types ───────────────────────────────────────────────────────────

/** The instructions `handleKeyDown` returns for the adapter to execute. */
export type KeyboardNavAction =
  | { type: 'focus'; target: number }
  | { type: 'select'; target: number }
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'escape' }
  | { type: 'previous' }
  | { type: 'next' }
  | { type: 'expand'; target: number }
  | { type: 'collapse'; target: number }
  | { type: 'go-to-parent' }
  | { type: 'typeahead'; target: number }
  | { type: 'noop' }
  /** Open the popover. `target` = typeahead match index to land on (already
   *  emitted to the store); absent = open and let the adapter's open-reset
   *  anchor to the selected/first-enabled item. Produced by
   *  `handleClosedKeyDown` (the closed-trigger half of the combobox pattern). */
  | { type: 'open'; target?: number }

// ─── Config ─────────────────────────────────────────────────────────────────

export interface KeyboardNavConfig {
  /** Total item count. */
  count: number
  /** Starting active index. Default: first enabled, or -1 if none. */
  initialIndex?: number
  /** Wrap at boundaries. Default: true. */
  loop?: boolean
  /** Predicate for disabled items. Default: all enabled. */
  isEnabled?: (index: number) => boolean
  /** Orientation for ArrowLeft/ArrowRight. Default: 'vertical'. */
  orientation?: 'vertical' | 'horizontal'
  /**
   * Labels for typeahead support. When empty or omitted, typeahead is disabled.
   * The controller buffers typed characters and resets on a 500ms pause.
   */
  labels?: readonly string[]
  /**
   * Whether this is a tree component. When true, ArrowLeft/ArrowRight produce
   * expand/collapse/go-to-parent actions instead of horizontal navigation.
   */
  tree?: boolean
  /** For tree mode: is the node at `index` expanded? */
  isExpanded?: (index: number) => boolean
  /** For tree mode: does the node at `index` have children? */
  hasChildren?: (index: number) => boolean
  /** Typeahead reset timeout in ms. Default: 500. */
  typeaheadTimeout?: number
}

// ─── Controller interface ───────────────────────────────────────────────────

export interface KeyboardNavController {
  /** Subscribable store that holds the current active index (-1 when none). */
  readonly store: Store<number>
  /** Current active index (clamped to [0, count-1], or -1 when none). */
  get index(): number
  /** Handle a keyboard event. Returns the action the adapter should perform. */
  handleKeyDown(event: { key: string; preventDefault(): void }): KeyboardNavAction
  /**
   * Closed-trigger key handling (combobox pattern, trigger half). Call only
   * while the popover is closed (open state is adapter-owned).
   *
   * Keymap:
   *   - `ArrowDown`            → `{ type: 'open' }`                    (preventDefault)
   *   - printable (typeahead)  → `{ type: 'open', target: N }` on match,
   *                              `{ type: 'open' }` on no match        (preventDefault)
   *   - everything else        → `{ type: 'noop' }`                    (NO preventDefault —
   *                              preserves native Space/Enter button activation)
   *
   * Shares the controller's typeahead buffer + active index with the open
   * listbox; the match (if any) is emitted to `store` before returning.
   */
  handleClosedKeyDown(event: { key: string; preventDefault(): void }): KeyboardNavAction
  /** Move by `delta` (+1 for down, -1 for up), skipping disabled. */
  move(delta: number): void
  /** Jump to the first enabled item. */
  goFirst(): void
  /** Jump to the last enabled item. */
  goLast(): void
  /** Explicitly set the active index (clamped to bounds). */
  focus(index: number): void
  /** Recalculate bounds when items change (e.g. filter/search). */
  reset(count?: number): void
  /** Current count of items. */
  get count(): number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Clamp index to valid range. Returns -1 when count <= 0 or no enabled items.
const clamp = (i: number, count: number): number => {
  if (count <= 0) return -1
  if (i < 0) return -1
  if (i >= count) return count - 1
  return i
}

const firstOrFallback = (count: number, isEnabled: (i: number) => boolean): number => {
  if (count <= 0) return -1
  const f = firstEnabledIndex(count, isEnabled)
  return f >= 0 ? f : -1
}

interface KeyboardNavState {
  loop: boolean
  orientation: 'vertical' | 'horizontal'
  tree: boolean
  labels?: readonly string[]
  typeaheadTimeout: number
  isExpanded?: (index: number) => boolean
  hasChildren?: (index: number) => boolean
  isEnabled: (index: number) => boolean
  count: number
  rawIndex: number
  store: Store<number>
  typeaheadBuffer: string
  typeaheadTimer?: ReturnType<typeof setTimeout>
}

interface KeyboardNavOperations {
  getIndex(): number
  focus(index: number): void
  move(delta: number): void
  goFirst(): void
  goLast(): void
  reset(count?: number): void
}

interface KeyboardNavKeyHandlers {
  handleKeyDown(event: { key: string; preventDefault(): void }): KeyboardNavAction
  handleClosedKeyDown(event: { key: string; preventDefault(): void }): KeyboardNavAction
}

function createKeyboardNavState(config: KeyboardNavConfig): KeyboardNavState {
  const isEnabled = config.isEnabled ?? (() => true)
  const count = Math.max(0, config.count)
  const initial =
    config.initialIndex !== undefined && isEnabled(config.initialIndex)
      ? config.initialIndex
      : firstOrFallback(count, isEnabled)
  return {
    loop: config.loop ?? true,
    orientation: config.orientation ?? 'vertical',
    tree: config.tree ?? false,
    labels: config.labels,
    typeaheadTimeout: config.typeaheadTimeout ?? 500,
    isExpanded: config.isExpanded,
    hasChildren: config.hasChildren,
    isEnabled,
    count,
    rawIndex: clamp(initial, count),
    store: createStore<number>(clamp(initial, count)),
    typeaheadBuffer: '',
  }
}

function keyboardSafeIndex(state: KeyboardNavState): number {
  return clamp(state.rawIndex, state.count)
}

function clearKeyboardTypeahead(state: KeyboardNavState): void {
  state.typeaheadBuffer = ''
  if (state.typeaheadTimer) clearTimeout(state.typeaheadTimer)
  state.typeaheadTimer = undefined
}

function emitKeyboardIndex(state: KeyboardNavState, value: number): void {
  const index = clamp(value, state.count)
  state.rawIndex = index
  state.store.setState(index)
}

function handleKeyboardTypeahead(
  state: KeyboardNavState,
  key: string,
  current: number,
): KeyboardNavAction {
  const lower = key.toLowerCase()
  const last = state.typeaheadBuffer[state.typeaheadBuffer.length - 1]
  state.typeaheadBuffer = last === lower ? lower : state.typeaheadBuffer + lower
  if (state.typeaheadTimer) clearTimeout(state.typeaheadTimer)
  state.typeaheadTimer = setTimeout(() => clearKeyboardTypeahead(state), state.typeaheadTimeout)
  const match = matchTypeahead(
    state.labels!,
    state.typeaheadBuffer,
    current,
    (i) => !state.isEnabled(i),
  )
  if (match < 0) return { type: 'noop' }
  emitKeyboardIndex(state, match)
  return { type: 'typeahead', target: match }
}

function keyboardTypeaheadActive(state: KeyboardNavState, key: string): boolean {
  return !!(state.labels && state.labels.length > 0 && key.length === 1 && key !== ' ')
}

function createKeyboardNavOperations(state: KeyboardNavState): KeyboardNavOperations {
  return {
    getIndex: () => keyboardSafeIndex(state),
    focus: (index) => emitKeyboardIndex(state, index),
    move(delta) {
      const current = keyboardSafeIndex(state)
      if (current < 0) return
      const next = nextEnabledIndex(current, delta, state.count, state.isEnabled, state.loop)
      if (next >= 0 && next !== current) emitKeyboardIndex(state, next)
    },
    goFirst() {
      const first = firstOrFallback(state.count, state.isEnabled)
      if (first >= 0) emitKeyboardIndex(state, first)
    },
    goLast() {
      if (state.count <= 0) return
      const last = lastEnabledIndex(state.count, state.isEnabled)
      if (last >= 0) emitKeyboardIndex(state, last)
    },
    reset(count) {
      if (count !== undefined) state.count = Math.max(0, count)
      const current = keyboardSafeIndex(state)
      if (current < 0 || !state.isEnabled(current)) {
        emitKeyboardIndex(state, firstOrFallback(state.count, state.isEnabled))
      }
    },
  }
}

function handleKeyboardArrowDown(
  state: KeyboardNavState,
  operations: KeyboardNavOperations,
  current: number,
): KeyboardNavAction {
  if (current < 0) return { type: 'noop' }
  if (state.orientation !== 'vertical') return { type: 'next' }
  operations.move(1)
  const next = operations.getIndex()
  return next !== current ? { type: 'focus', target: next } : { type: 'noop' }
}

function handleKeyboardArrowUp(
  state: KeyboardNavState,
  operations: KeyboardNavOperations,
  current: number,
): KeyboardNavAction {
  if (current < 0) return { type: 'noop' }
  if (state.orientation !== 'vertical') return { type: 'previous' }
  operations.move(-1)
  const next = operations.getIndex()
  return next !== current ? { type: 'focus', target: next } : { type: 'noop' }
}

function handleKeyboardArrowLeft(
  state: KeyboardNavState,
  operations: KeyboardNavOperations,
  current: number,
): KeyboardNavAction {
  if (state.tree) {
    if (current >= 0 && state.hasChildren?.(current) && state.isExpanded?.(current)) {
      return { type: 'collapse', target: current }
    }
    return { type: 'go-to-parent' }
  }
  if (current < 0) return { type: 'noop' }
  if (state.orientation !== 'horizontal') return { type: 'previous' }
  operations.move(-1)
  const next = operations.getIndex()
  return next !== current ? { type: 'focus', target: next } : { type: 'noop' }
}

function handleKeyboardArrowRight(
  state: KeyboardNavState,
  operations: KeyboardNavOperations,
  current: number,
): KeyboardNavAction {
  if (state.tree) {
    if (current >= 0 && state.hasChildren?.(current) && !state.isExpanded?.(current)) {
      return { type: 'expand', target: current }
    }
    if (current >= 0 && !state.hasChildren?.(current)) return { type: 'go-to-parent' }
    return { type: 'focus', target: current }
  }
  if (current < 0) return { type: 'noop' }
  if (state.orientation !== 'horizontal') return { type: 'next' }
  operations.move(1)
  const next = operations.getIndex()
  return next !== current ? { type: 'focus', target: next } : { type: 'noop' }
}

function handleKeyboardOpenKey(
  state: KeyboardNavState,
  operations: KeyboardNavOperations,
  event: { key: string; preventDefault(): void },
): KeyboardNavAction {
  const current = operations.getIndex()
  const { key } = event
  if (keyboardTypeaheadActive(state, key)) {
    event.preventDefault()
    return handleKeyboardTypeahead(state, key, current)
  }
  if (key === ' ') {
    event.preventDefault()
    return current >= 0 ? { type: 'select', target: current } : { type: 'noop' }
  }
  const actions: Record<string, () => KeyboardNavAction> = {
    ArrowDown: () => handleKeyboardArrowDown(state, operations, current),
    ArrowUp: () => handleKeyboardArrowUp(state, operations, current),
    ArrowLeft: () => handleKeyboardArrowLeft(state, operations, current),
    ArrowRight: () => handleKeyboardArrowRight(state, operations, current),
    Enter: () => (current >= 0 ? { type: 'select', target: current } : { type: 'noop' }),
    Home: () => {
      if (state.count <= 0) return { type: 'noop' }
      operations.goFirst()
      const next = operations.getIndex()
      return next !== current ? { type: 'focus', target: next } : { type: 'noop' }
    },
    End: () => {
      if (state.count <= 0) return { type: 'noop' }
      operations.goLast()
      const next = operations.getIndex()
      return next !== current ? { type: 'focus', target: next } : { type: 'noop' }
    },
    Escape: () => ({ type: 'escape' }),
  }
  const action = actions[key]
  if (!action) return { type: 'noop' }
  event.preventDefault()
  return action()
}

function handleKeyboardClosedKey(
  state: KeyboardNavState,
  operations: KeyboardNavOperations,
  event: { key: string; preventDefault(): void },
): KeyboardNavAction {
  const current = operations.getIndex()
  if (keyboardTypeaheadActive(state, event.key)) {
    event.preventDefault()
    const match = handleKeyboardTypeahead(state, event.key, current)
    return match.type === 'typeahead' ? { type: 'open', target: match.target } : { type: 'open' }
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    return { type: 'open' }
  }
  return { type: 'noop' }
}

function createKeyboardNavKeyHandlers(
  state: KeyboardNavState,
  operations: KeyboardNavOperations,
): KeyboardNavKeyHandlers {
  return {
    handleKeyDown: (event) => handleKeyboardOpenKey(state, operations, event),
    handleClosedKeyDown: (event) => handleKeyboardClosedKey(state, operations, event),
  }
}

function createKeyboardNavController(
  state: KeyboardNavState,
  operations: KeyboardNavOperations,
  handlers: KeyboardNavKeyHandlers,
): KeyboardNavController {
  return {
    get store() {
      return state.store
    },
    get index() {
      return operations.getIndex()
    },
    get count() {
      return state.count
    },
    focus: operations.focus,
    move: operations.move,
    goFirst: operations.goFirst,
    goLast: operations.goLast,
    reset: operations.reset,
    handleKeyDown: handlers.handleKeyDown,
    handleClosedKeyDown: handlers.handleClosedKeyDown,
  }
}

// ─── Implementation ─────────────────────────────────────────────────────────

export function createKeyboardNav(config: KeyboardNavConfig): KeyboardNavController {
  const state = createKeyboardNavState(config)
  const operations = createKeyboardNavOperations(state)
  return createKeyboardNavController(
    state,
    operations,
    createKeyboardNavKeyHandlers(state, operations),
  )
}
