/**
 * `@iris-ui/core/undo` — a generic undo/redo stack engine. Framework-agnostic,
 * no side-effects or timers. A single factory (`createUndoStack`) builds a
 * stack you `push` snapshots into and `undo`/`redo` out of.
 *
 * Every stateful controller in Iris (form, data-source, window-manager, cell-edit,
 * resource-controller) currently hand-writes its own undo logic. This module is the
 * unified replacement: generic over T, configurable merge/equals, bounded stack,
 * zero dependencies on any UI framework.
 *
 * Off the core path (`@iris-ui/core/undo` — own subpath).
 */

// ─── Options ────────────────────────────────────────────────────────────────

export interface UndoStackOptions<T> {
  /**
   * Maximum history depth. Default: 50. `0` disables undo (all pushes are
   * no-ops; `undo()`/`redo()` always return `undefined`).
   */
  maxHistory?: number

  /**
   * Equality check to skip consecutive identical snapshots.
   * When `equals(prev, next)` is true, `push` is a no-op.
   * Default: `Object.is`.
   */
  equals?: (a: T, b: T) => boolean

  /**
   * Optional merge predicate. When provided, consecutive pushes with
   * `merge(prevTop, next) === true` will **replace** the top of the stack
   * (coalescing) instead of pushing a new entry. This is useful for debouncing
   * rapid changes (typing, slider drag, window resize) into a single undo step.
   *
   * `merge` is evaluated **after** `equals` — if equals says they're identical,
   * the push is skipped entirely and merge is never called.
   */
  merge?: (prev: T, next: T) => boolean

  /**
   * An optional initial snapshot to push at construction time.
   * When provided, `canUndo()` returns `false` until a second `push` is called
   * (undo needs at least two snapshots — the initial state and one mutation).
   * When omitted, the stack starts empty and the first `push` sets the baseline.
   */
  initial?: T
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface UndoStack<T> {
  /**
   * Push a new snapshot onto the undo stack. Clears any redo history beyond
   * the current position. Returns the snapshot that was actually stored
   * (the argument, or the previously-pushed top when merged/duplicate).
   */
  push(snapshot: T): T

  /**
   * Undo: move the stack pointer back by one and return the snapshot at that
   * position. The caller is responsible for applying the returned state.
   * Returns `undefined` when there is nothing to undo.
   */
  undo(): T | undefined

  /**
   * Redo: move the stack pointer forward by one and return the snapshot at that
   * position. Returns `undefined` when there is nothing to redo.
   */
  redo(): T | undefined

  /** Clear all history. Resets to an empty stack. */
  clear(): void

  /** `true` when at least one undo step exists (pointer > 0). */
  canUndo(): boolean

  /** `true` when at least one redo step exists. */
  canRedo(): boolean

  /** Total number of snapshots currently stored. */
  depth: number

  /**
   * Index of the current (active) snapshot. `-1` when the stack is empty.
   * `0` is the oldest (initial) snapshot.
   */
  index: number
}

// ─── Implementation ─────────────────────────────────────────────────────────

export function createUndoStack<T>(options: UndoStackOptions<T> = {}): UndoStack<T> {
  const maxHistory = options.maxHistory ?? 50
  const equals = options.equals ?? Object.is
  const merge = options.merge

  // Internal snapshot array. Newest entries are at the end.
  // `ptr` is the index of the CURRENT (active) snapshot.
  // Stack layout:
  //   [S0, S1, S2, ..., Sptr, ..., Slast]
  //    ↑                        ↑
  //    oldest              latest (tip)
  //   ptr < last  →  redo is possible (there's a Sptr+1 waiting)
  //   ptr > 0     →  undo is possible (there's a Sptr-1 to go back to)
  const stack: T[] = []
  let ptr = -1

  // Push the initial snapshot if provided (unless maxHistory=0 disables undo).
  if (options.initial !== undefined && maxHistory > 0) {
    stack.push(options.initial)
    ptr = 0
  }

  const canUndo = (): boolean => ptr > 0
  const canRedo = (): boolean => ptr < stack.length - 1

  const ensureBound = (): void => {
    if (maxHistory <= 0 || stack.length <= maxHistory) return
    // Trim from the oldest end. Never discard the current snapshot or anything
    // newer — shift as many off the front as needed to fit within maxHistory.
    const overflow = stack.length - maxHistory
    if (overflow > 0) {
      const cut = Math.min(overflow, ptr) // Don't cut past ptr
      if (cut > 0) {
        stack.splice(0, cut)
        ptr -= cut
      }
    }
  }

  const stack_: UndoStack<T> = {
    push(snapshot: T): T {
      if (maxHistory <= 0) return snapshot

      // Compare with the current top (at ptr).
      if (ptr >= 0) {
        const top = stack[ptr]!
        // Skip identical snapshots.
        if (equals(top, snapshot)) return top
        // Merge: replace top instead of push.
        if (merge?.(top, snapshot)) {
          stack[ptr] = snapshot
          return snapshot
        }
      }

      // Clear any redo entries beyond ptr.
      if (ptr < stack.length - 1) {
        stack.splice(ptr + 1)
      }

      stack.push(snapshot)
      ptr = stack.length - 1
      ensureBound()
      return snapshot
    },

    undo(): T | undefined {
      if (!canUndo()) return undefined
      ptr -= 1
      return stack[ptr]
    },

    redo(): T | undefined {
      if (!canRedo()) return undefined
      ptr += 1
      return stack[ptr]
    },

    clear(): void {
      stack.length = 0
      ptr = -1
    },

    canUndo: canUndo,
    canRedo: canRedo,
    get depth() {
      return stack.length
    },
    get index() {
      return ptr
    },
  }

  return stack_
}
