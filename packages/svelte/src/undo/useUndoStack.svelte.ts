import { createUndoStack, type UndoStack, type UndoStackOptions } from '@iris-ui-kit/core/undo'

/**
 * Module-private helper: wrap a raw UndoStack so that every mutating call
 * fires `onMutate` (see react/solid bridges — same contract, kept per-bridge
 * until lifted to core).
 */
function trackUndoStack<T>(stack: UndoStack<T>, onMutate: () => void): UndoStack<T> {
  const mutating = new Set(['push', 'undo', 'redo', 'clear'])
  const cache = new Map<string, (...args: unknown[]) => unknown>()
  return new Proxy(stack, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && mutating.has(prop)) {
        const method = target[prop as keyof UndoStack<T>]
        if (typeof method !== 'function') return undefined
        let wrapped = cache.get(prop)
        if (!wrapped) {
          wrapped = (...args: unknown[]) => {
            const result = Reflect.apply(method, target, args)
            onMutate()
            return result
          }
          cache.set(prop, wrapped)
        }
        return wrapped
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}

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
 * Svelte 5 bridge over the framework-agnostic {@link createUndoStack}.
 * Creates the stack once and returns a stable controller plus a reactive
 * `state` object (backed by $state) that tracks `canUndo`/`canRedo`/`depth`/`index`.
 *
 * The returned `push`/`undo`/`redo`/`clear` automatically update the reactive
 * state — no manual assignments needed.
 *
 * @example
 *   const { push, undo, redo, state } = useUndoStack({ initial: formValues })
 *   // After mutation:
 *   push(currentValues)
 *   // In template:
 *   <button disabled={!state.canUndo} onclick={undo}>Undo</button>
 *   <button disabled={!state.canRedo} onclick={redo}>Redo</button>
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
  /** The raw undo stack (stable reference). */
  stack: UndoStack<T>
  /** Reactive metadata: canUndo, canRedo, depth, index. */
  state: UndoStackReactiveState
} {
  const stack = createUndoStack<T>(options)

  const state = $state<UndoStackReactiveState>({
    canUndo: stack.canUndo(),
    canRedo: stack.canRedo(),
    depth: stack.depth,
    index: stack.index,
  })

  const sync = () => {
    state.canUndo = stack.canUndo()
    state.canRedo = stack.canRedo()
    state.depth = stack.depth
    state.index = stack.index
  }

  const push = (snapshot: T): T => {
    const result = stack.push(snapshot)
    sync()
    return result
  }

  const undo = (): T | undefined => {
    const result = stack.undo()
    sync()
    return result
  }

  const redo = (): T | undefined => {
    const result = stack.redo()
    sync()
    return result
  }

  const clear = () => {
    stack.clear()
    sync()
  }

  // Direct stack mutations stay reactive (组(1) fix, aligned with vue 0.2.19+)
  const trackedStack = trackUndoStack(stack, sync)

  return { push, undo, redo, clear, stack: trackedStack, state }
}
