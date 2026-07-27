import { createContext, useContext } from 'solid-js'
import type { FormStore, FormValues } from '@iris-ui-kit/core'

export const FormContext = createContext<FormStore<FormValues> | null>(null)

export function useFormContext(): FormStore<FormValues> {
  const form = useContext(FormContext)
  if (!form) {
    throw new Error('useField / useFormContext must be used within an <IrisForm>')
  }
  return form
}
