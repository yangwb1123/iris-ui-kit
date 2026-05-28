import { createStore, type Store } from './store'

/**
 * Framework-agnostic form engine. Owns value aggregation, dirty/touched
 * tracking, validation scheduling (sync + async, with stale-result race
 * protection), and the submit lifecycle — the hard parts of a form that have
 * nothing to do with any UI framework. The React (`useForm`/`useField`) and
 * Vue (`useForm` + provide/inject) adapters are thin bridges over the
 * `Store<FormState>` exposed here, exactly like every other Iris primitive.
 */

export type FormValues = Record<string, unknown>

type Key<V> = keyof V & string

export type FieldErrors<V extends FormValues> = Partial<Record<Key<V>, string>>
export type FieldFlags<V extends FormValues> = Partial<Record<Key<V>, boolean>>

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
  submitCount: number
}

export interface FormConfig<V extends FormValues> {
  initialValues: V
  /** Per-field validators, keyed by field name. */
  validators?: FormValidators<V>
  /**
   * Form-level validator. Runs after the per-field validators during
   * `validateForm` / submit; its errors are merged on top (so it can express
   * cross-field rules like "passwords must match").
   */
  validate?: (values: V) => FieldErrors<V> | Promise<FieldErrors<V>>
  /** Validate a field when its value changes. Default `true`. */
  validateOnChange?: boolean
  /** Validate a field when it is blurred (marked touched). Default `true`. */
  validateOnBlur?: boolean
  onSubmit?: (values: V) => void | Promise<void>
}

export interface FormStore<V extends FormValues> {
  /** Underlying subscribable store — bridge with `useStore` / `useMachine`. */
  store: Store<FormState<V>>
  getState(): FormState<V>
  subscribe(listener: (state: FormState<V>) => void): () => void
  setFieldValue<K extends Key<V>>(name: K, value: V[K]): void
  setValues(values: Partial<V>): void
  setFieldTouched(name: Key<V>, touched?: boolean): void
  setFieldError(name: Key<V>, error: string | undefined): void
  setErrors(errors: FieldErrors<V>): void
  validateField(name: Key<V>): Promise<string | undefined>
  validateForm(): Promise<FieldErrors<V>>
  handleSubmit(): Promise<void>
  reset(nextInitialValues?: V): void
  isValid(): boolean
}

