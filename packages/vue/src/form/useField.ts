import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import type { FormState, FormValues } from '@iris-ui/core'
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
 */
export function useField<T = unknown>(name: string): UseFieldReturn<T> {
  const form = useFormContext()
  const state = ref(form.getState()) as Ref<FormState<FormValues>>
  const unsubscribe = form.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(unsubscribe)

  const value = computed(() => state.value.values[name] as T)
  const error = computed(() => state.value.errors[name])

  return {
    name,
    value,
    error,
    touched: computed(() => Boolean(state.value.touched[name])),
    dirty: computed(() => Boolean(state.value.dirty[name])),
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
