import { shallowRef, type ShallowRef } from 'vue'
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
 * Vue bridge over the framework-agnostic {@link createUndoStack}.
 * Creates the stack once in `setup()` and returns a stable controller
 * plus a reactive `state` that tracks `canUndo`/`canRedo`/`depth`/`index` for
 * easy UI binding.
 *
 * The returned `push`/`undo`/`redo`/`clear` automatically update the reactive
 * state — no manual `.value = ...` needed.
 *
 * @example
 *   const { push, undo, redo, state } = useUndoStack({ initial: formValues })
 *   // After mutation:
 *   push(currentValues)
 *   // In template:
 *   <button :disabled="!state.canUndo" @click="undo">Undo</button>
 *   <button :disabled="!state.canRedo" @click="redo">Redo</button>
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
  state: ShallowRef<UndoStackReactiveState>
} {
  const stack = createUndoStack<T>(options)

  const state = shallowRef<UndoStackReactiveState>({
    canUndo: stack.canUndo(),
    canRedo: stack.canRedo(),
    depth: stack.depth,
    index: stack.index,
  })

  const sync = () => {
    state.value = {
      canUndo: stack.canUndo(),
      canRedo: stack.canRedo(),
      depth: stack.depth,
      index: stack.index,
    }
  }

  const push = (snapshot: T): T => {
    const result = stack.push(snapshot)
    sync()
    return result
  }

  const undo = (): T | undefined => {
    const result = stack.undo()
    if (result !== undefined) sync()
    return result
  }

  const redo = (): T | undefined => {
    const result = stack.redo()
    if (result !== undefined) sync()
    return result
  }

  const clear = () => {
    stack.clear()
    sync()
  }

  return { push, undo, redo, clear, stack, state }
}
