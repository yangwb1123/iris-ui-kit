import { createSignal, onCleanup, createMemo, type Accessor } from 'solid-js'
import type { FormState, FormValues } from '@iris-ui-kit/core'
import { useFormContext } from './context'

export interface UseFieldArrayReturn<T> {
  name: string
  fields: Accessor<T[]>
  push: (item: T) => void
  remove: (index: number) => void
  insert: (index: number, item: T) => void
  move: (from: number, to: number) => void
  replace: (items: T[]) => void
}

/**
 * Manages an array field within a `<IrisForm>`. Mutators delegate to the core
 * {@link FormStore} array helpers (`arrayPush`/`arrayInsert`/`arrayRemove`/
 * `arrayMove`), which RE-KEY each element's error/touched/dirty/validating state
 * across the mutation — so a row's per-element validation state FOLLOWS the row
 * when rows are removed or reordered (removing `items[0]` shifts `items[2]`'s
 * error down to `items[1]`). `replace` swaps the whole array.
 *
 * Solid port of the React useFieldArray.
 */
export function useFieldArray<T = unknown>(name: string): UseFieldArrayReturn<T> {
  const form = useFormContext()
  const [state, setState] = createSignal<FormState<FormValues>>(form.getState())
  const unsubscribe = form.subscribe((next) => {
    setState(next as FormState<FormValues>)
  })
  onCleanup(unsubscribe)

  const fields = createMemo(
    () => (Array.isArray(state().values[name]) ? state().values[name] : []) as T[],
  )

  return {
    name,
    fields,
    push: (item) => form.arrayPush(name as never, item as never),
    remove: (index) => form.arrayRemove(name as never, index),
    insert: (index, item) => form.arrayInsert(name as never, index, item as never),
    move: (from, to) => form.arrayMove(name as never, from, to),
    replace: (items) => form.setFieldValue(name, items as never),
  }
}
