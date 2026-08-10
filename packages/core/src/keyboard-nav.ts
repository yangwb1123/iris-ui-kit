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

// ─── Implementation ─────────────────────────────────────────────────────────

export function createKeyboardNav(config: KeyboardNavConfig): KeyboardNavController {
  const {
    loop = true,
    orientation = 'vertical',
    tree = false,
    labels,
    typeaheadTimeout = 500,
    isExpanded,
    hasChildren,
  } = config

  // ── Internal state ──────────────────────────────────────────────────────
  let _count = Math.max(0, config.count)
  const _isEnabled = config.isEnabled ?? (() => true)

  // Validate explicit initialIndex against isEnabled; fall back to first enabled
  let rawIndex: number
  if (config.initialIndex !== undefined) {
    rawIndex = _isEnabled(config.initialIndex)
      ? config.initialIndex
      : firstOrFallback(_count, _isEnabled)
  } else {
    rawIndex = firstOrFallback(_count, _isEnabled)
  }

  const store = createStore<number>(clamp(rawIndex, _count))

  // Typeahead buffer
  let typeaheadBuffer = ''
  let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

  const clearTypeahead = (): void => {
    typeaheadBuffer = ''
    if (typeaheadTimer) clearTimeout(typeaheadTimer)
    typeaheadTimer = undefined
  }

  // Write clamped value and notify subscribers
  const emit = (v: number): void => {
    const clamped = clamp(v, _count)
    rawIndex = clamped
    store.setState(clamped)
  }

  // Current active index (clamped)
  const safeIndex = (): number => clamp(rawIndex, _count)

  // ── Extracted key handlers ─────────────────────────────────────────────

  /** Handle typeahead (printable character) input. */
  const handleTypeahead = (key: string, cur: number): KeyboardNavAction => {
    const lastChar = typeaheadBuffer[typeaheadBuffer.length - 1]
    if (lastChar === key.toLowerCase()) {
      typeaheadBuffer = key.toLowerCase()
    } else {
      typeaheadBuffer += key.toLowerCase()
    }
    if (typeaheadTimer) clearTimeout(typeaheadTimer)
    typeaheadTimer = setTimeout(clearTypeahead, typeaheadTimeout)
    const match = matchTypeahead(labels!, typeaheadBuffer, cur, (i) => !_isEnabled(i))
    if (match >= 0) {
      emit(match)
      return { type: 'typeahead', target: match }
    }
    return { type: 'noop' }
  }

  /** ArrowDown: next item in vertical orientation, otherwise 'next' action. */
  const handleArrowDown = (cur: number): KeyboardNavAction => {
    if (cur < 0) return { type: 'noop' }
    if (orientation === 'vertical') {
      controller.move(1)
      const next = controller.index
      return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
    }
    return { type: 'next' }
  }

  /** ArrowUp: previous item in vertical orientation, otherwise 'previous' action. */
  const handleArrowUp = (cur: number): KeyboardNavAction => {
    if (cur < 0) return { type: 'noop' }
    if (orientation === 'vertical') {
      controller.move(-1)
      const next = controller.index
      return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
    }
    return { type: 'previous' }
  }

  /** ArrowLeft: collapse (tree) / navigate previous (horizontal) / 'previous' action. */
  const handleArrowLeft = (cur: number): KeyboardNavAction => {
    if (tree) {
      if (cur >= 0 && hasChildren?.(cur) && isExpanded?.(cur)) {
        return { type: 'collapse', target: cur }
      }
      return { type: 'go-to-parent' }
    }
    if (cur < 0) return { type: 'noop' }
    if (orientation === 'horizontal') {
      controller.move(-1)
      const next = controller.index
      return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
    }
    return { type: 'previous' }
  }

  /** ArrowRight: expand (tree) / navigate next (horizontal) / 'next' action. */
  const handleArrowRight = (cur: number): KeyboardNavAction => {
    if (tree) {
      if (cur >= 0 && hasChildren?.(cur) && !isExpanded?.(cur)) {
        return { type: 'expand', target: cur }
      }
      if (cur >= 0 && !hasChildren?.(cur)) {
        return { type: 'go-to-parent' }
      }
      return { type: 'focus', target: cur }
    }
    if (cur < 0) return { type: 'noop' }
    if (orientation === 'horizontal') {
      controller.move(1)
      const next = controller.index
      return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
    }
    return { type: 'next' }
  }

  /** Enter: select the current item. */
  const handleEnter = (cur: number): KeyboardNavAction => {
    if (cur >= 0) return { type: 'select', target: cur }
    return { type: 'noop' }
  }

  /** Home: jump to the first enabled item. */
  const handleHome = (cur: number): KeyboardNavAction => {
    if (_count <= 0) return { type: 'noop' }
    controller.goFirst()
    const next = controller.index
    return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
  }

  /** End: jump to the last enabled item. */
  const handleEnd = (cur: number): KeyboardNavAction => {
    if (_count <= 0) return { type: 'noop' }
    controller.goLast()
    const next = controller.index
    return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
  }

  /** Escape: close / dismiss. */
  const handleEscape = (): KeyboardNavAction => ({ type: 'escape' })

  /** True when typeahead is active (labels provided and key is a printable char). */
  const isTypeaheadActive = (key: string): boolean =>
    !!(labels && labels.length > 0 && key.length === 1 && key !== ' ')

  // ── Public API ──────────────────────────────────────────────────────────

  const controller: KeyboardNavController = {
    get store() {
      return store
    },
    get index() {
      return safeIndex()
    },
    get count() {
      return _count
    },

    focus(index: number) {
      emit(index)
    },

    move(delta: number) {
      const cur = safeIndex()
      if (cur < 0) return
      const next = nextEnabledIndex(cur, delta, _count, _isEnabled, loop)
      if (next >= 0 && next !== cur) emit(next)
    },

    goFirst() {
      const first = firstOrFallback(_count, _isEnabled)
      if (first >= 0) emit(first)
    },

    goLast() {
      if (_count <= 0) return
      const last = lastEnabledIndex(_count, _isEnabled)
      if (last >= 0) emit(last)
    },

    reset(count?: number) {
      if (count !== undefined) _count = Math.max(0, count)
      const cur = safeIndex()
      if (cur < 0 || !_isEnabled(cur)) {
        const first = firstOrFallback(_count, _isEnabled)
        emit(first)
      }
    },

    handleKeyDown(event: { key: string; preventDefault(): void }): KeyboardNavAction {
      const cur = safeIndex()
      const { key } = event

      // ── Typeahead: printable character when labels are configured ───────
      if (isTypeaheadActive(key)) {
        event.preventDefault()
        return handleTypeahead(key, cur)
      }

      // ── Space → select ─────────────────────────────────────────────────
      if (key === ' ') {
        event.preventDefault()
        return cur >= 0 ? { type: 'select', target: cur } : { type: 'noop' }
      }

      // ── Navigation keys ─────────────────────────────────────────────────
      switch (key) {
        case 'ArrowDown':
          event.preventDefault()
          return handleArrowDown(cur)
        case 'ArrowUp':
          event.preventDefault()
          return handleArrowUp(cur)
        case 'ArrowLeft':
          event.preventDefault()
          return handleArrowLeft(cur)
        case 'ArrowRight':
          event.preventDefault()
          return handleArrowRight(cur)
        case 'Enter':
          event.preventDefault()
          return handleEnter(cur)
        case 'Home':
          event.preventDefault()
          return handleHome(cur)
        case 'End':
          event.preventDefault()
          return handleEnd(cur)
        case 'Escape':
          event.preventDefault()
          return handleEscape()
        default:
          return { type: 'noop' }
      }
    },

    handleClosedKeyDown(event: { key: string; preventDefault(): void }): KeyboardNavAction {
      const cur = safeIndex()
      const { key } = event

      // Typeahead on the closed trigger: same buffer + match semantics as the
      // open listbox (REQ-2); a match is emitted to the store before returning.
      if (isTypeaheadActive(key)) {
        event.preventDefault()
        const match = handleTypeahead(key, cur)
        return match.type === 'typeahead'
          ? { type: 'open', target: match.target }
          : { type: 'open' }
      }

      if (key === 'ArrowDown') {
        event.preventDefault()
        // Index deliberately untouched — the adapter's open-reset anchors focus
        // to the selected/first-enabled item.
        return { type: 'open' }
      }

      // NO preventDefault: Space/Enter must keep activating the native button
      // (click-toggle) — a regression invisible to jsdom keydown tests.
      return { type: 'noop' }
    },
  }

  return controller
}
