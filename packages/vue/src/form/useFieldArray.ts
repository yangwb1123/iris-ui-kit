import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import type { FormState, FormValues } from '@iris-ui/core'
import { useFormContext } from './context'

export interface UseFieldArrayReturn<T> {
  name: string
  /** Current array value (reactive). */
  fields: ComputedRef<T[]>
  /** Append an item. */
  push: (item: T) => void
  /** Remove the item at `index`. */
  remove: (index: number) => void
  /** Insert `item` at `index` (shifting the rest right). */
  insert: (index: number, item: T) => void
  /** Move the item from `from` to `to`. */
  move: (from: number, to: number) => void
  /** Replace the whole array. */
  replace: (items: T[]) => void
}

/**
 * Manage a dynamic array field (repeatable rows) inside an `<IrisForm>`. The
 * field value is a plain array; mutators write a new array via the form store
 * (dirty tracking + validation run as usual). Handlers read the latest value
 * at call time, so consecutive ops in one tick compose correctly.
 */
export function useFieldArray<T = unknown>(name: string): UseFieldArrayReturn<T> {
  const form = useFormContext()
  const state = ref(form.getState()) as Ref<FormState<FormValues>>
  const unsubscribe = form.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(unsubscribe)

  const current = (): T[] => {
    const value = form.getState().values[name]
    return Array.isArray(value) ? (value as T[]) : []
  }
  const set = (next: T[]) => form.setFieldValue(name, next as never)

  return {
    name,
    fields: computed(
      () => (Array.isArray(state.value.values[name]) ? state.value.values[name] : []) as T[],
    ),
    push: (item) => set([...current(), item]),
    remove: (index) => set(current().filter((_, i) => i !== index)),
    insert: (index, item) => {
      const arr = current()
      set([...arr.slice(0, index), item, ...arr.slice(index)])
    },
    move: (from, to) => {
      const arr = current()
      if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return
      const next = [...arr]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved as T)
      set(next)
    },
    replace: (items) => set(items),
  }
}
