import * as React from 'react'
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
 */
export function useField<T = unknown>(name: string): UseFieldReturn<T> {
  const form = useFormContext()
  const state = useStore(form.store)
  const value = state.values[name] as T

  return {
    name,
    value,
    error: state.errors[name],
    touched: Boolean(state.touched[name]),
    dirty: Boolean(state.dirty[name]),
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
