import { shallowRef, type ShallowRef } from 'vue'
import { createUndoStack, type UndoStack, type UndoStackOptions } from '@iris-ui-kit/core/undo'

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Wrap a raw {@link UndoStack} in a Proxy so that every mutating call
 * (`push`/`undo`/`redo`/`clear`) — including calls made directly on the
 * returned `stack` reference — triggers `onMutate()` afterwards.
 *
 * Core's `UndoStack` is a plain mutable object with **no change notification**
 * (JSDoc promises it is a stable, modifiable reference). Without this wrapper,
 * `api.stack.push(x)` mutated core silently and left the reactive `state`
 * permanently stale, with zero errors.
 *
 * Only the `get` trap is installed: mutating methods return pre-created,
 * cached wrapper closures (so `stack.push === stack.push` — stable function
 * identity), while read-only members (`canUndo`/`canRedo`/`depth`/`index`)
 * pass through untouched. `ownKeys`/`getOwnPropertyDescriptor` are forwarded
 * by the default traps, so enumeration behavior is unchanged.
 */
function trackUndoStack<T>(stack: UndoStack<T>, onMutate: () => void): UndoStack<T> {
  const mutators = new Set<keyof UndoStack<T>>(['push', 'undo', 'redo', 'clear'])
  const wrappers = new Map<keyof UndoStack<T>, (...args: unknown[]) => unknown>()

  return new Proxy(stack, {
    get(target, prop: string | symbol, receiver): unknown {
      const key = prop as keyof UndoStack<T>
      if (mutators.has(key)) {
        let fn = wrappers.get(key)
        if (!fn) {
          const original = target[key] as (...args: unknown[]) => unknown
          fn = (...args: unknown[]) => {
            const result = Reflect.apply(original, target, args)
            onMutate()
            return result
          }
          wrappers.set(key, fn)
        }
        return fn
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
 * Vue bridge over the framework-agnostic {@link createUndoStack}.
 * Creates the stack once in `setup()` and returns a stable controller
 * plus a reactive `state` that tracks `canUndo`/`canRedo`/`depth`/`index` for
 * easy UI binding.
 *
 * The returned `push`/`undo`/`redo`/`clear` automatically update the reactive
 * state — no manual `.value = ...` needed. The same holds for mutating the
 * returned `stack` directly (`api.stack.push(x)`, `api.stack.undo()`, …): the
 * raw stack is wrapped so every mutation is observed and synced.
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
  /**
   * The raw undo stack (stable reference, same across renders). Its mutating
   * methods (`push`/`undo`/`redo`/`clear`) are observed — direct calls keep
   * `state` in sync.
   */
  stack: UndoStack<T>
  /** Reactive metadata: canUndo, canRedo, depth, index. */
  state: ShallowRef<UndoStackReactiveState>
} {
  const raw = createUndoStack<T>(options)

  const state = shallowRef<UndoStackReactiveState>({
    canUndo: raw.canUndo(),
    canRedo: raw.canRedo(),
    depth: raw.depth,
    index: raw.index,
  })

  const sync = () => {
    state.value = {
      canUndo: raw.canUndo(),
      canRedo: raw.canRedo(),
      depth: raw.depth,
      index: raw.index,
    }
  }

  // Wrap the raw stack so direct `api.stack.push/undo/redo/clear` calls also
  // refresh `state` — previously they mutated core silently and left the
  // reactive state permanently stale (defect group 1). The proxy is the single
  // sync point below.
  const stack = trackUndoStack(raw, sync)

  // Delegate through the wrapped stack: `onMutate` fires on every mutating
  // call — even true no-ops and calls returning `undefined` (a legal snapshot
  // value for a generic T, so the return value cannot distinguish "no-op"
  // from "pointer moved" — defect group 2, aligned with vue 0.2.19).
  const push = (snapshot: T): T => stack.push(snapshot)
  const undo = (): T | undefined => stack.undo()
  const redo = (): T | undefined => stack.redo()
  const clear = (): void => stack.clear()

  return { push, undo, redo, clear, stack, state }
}
