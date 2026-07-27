import { inject, type InjectionKey } from 'vue'
import type { FormStore, FormValues } from '@iris-ui-kit/core'

/**
 * Provides the active form's {@link FormStore} to descendant fields so
 * `useField` can bind without prop drilling. The generic is erased at the
 * injection boundary; `useField<T>` re-applies the value type at the call site.
 */
export const FormInjectionKey: InjectionKey<FormStore<FormValues>> = Symbol('IrisForm')

export function useFormContext(): FormStore<FormValues> {
  const form = inject(FormInjectionKey, null)
  if (!form) {
    throw new Error('useField / useFormContext must be used within an <IrisForm>')
  }
  return form
}
