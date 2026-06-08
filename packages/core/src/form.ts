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

/** Keys of `V` whose value is an array (the targets of the `array*` helpers). */
export type ArrayKey<V> = { [K in Key<V>]: V[K] extends readonly unknown[] ? K : never }[Key<V>]
/** The element type of an array field value. */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never

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
  /** Active step index (0-based) when the form is configured with `steps`. */
  currentStep: number
}

/** One step of a multi-step (wizard) form: the fields it owns. */
export interface FormStep<V extends FormValues> {
  /** Optional stable id / title for the step. */
  id?: string
  /** The fields validated when advancing past this step. */
  fields: Key<V>[]
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
  /**
   * Cross-field dependencies: when a key changes, the listed fields are also
   * re-validated. E.g. `{ password: ['confirmPassword'] }` re-checks the
   * confirmation inline as the password is edited, rather than only on submit.
   * One level deep (dependents are not themselves cascaded) to avoid cycles.
   */
  dependencies?: Partial<Record<Key<V>, Key<V>[]>>
  /**
   * Multi-step (wizard) configuration. When set, `nextStep()` validates the
   * current step's fields and only advances when they all pass. Absent = a
   * single-step form (the step methods become safe no-ops).
   */
  steps?: FormStep<V>[]
  onSubmit?: (values: V) => void | Promise<void>
}

export interface FormStore<V extends FormValues> {
  /** Underlying subscribable store — bridge with `useStore` / `useMachine`. */
  store: Store<FormState<V>>
  getState(): FormState<V>
  subscribe(listener: (state: FormState<V>) => void): () => void
  setFieldValue<K extends Key<V>>(name: K, value: V[K]): void
  setValues(values: Partial<V>): void
  /** Append `item` to an array field. */
  arrayPush<K extends ArrayKey<V>>(name: K, item: ArrayElement<V[K]>): void
  /** Insert `item` at `index` in an array field. */
  arrayInsert<K extends ArrayKey<V>>(name: K, index: number, item: ArrayElement<V[K]>): void
  /** Remove the element at `index` from an array field. */
  arrayRemove<K extends ArrayKey<V>>(name: K, index: number): void
  /** Swap two elements of an array field. */
  arraySwap<K extends ArrayKey<V>>(name: K, a: number, b: number): void
  /** Move an element of an array field from one index to another. */
  arrayMove<K extends ArrayKey<V>>(name: K, from: number, to: number): void
  setFieldTouched(name: Key<V>, touched?: boolean): void
  setFieldError(name: Key<V>, error: string | undefined): void
  setErrors(errors: FieldErrors<V>): void
  validateField(name: Key<V>): Promise<string | undefined>
  validateForm(): Promise<FieldErrors<V>>
  /** Validate just the fields of step `index` (default: the current step). */
  validateStep(index?: number): Promise<boolean>
  /** Number of configured steps (1 when no `steps` are set). */
  stepCount(): number
  /** Jump to a step by index (clamped to range). Does not validate. */
  goToStep(index: number): void
  /** Validate the current step; advance only if it passes. Returns whether it advanced. */
  nextStep(): Promise<boolean>
  /** Move to the previous step (no validation). */
  prevStep(): void
  handleSubmit(): Promise<void>
  reset(nextInitialValues?: V): void
  isValid(): boolean
}

