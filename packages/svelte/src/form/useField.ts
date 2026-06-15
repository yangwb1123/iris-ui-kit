import { readable, derived, type Readable } from 'svelte/store'
import { formatPath, getByPath, type FormState, type FormValues } from '@iris-ui/core'
import { getFormContext } from './context'

export interface UseFieldReturn<T> {
  name: string
  value: Readable<T>
  error: Readable<string | undefined>
  touched: Readable<boolean>
  dirty: Readable<boolean>
  setValue: (value: T) => void
  setTouched: (touched?: boolean) => void
}

/**
 * Binds a single field to the surrounding IrisForm.
 * Must be called within a component that is a descendant of `<IrisForm>`.
 *
 * `name` may be a flat top-level key OR a nested PATH (`'address.city'`,
 * `'items[2].sku'`); a flat key is a 1-segment path and stays back-compatible
 * (v3 R19).
 */
export function useField<T = unknown>(name: string): UseFieldReturn<T> {
  const form = getFormContext()
  const state = readable<FormState<FormValues>>(form.getState(), (set) => form.subscribe(set))
  // Canonical key for per-field state lookups (a flat key maps to itself).
  const key = formatPath(name)

  return {
    name,
    value: derived(state, ($s) => getByPath($s.values, name) as T),
    error: derived(state, ($s) => $s.errors[key]),
    touched: derived(state, ($s) => Boolean($s.touched[key])),
    dirty: derived(state, ($s) => Boolean($s.dirty[key])),
    setValue: (next: T) => form.setFieldValue(name, next as never),
    setTouched: (touched = true) => form.setFieldTouched(name, touched),
  }
}
