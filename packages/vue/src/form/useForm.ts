import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
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
  /** The form store — pass to `<IrisForm :form="...">`. */
  form: FormStore<V>
  /** The full reactive state snapshot. */
  state: Ref<FormState<V>>
  values: ComputedRef<V>
  errors: ComputedRef<FieldErrors<V>>
  touched: ComputedRef<FieldFlags<V>>
  dirty: ComputedRef<FieldFlags<V>>
  isSubmitting: ComputedRef<boolean>
  isValidating: ComputedRef<boolean>
  submitCount: ComputedRef<number>
  isValid: ComputedRef<boolean>
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
 * Vue binding for the framework-agnostic form engine. Creates the store in
 * `setup()` (runs once) and bridges it into Vue reactivity via a `ref` updated
 * on each store change, cleaned up on unmount. Because `setup` runs once,
 * `onSubmit` / `validate` closures stay live against reactive state — no
 * stale-callback handling is needed (unlike the React adapter).
 */
export function useForm<V extends FormValues>(config: FormConfig<V>): UseFormReturn<V> {
  const form = createFormStore(config)
  const state = ref(form.getState()) as Ref<FormState<V>>
  const unsubscribe = form.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(unsubscribe)

  return {
    form,
    state,
    values: computed(() => state.value.values),
    errors: computed(() => state.value.errors),
    touched: computed(() => state.value.touched),
    dirty: computed(() => state.value.dirty),
    isSubmitting: computed(() => state.value.isSubmitting),
    isValidating: computed(() => state.value.isValidating),
    submitCount: computed(() => state.value.submitCount),
    isValid: computed(() => Object.keys(state.value.errors).length === 0),
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
