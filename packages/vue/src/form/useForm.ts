import { computed, type ComputedRef, type Ref } from 'vue'
import {
  createFormStore,
  type FieldErrors,
  type FieldFlags,
  type FormConfig,
  type FormState,
  type FormStore,
  type FormValues,
} from '@iris-ui-kit/core'
import { useStore } from '../useStore'

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
 * `setup()` (runs once) and bridges it into Vue reactivity via `useStore` (a
 * shallow snapshot ref updated on each store change, detached on scope
 * dispose). Because `setup` runs once,
 * `onSubmit` / `validate` closures stay live against reactive state — no
 * stale-callback handling is needed (unlike the React adapter).
 */
export function useForm<V extends FormValues>(config: FormConfig<V>): UseFormReturn<V> {
  const form = createFormStore(config)

  // Whole-state bridge via the shared `useStore` (shallow, detached on scope
  // dispose — identical to the old `onBeforeUnmount` for setup-scope consumers,
  // and correct for nested scopes too). The published `state: Ref<FormState<V>>`
  // type is unchanged (R5); the runtime is a shallow snapshot — the store is the
  // only write path (it always was), so this localized cast is type-only. The
  // per-field narrowing payoff comes from `useField` / `useFieldArray`; the
  // form-level computeds below are whole-form aggregates by design.
  const state = useStore(form.store) as unknown as Ref<FormState<V>>

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
