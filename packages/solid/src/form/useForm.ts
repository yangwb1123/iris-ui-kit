import { createSignal, onCleanup, type Accessor } from 'solid-js'
import {
  createFormStore,
  type FieldErrors,
  type FieldFlags,
  type FormConfig,
  type FormState,
  type FormStore,
  type FormValues,
} from '@iris-ui/core'

export interface UseFormReturn<V extends FormValues> {
  /** The form store — pass to `<IrisForm form={...}>`. */
  form: FormStore<V>
  /** The full reactive state snapshot. */
  state: Accessor<FormState<V>>
  values: Accessor<V>
  errors: Accessor<FieldErrors<V>>
  touched: Accessor<FieldFlags<V>>
  dirty: Accessor<FieldFlags<V>>
  isSubmitting: Accessor<boolean>
  isValidating: Accessor<boolean>
  submitCount: Accessor<number>
  isValid: Accessor<boolean>
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
 * Solid binding for the framework-agnostic form engine. Creates the store and
 * bridges it into Solid signals.
 */
export function useForm<V extends FormValues>(config: FormConfig<V>): UseFormReturn<V> {
  const form = createFormStore(config)
  const [state, setState] = createSignal<FormState<V>>(form.getState())
  const unsubscribe = form.subscribe((next) => {
    setState(next as FormState<V>)
  })
  onCleanup(unsubscribe)

  return {
    form,
    state,
    values: () => state().values,
    errors: () => state().errors,
    touched: () => state().touched,
    dirty: () => state().dirty,
    isSubmitting: () => state().isSubmitting,
    isValidating: () => state().isValidating,
    submitCount: () => state().submitCount,
    isValid: () => Object.keys(state().errors).length === 0,
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
