import { readable, derived, type Readable } from 'svelte/store'
import {
  createFormStore,
  type FieldErrors,
  type FieldFlags,
  type FormConfig,
  type FormState,
  type FormStore,
  type FormValues,
} from '@iris-ui-kit/core'

export interface UseFormReturn<V extends FormValues> {
  form: FormStore<V>
  state: Readable<FormState<V>>
  values: Readable<V>
  errors: Readable<FieldErrors<V>>
  touched: Readable<FieldFlags<V>>
  dirty: Readable<FieldFlags<V>>
  isSubmitting: Readable<boolean>
  isValidating: Readable<boolean>
  submitCount: Readable<number>
  isValid: Readable<boolean>
  setFieldValue: FormStore<V>['setFieldValue']
  setValues: FormStore<V>['setValues']
  setFieldTouched: FormStore<V>['setFieldTouched']
  setFieldError: FormStore<V>['setFieldError']
  setErrors: FormStore<V>['setErrors']
  validateField: FormStore<V>['validateField']
  validateForm: FormStore<V>['validateForm']
  handleSubmit: FormStore<V>['handleSubmit']
  reset: FormStore<V>['reset']
}

/**
 * Svelte binding for the framework-agnostic form engine.
 * Returns Svelte stores for reactive state.
 */
export function useForm<V extends FormValues>(config: FormConfig<V>): UseFormReturn<V> {
  const form = createFormStore(config)
  const state = readable<FormState<V>>(form.getState(), (set) => form.subscribe(set))

  return {
    form,
    state,
    values: derived(state, ($s) => $s.values),
    errors: derived(state, ($s) => $s.errors),
    touched: derived(state, ($s) => $s.touched),
    dirty: derived(state, ($s) => $s.dirty),
    isSubmitting: derived(state, ($s) => $s.isSubmitting),
    isValidating: derived(state, ($s) => $s.isValidating),
    submitCount: derived(state, ($s) => $s.submitCount),
    isValid: derived(state, ($s) => Object.keys($s.errors).length === 0),
    setFieldValue: form.setFieldValue,
    setValues: form.setValues,
    setFieldTouched: form.setFieldTouched,
    setFieldError: form.setFieldError,
    setErrors: form.setErrors,
    validateField: form.validateField,
    validateForm: form.validateForm,
    handleSubmit: form.handleSubmit,
    reset: form.reset,
  }
}