export function createFormStore<V extends FormValues>(config: FormConfig<V>): FormStore<V> {
  const validators: FormValidators<V> = config.validators ?? {}
  const validateOnChange = config.validateOnChange ?? true
  const validateOnBlur = config.validateOnBlur ?? true

  let initialValues: V = { ...config.initialValues }

  const steps = config.steps ?? []

  const store = createStore<FormState<V>>({
    values: { ...config.initialValues },
    errors: {},
    touched: {},
    dirty: {},
    isSubmitting: false,
    isValidating: false,
    submitCount: 0,
    currentStep: 0,
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

  // ── Multi-step (wizard) ──────────────────────────────────────────────────
  const stepCount: FormStore<V>['stepCount'] = () => Math.max(1, steps.length)
  const clampStep = (i: number): number => Math.max(0, Math.min(i, stepCount() - 1))

  const validateStep: FormStore<V>['validateStep'] = async (index) => {
    const step = steps[index ?? store.getState().currentStep]
    if (!step) return true // no steps configured → nothing to block on
    const results = await Promise.all(step.fields.map((name) => validateField(name)))
    step.fields.forEach((name) => setFieldTouched(name, true))
    return results.every((e) => e === undefined)
  }

  const goToStep: FormStore<V>['goToStep'] = (index) => {
    store.setState((s) => ({ ...s, currentStep: clampStep(index) }))
  }

  const nextStep: FormStore<V>['nextStep'] = async () => {
    const ok = await validateStep()
    if (!ok) return false
    const cur = store.getState().currentStep
    if (cur >= stepCount() - 1) return false // already on the last step
    store.setState((s) => ({ ...s, currentStep: clampStep(cur + 1) }))
    return true
  }

  const prevStep: FormStore<V>['prevStep'] = () => {
    store.setState((s) => ({ ...s, currentStep: clampStep(s.currentStep - 1) }))
  }

  const dependencies: Partial<Record<Key<V>, Key<V>[]>> = config.dependencies ?? {}

  const setFieldValue: FormStore<V>['setFieldValue'] = (name, value) => {
    store.setState((s) => ({
      ...s,
      values: { ...s.values, [name]: value },
      dirty: { ...s.dirty, [name]: !Object.is(value, initialValues[name]) },
    }))
    if (validateOnChange) {
      void validateField(name)
      // Re-validate dependent fields (one level deep) so a cross-field rule
      // (e.g. confirmPassword depends on password) updates inline, not only on
      // submit. Only fields with a validator are re-run.
      for (const dep of dependencies[name] ?? []) {
        if (validators[dep]) void validateField(dep)
      }
    }
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

  // Array-field helpers. Each reads the current array, produces a new array
  // immutably, writes it back as a dirty value, and re-validates the field —
  // the per-framework `useFieldArray` bridges are thin wrappers over these.
  const updateArray = <K extends ArrayKey<V>>(
    name: K,
    fn: (arr: ArrayElement<V[K]>[]) => ArrayElement<V[K]>[],
  ): void => {
    const current = store.getState().values[name]
    const arr = Array.isArray(current) ? (current as ArrayElement<V[K]>[]) : []
    setFieldValue(name, fn([...arr]) as unknown as V[K])
  }

  const arrayPush: FormStore<V>['arrayPush'] = (name, item) =>
    updateArray(name, (arr) => {
      arr.push(item)
      return arr
    })
  const arrayInsert: FormStore<V>['arrayInsert'] = (name, index, item) =>
    updateArray(name, (arr) => {
      arr.splice(Math.max(0, Math.min(index, arr.length)), 0, item)
      return arr
    })
  const arrayRemove: FormStore<V>['arrayRemove'] = (name, index) =>
    updateArray(name, (arr) => {
      if (index >= 0 && index < arr.length) arr.splice(index, 1)
      return arr
    })
  const arraySwap: FormStore<V>['arraySwap'] = (name, a, b) =>
    updateArray(name, (arr) => {
      if (a >= 0 && a < arr.length && b >= 0 && b < arr.length) {
        const tmp = arr[a]!
        arr[a] = arr[b]!
        arr[b] = tmp
      }
      return arr
    })
  const arrayMove: FormStore<V>['arrayMove'] = (name, from, to) =>
    updateArray(name, (arr) => {
      if (from >= 0 && from < arr.length && to >= 0 && to < arr.length) {
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved!)
      }
      return arr
    })

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
      currentStep: 0,
    })
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    setFieldValue,
    setValues,
    arrayPush,
    arrayInsert,
    arrayRemove,
    arraySwap,
    arrayMove,
    setFieldTouched,
    setFieldError,
    setErrors,
    validateField,
    validateForm,
    validateStep,
    stepCount,
    goToStep,
    nextStep,
    prevStep,
    handleSubmit,
    reset,
    isValid: () => Object.keys(store.getState().errors).length === 0,
  }
}
