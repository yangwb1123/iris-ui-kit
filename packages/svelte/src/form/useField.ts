import { readable, derived, type Readable } from 'svelte/store'
import type { FormState, FormValues } from '@iris-ui/core'
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
 */
export function useField<T = unknown>(name: string): UseFieldReturn<T> {
  const form = getFormContext()
  const state = readable<FormState<FormValues>>(form.getState(), (set) => form.subscribe(set))

  return {
    name,
    value: derived(state, ($s) => $s.values[name] as T),
    error: derived(state, ($s) => $s.errors[name]),
    touched: derived(state, ($s) => Boolean($s.touched[name])),
    dirty: derived(state, ($s) => Boolean($s.dirty[name])),
    setValue: (next: T) => form.setFieldValue(name, next as never),
    setTouched: (touched = true) => form.setFieldTouched(name, touched),
  }
}