export function createFormStore<V extends FormValues>(config: FormConfig<V>): FormStore<V> {
  const validators: FormValidators<V> = config.validators ?? {}
  const validateOnChange = config.validateOnChange ?? true
  const validateOnBlur = config.validateOnBlur ?? true

  let initialValues: V = { ...config.initialValues }

  const store = createStore<FormState<V>>({
    values: { ...config.initialValues },
    errors: {},
    touched: {},
    dirty: {},
    isSubmitting: false,
    isValidating: false,
    submitCount: 0,
  })

  // Monotonic per-field token. A validation result is only applied if its
  // field's token is still the latest when it resolves — so a slow async
  // validator that lost a race can never overwrite a newer answer.
  const tokens = new Map<Key<V>, number>()
  const nextToken = (name: Key<V>): number => {
    const t = (tokens.get(name) ?? 0) + 1
    tokens.set(name, t)
    return t
  }
  const isCurrent = (name: Key<V>, token: number): boolean => tokens.get(name) === token

  const writeError = (name: Key<V>, error: string | undefined): void => {
    store.setState((s) => {
      if (error) {
        if (s.errors[name] === error) return s
        return { ...s, errors: { ...s.errors, [name]: error } }
      }
      if (!(name in s.errors)) return s
      const errors = { ...s.errors }
      delete errors[name]
      return { ...s, errors }
    })
  }

  const runFieldValidator = async (name: Key<V>, values: V): Promise<string | undefined> => {
    const validator = validators[name]
    if (!validator) return undefined
    return validator(values[name], values)
  }

  const validateField: FormStore<V>['validateField'] = async (name) => {
    const token = nextToken(name)
    const error = await runFieldValidator(name, store.getState().values)
    if (!isCurrent(name, token)) return store.getState().errors[name]
    writeError(name, error)
    return error
  }

  const fieldNames = (): Key<V>[] => {
    const names = new Set<string>([...Object.keys(initialValues), ...Object.keys(validators)])
    return [...names] as Key<V>[]
  }

  const validateForm: FormStore<V>['validateForm'] = async () => {
    store.setState((s) => ({ ...s, isValidating: true }))
    const values = store.getState().values
    const names = Object.keys(validators) as Key<V>[]
    // Bump every field's token first so any in-flight single-field validation
    // is invalidated — this form pass becomes the authoritative answer.
    const tokenById = new Map<Key<V>, number>()
    for (const name of names) tokenById.set(name, nextToken(name))

    const entries = await Promise.all(
      names.map(async (name) => [name, await runFieldValidator(name, values)] as const),
    )
    let nextErrors: FieldErrors<V> = {}
    for (const [name, error] of entries) {
      if (error && isCurrent(name, tokenById.get(name) as number)) nextErrors[name] = error
    }
    if (config.validate) {
      const formErrors = await config.validate(values)
      nextErrors = { ...nextErrors, ...formErrors }
    }
    store.setState((s) => ({ ...s, errors: nextErrors, isValidating: false }))
    return nextErrors
  }

  const setFieldValue: FormStore<V>['setFieldValue'] = (name, value) => {
    store.setState((s) => ({
      ...s,
      values: { ...s.values, [name]: value },
      dirty: { ...s.dirty, [name]: !Object.is(value, initialValues[name]) },
    }))
    if (validateOnChange) void validateField(name)
  }

  const setValues: FormStore<V>['setValues'] = (values) => {
    const keys = Object.keys(values) as Key<V>[]
    store.setState((s) => {
      const nextValues = { ...s.values }
      const nextDirty = { ...s.dirty }
      for (const key of keys) {
        const v = values[key]
        nextValues[key] = v as V[Key<V>]
        nextDirty[key] = !Object.is(v, initialValues[key])
      }
      return { ...s, values: nextValues, dirty: nextDirty }
    })
    if (validateOnChange) for (const key of keys) void validateField(key)
  }

  const setFieldTouched: FormStore<V>['setFieldTouched'] = (name, touched = true) => {
    store.setState((s) => ({ ...s, touched: { ...s.touched, [name]: touched } }))
    if (touched && validateOnBlur) void validateField(name)
  }

  const setFieldError: FormStore<V>['setFieldError'] = (name, error) => {
    writeError(name, error)
  }

  const setErrors: FormStore<V>['setErrors'] = (errors) => {
    store.setState((s) => ({ ...s, errors: { ...errors } }))
  }

  const handleSubmit: FormStore<V>['handleSubmit'] = async () => {
    const allTouched: FieldFlags<V> = {}
    for (const name of fieldNames()) allTouched[name] = true
    store.setState((s) => ({
      ...s,
      submitCount: s.submitCount + 1,
      isSubmitting: true,
      touched: { ...s.touched, ...allTouched },
    }))
    const errors = await validateForm()
    if (Object.keys(errors).length > 0) {
      store.setState((s) => ({ ...s, isSubmitting: false }))
      return
    }
    try {
      await config.onSubmit?.(store.getState().values)
    } finally {
      store.setState((s) => ({ ...s, isSubmitting: false }))
    }
  }

  const reset: FormStore<V>['reset'] = (nextInitialValues) => {
    if (nextInitialValues) initialValues = { ...nextInitialValues }
    tokens.clear()
    store.setState({
      values: { ...initialValues },
      errors: {},
      touched: {},
      dirty: {},
      isSubmitting: false,
      isValidating: false,
      submitCount: 0,
    })
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    setFieldValue,
    setValues,
    setFieldTouched,
    setFieldError,
    setErrors,
    validateField,
    validateForm,
    handleSubmit,
    reset,
    isValid: () => Object.keys(store.getState().errors).length === 0,
  }
}
