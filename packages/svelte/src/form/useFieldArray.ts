import { readable, derived, type Readable } from 'svelte/store'
import type { FormState, FormValues } from '@iris-ui/core'
import { getFormContext } from './context'

export interface UseFieldArrayReturn<T> {
  name: string
  fields: Readable<T[]>
  push: (item: T) => void
  remove: (index: number) => void
  insert: (index: number, item: T) => void
  move: (from: number, to: number) => void
  replace: (items: T[]) => void
}

/**
 * Manage a dynamic array field (repeatable rows) inside an `<IrisForm>`. Mutators
 * delegate to the core {@link FormStore} array helpers (`arrayPush`/`arrayInsert`/
 * `arrayRemove`/`arrayMove`), which RE-KEY each element's error/touched/dirty/
 * validating state across the mutation — so a row's per-element validation state
 * FOLLOWS the row when rows are removed or reordered (removing `items[0]` shifts
 * `items[2]`'s error down to `items[1]`). `replace` swaps the whole array.
 */
export function useFieldArray<T = unknown>(name: string): UseFieldArrayReturn<T> {
  const form = getFormContext()
  const state = readable<FormState<FormValues>>(form.getState(), (set) => form.subscribe(set))

  return {
    name,
    fields: derived(state, ($s) => (Array.isArray($s.values[name]) ? $s.values[name] : []) as T[]),
    push: (item) => form.arrayPush(name as never, item as never),
    remove: (index) => form.arrayRemove(name as never, index),
    insert: (index, item) => form.arrayInsert(name as never, index, item as never),
    move: (from, to) => form.arrayMove(name as never, from, to),
    replace: (items) => form.setFieldValue(name, items as never),
  }
}
