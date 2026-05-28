import * as React from 'react'
import type { FormStore, FormValues } from '@iris-ui/core'

/**
 * Carries the active form's {@link FormStore} down to descendant fields so
 * `useField` can bind without prop drilling. The generic is erased at the
 * context boundary; `useField<T>` re-applies the value type at the call site.
 */
export const FormContext = React.createContext<FormStore<FormValues> | null>(null)

export function useFormContext(): FormStore<FormValues> {
  const ctx = React.useContext(FormContext)
  if (!ctx) {
    throw new Error('useField / useFormContext must be used within an <IrisForm>')
  }
  return ctx
}
