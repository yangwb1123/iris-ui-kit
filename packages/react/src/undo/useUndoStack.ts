import * as React from 'react'
import { createUndoStack, type UndoStack, type UndoStackOptions } from '@iris-ui-kit/core/undo'

/**
 * Reactive snapshot metadata for the UndoStack: convenience booleans that
 * update on every push/undo/redo/clear for use in UI bindings (enable/disable
 * undo/redo buttons).
 */
export interface UndoStackReactiveState {
  canUndo: boolean
  canRedo: boolean
  depth: number
  index: number
}

/**
 * React bridge over the framework-agnostic {@link createUndoStack}.
 * Creates the stack once (via a factory memo) and returns a stable controller
 * plus a reactive `state` that tracks `canUndo`/`canRedo`/`depth`/`index` for
 * easy UI binding. Re-renders only when those metadata change.
 *
 * The returned `push`/`undo`/`redo`/`clear` are stable refs that automatically
 * update the reactive state — no manual `setState` needed.
 *
 * @example
 *   const { push, undo, redo, state } = useUndoStack({ initial: formValues })
 *   // After mutation:
 *   push(currentValues)
 *   // In UI:
 *   <button disabled={!state.canUndo} onClick={undo}>Undo</button>
 *   <button disabled={!state.canRedo} onClick={redo}>Redo</button>
 */
export function useUndoStack<T>(options?: UndoStackOptions<T>): {
  /** Push a new snapshot onto the stack. Returns the stored value. */
  push: (snapshot: T) => T
  /** Undo: returns the previous snapshot, or undefined if nothing to undo. */
  undo: () => T | undefined
  /** Redo: returns the next snapshot, or undefined if nothing to redo. */
  redo: () => T | undefined
  /** Clear all history. */
  clear: () => void
  /** The raw undo stack (stable reference, same across renders). */
  stack: UndoStack<T>
  /** Reactive metadata: canUndo, canRedo, depth, index. */
  state: UndoStackReactiveState
} {
  // Create the stack once via factory — stable across renders.
  const stackRef = React.useRef<UndoStack<T> | null>(null)
  if (stackRef.current === null) {
    stackRef.current = createUndoStack<T>(options)
  }
  const stack = stackRef.current

  // Key to trigger re-render when undo/redo/push state changes.
  // Incremented on every mutation so canUndo/canRedo/depth/index are
  // always fresh in the returned `state`.
  const [, setTick] = React.useState(0)
  const bump = React.useCallback(() => setTick((n) => n + 1), [])

  // Stable wrappers that bump the tick after each operation.
  const push = React.useCallback(
    (snapshot: T): T => {
      const result = stack.push(snapshot)
      bump()
      return result
    },
    [stack, bump],
  )

  const undo = React.useCallback((): T | undefined => {
    const result = stack.undo()
    if (result !== undefined) bump()
    return result
  }, [stack, bump])

  const redo = React.useCallback((): T | undefined => {
    const result = stack.redo()
    if (result !== undefined) bump()
    return result
  }, [stack, bump])

  const clear = React.useCallback(() => {
    stack.clear()
    bump()
  }, [stack, bump])

  // Compute reactive state. `canUndo`/`canRedo` are methods on the interface,
  // so we call them each render to get current values.
  const state: UndoStackReactiveState = {
    canUndo: stack.canUndo(),
    canRedo: stack.canRedo(),
    depth: stack.depth,
    index: stack.index,
  }

  return { push, undo, redo, clear, stack, state }
}
