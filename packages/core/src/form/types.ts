import type { Store } from '../store'
import { formatPath, type Path } from '../path'

export type FormValues = Record<string, unknown>
export type Key<V> = keyof V & string
export type PathSegment = string | number

/** Flat keys and nested path references accepted by the form store. */
export type FieldPath<V> = Key<V> | (string & {}) | readonly PathSegment[]

export type ArrayKey<V> = { [K in Key<V>]: V[K] extends readonly unknown[] ? K : never }[Key<V>]
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never

export type FieldErrors<V extends FormValues> = Partial<Record<Key<V> | (string & {}), string>>
export type FieldFlags<V extends FormValues> = Partial<Record<Key<V> | (string & {}), boolean>>

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
  validating: FieldFlags<V>
  submitCount: number
  currentStep: number
}

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
  validateOnMount?: boolean
  validationDebounceMs?: number
  setFieldValueDebounceMs?: number
  dependencies?: Partial<Record<Key<V>, Key<V>[]>>
  steps?: FormStep<V>[]
  parse?: (values: V) => V
  transform?: (values: V) => V
  maxHistory?: number
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
  isDirty(): boolean
  getDirtyFields(): Key<V>[]
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  serialize(opts?: { includeTouched?: boolean; exclude?: (keyof V)[] }): {
    values: Partial<V>
    touched?: FieldFlags<V>
  }
  hydrate(draft: { values: Partial<V>; touched?: FieldFlags<V> }): void
}

export const FORM_STORE_KEY = 'form'

/** Canonical key for per-field state maps. */
export function pathKey(ref: FieldPath<unknown>): string {
  return formatPath(ref as Path)
}
