import { useStore } from '../useStore'
import { useFormContext } from './context'

export interface UseFieldArrayReturn<T> {
  name: string
  /** Current array value (reactive). */
  fields: T[]
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
 * Manage a dynamic array field (repeatable rows) inside an `<IrisForm>`. Mutators
 * delegate to the core {@link FormStore} array helpers (`arrayPush`/`arrayInsert`/
 * `arrayRemove`/`arrayMove`), which RE-KEY each element's error/touched/dirty/
 * validating state across the mutation — so a row's per-element validation state
 * FOLLOWS the row when rows are removed or reordered (removing `items[0]` shifts
 * `items[2]`'s error down to `items[1]`). `replace` swaps the whole array.
 *
 * ```tsx
 * const items = useFieldArray<{ sku: string }>('items')
 * items.fields.map((_, i) => <SkuRow key={i} index={i} />)
 * <button onClick={() => items.push({ sku: '' })}>Add</button>
 * ```
 */
export function useFieldArray<T = unknown>(name: string): UseFieldArrayReturn<T> {
  const form = useFormContext()
  const state = useStore(form.store)
  const fields = (Array.isArray(state.values[name]) ? state.values[name] : []) as T[]

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
