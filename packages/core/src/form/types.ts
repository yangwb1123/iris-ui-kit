/**
 * Form types for Iris UI form engine.
 *
 * This is the type-only entry point. No runtime logic — keeps type
 * declarations separated from implementation so consumers can import
 * types without pulling in the full engine.
 */
import type { Store } from '../store'

/** @internal Canonical segment for a path expression. */
export type PathSegment = string | number

/** Record-like values object (flat or deeply nested). */
export type FormValues = Record<string, unknown>

export type Key<V> = keyof V & string

/**
 * A field reference: a flat top-level key OR a nested path string
 * (`address.city`, `items[2].sku`) / a parsed segment array. Widening `Key<V>`
 * to also accept a `Path` keeps existing `keyof V` call-sites type-checking
 * while opening up nested binding.
 */
export type FieldPath<V> = Key<V> | (string & {}) | readonly PathSegment[]

/** Keys of `V` whose value is an array (the targets of the `array*` helpers). */
export type ArrayKey<V> = { [K in Key<V>]: V[K] extends readonly unknown[] ? K : never }[Key<V>]
/** The element type of an array field value. */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never

export type FieldErrors<_V extends FormValues> = Record<string, string | undefined>
export type FieldFlags<_V extends FormValues> = Record<string, boolean | undefined>

/** Returns an error message, or `undefined` when the value is valid. */
export type Validator<V extends FormValues> = (
  value: V[Key<V>],
  values: V,
) => string | undefined | Promise<string | undefined>

export type FormValidators<V extends FormValues> = Partial<Record<Key<V>, Validator<V>>>

export interface FormState<V extends FormValues> {
  values: V
  errors: FieldErrors<V>
  touched: FieldFlags<V>
  dirty: FieldFlags<V>
  isSubmitting: boolean
  isValidating: boolean
  /** Per-field flag: true while that field's (async) validator is in flight. */
  validating: FieldFlags<V>
  submitCount: number
  /** Active step index (0-based) when the form is configured with `steps`. */
  currentStep: number
}

/** One step of a multi-step (wizard) form: the fields it owns. */
export interface FormStep<V extends FormValues> {
  id?: string
  fields: Key<V>[]
}

export interface FormConfig<V extends FormValues> {
  initialValues: V
  validators?: FormValidators<V>
  validate?: (values: V) => FieldErrors<V> | Promise<FieldErrors<V>>
  validateOnChange?: boolean
  validateOnBlur?: boolean
  validationDebounceMs?: number
  dependencies?: Partial<Record<Key<V>, Key<V>[]>>
  steps?: FormStep<V>[]
  parse?: (values: V) => V
  transform?: (values: V) => V
  onSubmit?: (values: V) => void | Promise<void>
}

export interface FormStore<V extends FormValues> {
  store: Store<FormState<V>>
  getState(): FormState<V>
  subscribe(listener: (state: FormState<V>) => void): () => void
  setFieldValue<K extends Key<V>>(name: K, value: V[K]): void
  setFieldValue(path: FieldPath<V>, value: unknown): void
  getFieldValue(path: FieldPath<V>): unknown
  setValues(values: Partial<V>): void
  arrayPush<K extends ArrayKey<V>>(name: K, item: ArrayElement<V[K]>): void
  arrayInsert<K extends ArrayKey<V>>(name: K, index: number, item: ArrayElement<V[K]>): void
  arrayRemove<K extends ArrayKey<V>>(name: K, index: number): void
  arraySwap<K extends ArrayKey<V>>(name: K, a: number, b: number): void
  arrayMove<K extends ArrayKey<V>>(name: K, from: number, to: number): void
  setFieldTouched(name: FieldPath<V>, touched?: boolean): void
  setFieldError(name: FieldPath<V>, error: string | undefined): void
  setErrors(errors: FieldErrors<V>): void
  validateField(name: FieldPath<V>): Promise<string | undefined>
  validateForm(): Promise<FieldErrors<V>>
  validateStep(index?: number): Promise<boolean>
  stepCount(): number
  goToStep(index: number): void
  nextStep(): Promise<boolean>
  prevStep(): void
  handleSubmit(): Promise<void>
  reset(nextInitialValues?: V): void
  isValid(): boolean
}

/** The root form state key when used in contexts / providers. */
export const FORM_STORE_KEY = 'form'

/**
 * Returns the canonical string key under which a field's per-field state is stored.
 * A flat key ("email") returns itself; a nested path (["items", 2, "sku"]) returns "items.2.sku".
 */
export function pathKey(ref: FieldPath<unknown>): string {
  return Array.isArray(ref) ? ref.join('.') : String(ref)
}
