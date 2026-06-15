import { createSignal, onCleanup, createMemo, type Accessor } from 'solid-js'
import { formatPath, getByPath, type FormState, type FormValues } from '@iris-ui/core'
import { useFormContext } from './context'

export interface FieldBindProps {
  value: unknown
  onChange: (value: unknown) => void
  invalid: boolean
  onBlur: () => void
}

export interface UseFieldReturn<T> {
  name: string
  value: Accessor<T>
  error: Accessor<string | undefined>
  touched: Accessor<boolean>
  dirty: Accessor<boolean>
  setValue: (value: T) => void
  setTouched: (touched?: boolean) => void
  fieldProps: Accessor<FieldBindProps>
}

/**
 * Binds a single field to the surrounding `<IrisForm>`.
 * Solid port of the Vue useField.
 *
 * `name` may be a flat top-level key OR a nested PATH (`'address.city'`,
 * `'items[2].sku'`); a flat key is a 1-segment path and stays back-compatible
 * (v3 R19).
 */
export function useField<T = unknown>(name: string): UseFieldReturn<T> {
  const form = useFormContext()
  const [state, setState] = createSignal<FormState<FormValues>>(form.getState())
  const unsubscribe = form.subscribe((next) => {
    setState(next as FormState<FormValues>)
  })
  onCleanup(unsubscribe)

  // Canonical key for per-field state lookups (a flat key maps to itself).
  const key = formatPath(name)
  const value = createMemo(() => getByPath(state().values, name) as T)
  const error = createMemo(() => state().errors[key])

  return {
    name,
    value,
    error,
    touched: createMemo(() => Boolean(state().touched[key])),
    dirty: createMemo(() => Boolean(state().dirty[key])),
    setValue: (next) => form.setFieldValue(name, next as never),
    setTouched: (touched = true) => form.setFieldTouched(name, touched),
    fieldProps: createMemo(() => ({
      value: value(),
      onChange: (next: unknown) => form.setFieldValue(name, next as never),
      invalid: Boolean(error()),
      onBlur: () => form.setFieldTouched(name, true),
    })),
  }
}
