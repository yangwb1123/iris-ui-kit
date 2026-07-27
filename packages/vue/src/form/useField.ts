import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import { formatPath, getByPath, type FormState, type FormValues } from '@iris-ui-kit/core'
import { useFormContext } from './context'

export interface FieldBindProps {
  modelValue: unknown
  'onUpdate:modelValue': (value: unknown) => void
  invalid: boolean
  onBlur: () => void
}

export interface UseFieldReturn<T> {
  name: string
  value: ComputedRef<T>
  error: ComputedRef<string | undefined>
  touched: ComputedRef<boolean>
  dirty: ComputedRef<boolean>
  setValue: (value: T) => void
  setTouched: (touched?: boolean) => void
  /**
   * Bundle for `v-bind` onto a v-model'd Iris control (`IrisInput`,
   * `IrisSelect`, …): wires `modelValue` / `update:modelValue` / `invalid` /
   * `blur`. Use `value` + `setValue` directly for bespoke bindings.
   */
  fieldProps: ComputedRef<FieldBindProps>
}

/**
 * Binds a single field to the surrounding `<IrisForm>`. `T` is the value type
 * at the call site (the injection erases the form's generic).
 *
 * `name` may be a flat top-level key OR a nested PATH (`'address.city'`,
 * `'items[2].sku'`); a flat key is a 1-segment path and stays back-compatible
 * (v3 R19).
 */
export function useField<T = unknown>(name: string): UseFieldReturn<T> {
  const form = useFormContext()
  const state = ref(form.getState()) as Ref<FormState<FormValues>>
  const unsubscribe = form.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(unsubscribe)

  // Canonical key for per-field state lookups (a flat key maps to itself).
  const key = formatPath(name)
  const value = computed(() => getByPath(state.value.values, name) as T)
  const error = computed(() => state.value.errors[key])

  return {
    name,
    value,
    error,
    touched: computed(() => Boolean(state.value.touched[key])),
    dirty: computed(() => Boolean(state.value.dirty[key])),
    setValue: (next) => form.setFieldValue(name, next as never),
    setTouched: (touched = true) => form.setFieldTouched(name, touched),
    fieldProps: computed(() => ({
      modelValue: value.value,
      'onUpdate:modelValue': (next: unknown) => form.setFieldValue(name, next as never),
      invalid: Boolean(error.value),
      onBlur: () => form.setFieldTouched(name, true),
    })),
  }
}
