import * as React from 'react'
import { formatPath, getByPath } from '@iris-ui-kit/core'
import { useStore } from '../useStore'
import { useFormContext } from './context'

export interface FieldInputProps {
  name: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onBlur: () => void
}

export interface UseFieldReturn<T> {
  name: string
  value: T
  error: string | undefined
  touched: boolean
  dirty: boolean
  setValue: (value: T) => void
  setTouched: (touched?: boolean) => void
  /**
   * Convenience bundle for a native text input / textarea. Spread onto
   * `IrisInput` / `IrisTextarea`. Non-text controls (checkbox, select,
   * number, custom) should wire `value` + `setValue` directly.
   */
  inputProps: FieldInputProps
}

/**
 * Binds a single field to the surrounding `<IrisForm>`. Re-renders only its
 * host component when the form store changes. `T` is the value type at the
 * call site (the context erases the form's generic).
 *
 * `name` may be a flat top-level key (`'email'`) OR a nested PATH
 * (`'address.city'`, `'items[2].sku'`) — the form keys its per-field state by
 * the canonical path, so a flat key is just a 1-segment path and stays 100%
 * back-compatible (v3 R19).
 */
export function useField<T = unknown>(name: string): UseFieldReturn<T> {
  const form = useFormContext()
  const state = useStore(form.store)
  // Canonical key for per-field state lookups (a flat key maps to itself).
  const key = formatPath(name)
  const value = getByPath(state.values, name) as T

  return {
    name,
    value,
    error: state.errors[key],
    touched: Boolean(state.touched[key]),
    dirty: Boolean(state.dirty[key]),
    setValue: (next) => form.setFieldValue(name, next as never),
    setTouched: (touched = true) => form.setFieldTouched(name, touched),
    inputProps: {
      name,
      value: (value ?? '') as string,
      onChange: (event) => form.setFieldValue(name, event.target.value as never),
      onBlur: () => form.setFieldTouched(name, true),
    },
  }
}
