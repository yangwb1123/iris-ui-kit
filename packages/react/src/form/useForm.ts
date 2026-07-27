import * as React from 'react'
import {
  createFormStore,
  type FormConfig,
  type FormState,
  type FormStore,
  type FormValues,
} from '@iris-ui-kit/core'
import { useStore } from '../useStore'

export interface UseFormReturn<V extends FormValues> extends FormState<V> {
  /** Underlying subscribable store. */
  store: FormStore<V>['store']
  /** The form store itself — pass to `<IrisForm form={...}>`. */
  form: FormStore<V>
  isValid: boolean
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
 * React binding for the framework-agnostic form engine. Instantiates the store
 * once (like `useState`'s lazy initializer) and bridges it into React via
 * `useSyncExternalStore`. `initialValues` / `validators` / timing are captured
 * on first render; `onSubmit` and `validate` are read through a ref each render
 * so they always see the latest closures (no stale-callback footgun).
 */
export function useForm<V extends FormValues>(config: FormConfig<V>): UseFormReturn<V> {
  const latest = React.useRef(config)
  latest.current = config

  const ref = React.useRef<FormStore<V> | null>(null)
  if (ref.current === null) {
    ref.current = createFormStore<V>({
      initialValues: config.initialValues,
      validators: config.validators,
      validateOnChange: config.validateOnChange,
      validateOnBlur: config.validateOnBlur,
      validate: (values) => latest.current.validate?.(values) ?? {},
      onSubmit: (values) => latest.current.onSubmit?.(values),
    })
  }
  const form = ref.current
  const state = useStore(form.store)

  return {
    ...state,
    store: form.store,
    form,
    isValid: Object.keys(state.errors).length === 0,
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
