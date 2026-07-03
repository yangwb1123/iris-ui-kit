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
      // Allow out-of-bounds; emit clamps to [0, count-1] or -1
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

      // ── Typeahead ───────────────────────────────────────────────────────
      if (labels && labels.length > 0 && key.length === 1 && key !== ' ') {
        // Pressing the same character repeatedly → cycle (don't accumulate).
        // A different character in quick succession → accumulate multi-char search.
        const lastChar = typeaheadBuffer[typeaheadBuffer.length - 1]
        if (lastChar === key.toLowerCase()) {
          typeaheadBuffer = key.toLowerCase()
        } else {
          typeaheadBuffer += key.toLowerCase()
        }
        if (typeaheadTimer) clearTimeout(typeaheadTimer)
        typeaheadTimer = setTimeout(clearTypeahead, typeaheadTimeout)

        const match = matchTypeahead(labels, typeaheadBuffer, cur, (i) => !_isEnabled(i))
        if (match >= 0) {
          emit(match)
          return { type: 'typeahead', target: match }
        }
        return { type: 'noop' }
      }

      // ── Space (select, not typeahead) ───────────────────────────────────
      if (key === ' ') {
        event.preventDefault()
        if (cur >= 0) return { type: 'select', target: cur }
        return { type: 'noop' }
      }

      // ── Navigation keys ─────────────────────────────────────────────────
      switch (key) {
        case 'ArrowDown': {
          event.preventDefault()
          if (cur < 0) return { type: 'noop' }
          if (orientation === 'vertical') {
            controller.move(1)
            const next = controller.index
            return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
          }
          return { type: 'next' }
        }

        case 'ArrowUp': {
          event.preventDefault()
          if (cur < 0) return { type: 'noop' }
          if (orientation === 'vertical') {
            controller.move(-1)
            const next = controller.index
            return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
          }
          return { type: 'previous' }
        }

        case 'ArrowLeft': {
          event.preventDefault()
          if (tree) {
            // Tree: collapse if expanded, go to parent if collapsed/leaf
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

        case 'ArrowRight': {
          event.preventDefault()
          if (tree) {
            // Tree: expand if collapsed + has children; go-to-parent if leaf
            if (cur >= 0 && hasChildren?.(cur) && !isExpanded?.(cur)) {
              return { type: 'expand', target: cur }
            }
            if (cur >= 0 && !hasChildren?.(cur)) {
              return { type: 'go-to-parent' }
            }
            // Expanded node with children → stay
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

        case 'Enter': {
          event.preventDefault()
          if (cur >= 0) return { type: 'select', target: cur }
          return { type: 'noop' }
        }

        case 'Home': {
          event.preventDefault()
          if (_count <= 0) return { type: 'noop' }
          controller.goFirst()
          const next = controller.index
          return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
        }

        case 'End': {
          event.preventDefault()
          if (_count <= 0) return { type: 'noop' }
          controller.goLast()
          const next = controller.index
          return next !== cur ? { type: 'focus', target: next } : { type: 'noop' }
        }

        case 'Escape': {
          event.preventDefault()
          return { type: 'escape' }
        }

        default:
          return { type: 'noop' }
      }
    },
  }

  return controller
}
