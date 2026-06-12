import { createSignal, onCleanup, createMemo, type Accessor } from 'solid-js'
import type { FormState, FormValues } from '@iris-ui/core'
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
 * Manages an array field within a `<IrisForm>`.
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

  const current = (): T[] => {
    const value = form.getState().values[name]
    return Array.isArray(value) ? (value as T[]) : []
  }
  const set = (next: T[]) => form.setFieldValue(name, next as never)

  return {
    name,
    fields,
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
