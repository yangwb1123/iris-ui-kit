import { computed, type ComputedRef } from 'vue'
import { formatPath, getByPath, parsePath } from '@iris-ui-kit/core'
import { useFormContext } from './context'
import { useStoreSelector } from '../useStore'

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

  // Canonical key for per-field state lookups (a flat key maps to itself).
  const key = formatPath(name)
  // Hoisted once — selectors run on every store emission (core `subscribeWith`).
  const segments = parsePath(name)

  // Four narrow per-field slices, each Object.is-gated by core `subscribeWith`.
  // Core writes use structural sharing (`setByPath`, per-key flag spread-copies),
  // so an unrelated keystroke does NOT move these refs and this field's computeds
  // do not invalidate (previously a whole-form deep `ref` re-ran every field's
  // computeds on every emission). Selectors are allocation-free by construction.
  const valueSlice = useStoreSelector(form.store, (s) => getByPath(s.values, segments) as T)
  const errorSlice = useStoreSelector(form.store, (s) => s.errors[key])
  const touchedSlice = useStoreSelector(form.store, (s) => Boolean(s.touched[key]))
  const dirtySlice = useStoreSelector(form.store, (s) => Boolean(s.dirty[key]))

  // computed wrappers keep the published ComputedRef<T> member types exactly as
  // declared (a bare shallow ref is not assignable to ComputedRef in Vue 3.4+),
  // and each computed invalidates only when its own slice actually moves.
  const value = computed(() => valueSlice.value)
  const error = computed(() => errorSlice.value)
  const touched = computed(() => touchedSlice.value)
  const dirty = computed(() => dirtySlice.value)

  return {
    name,
    value,
    error,
    touched,
    dirty,
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
