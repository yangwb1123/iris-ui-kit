import { createStore, type Store } from './store'
import { debounce } from './data-view'
import {
  formatPath,
  getByPath,
  setByPath,
  rekeyByArrayMutation,
  type Path,
  type PathSegment,
} from './path'

// Re-export standalone form sub-modules.
// These are the same engines used internally by `createFormStore` —
// use them directly when you need validation / step navigation / value ops
// without the full form store lifecycle.
export { createValidationEngine, type ValidationEngine } from './form/validation'
export { createStepNavigation, type StepNavigation } from './form/steps'
export {
  createFieldValueOps,
  type FieldValueOps,
  insertItem,
  removeItem,
  swapItems,
  moveItem,
  insertRemap,
  removeRemap,
  swapRemap,
  moveRemap,
  rekeyMetadata,
} from './form/values'

/**
 * Framework-agnostic form engine. Owns value aggregation, dirty/touched
 * tracking, validation scheduling (sync + async, with stale-result race
 * protection), and the submit lifecycle — the hard parts of a form that have
 * nothing to do with any UI framework. The React (`useForm`/`useField`) and
 * Vue (`useForm` + provide/inject) adapters are thin bridges over the
 * `Store<FormState>` exposed here, exactly like every other Iris primitive.
 *
 * The per-field state maps (errors/touched/dirty/validating) are keyed by a
 * canonical PATH string (v3 R19): a flat top-level key is just a 1-segment path
 * (`formatPath(parsePath(key)) === key`), so every flat-key call stays 100%
 * back-compatible, while a nested key (`address.city`, `items[2].sku`) lands on
 * its own field. The value setters/getters and the schema validator understand
 * the FULL path, which is what unblocks array / sub-form field types.
 */

export type FormValues = Record<string, unknown>

type Key<V> = keyof V & string

/**
 * A field reference: a flat top-level key OR a nested path string
 * (`address.city`, `items[2].sku`) / a parsed segment array. Widening `Key<V>`
 * to also accept a `Path` keeps existing `keyof V` call-sites type-checking
 * while opening up nested binding. The string `(string & {})` member preserves
 * the literal-key autocomplete for `Key<V>`.
 */
export type FieldPath<V> = Key<V> | (string & {}) | readonly PathSegment[]

/** The canonical string key under which a field's per-field state is stored. */
const pathKey = (ref: FieldPath<unknown>): string => formatPath(ref as Path)

/** Keys of `V` whose value is an array (the targets of the `array*` helpers). */
export type ArrayKey<V> = { [K in Key<V>]: V[K] extends readonly unknown[] ? K : never }[Key<V>]
/** The element type of an array field value. */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never

export type FieldErrors<V extends FormValues> = Partial<Record<Key<V> | (string & {}), string>>
export type FieldFlags<V extends FormValues> = Partial<Record<Key<V> | (string & {}), boolean>>

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
   * Validate all fields on mount (initial render). Useful for edit forms where
   * the initial values come from an API — the user sees validation feedback
   * immediately without needing to interact with every field first.
   * Default `false` (no validation on mount).
   */
  validateOnMount?: boolean
  /**
   * Debounce the validate-on-change of each field by this many ms — so an async
   * validator (e.g. a username-availability check) isn't fired on every
   * keystroke. 0 / omitted validates immediately. Blur, submit, and explicit
   * `validateField` are never debounced.
   */
  validationDebounceMs?: number
  /**
   * Debounce individual `setFieldValue` calls by this many ms — useful when
   * the user types quickly and you want to batch store updates to avoid
   * excessive re-renders. 0 (default) writes every value immediately.
   * Unlike `validationDebounceMs` (which debounces only validation), this
   * debounces the actual value write to the store (subscribers only see the
   * latest value after the debounce interval). `setValues`, `array*` helpers,
   * and programmatic calls are NOT debounced.
   */
  setFieldValueDebounceMs?: number
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
  /**
   * Normalize incoming values on init + every `reset` — e.g. coerce a date
   * string to a `Date`, default nullish fields, or denormalize a nested shape
   * for editing. Runs before they become the form's (and `dirty`-baseline)
   * values. Pure: return the normalized values.
   */
  parse?: (values: V) => V
  /**
   * Normalize the values just before `onSubmit` — e.g. trim strings, format
   * dates, or re-nest. Does not touch the form state; only what `onSubmit`
   * receives. Pure: return the transformed values.
   */
  transform?: (values: V) => V
  /** Max undo history depth. Default 50. 0 disables undo. */
  maxHistory?: number
  onSubmit?: (values: V) => void | Promise<void>
}

export interface FormStore<V extends FormValues> {
  /** Underlying subscribable store — bridge with `useStore` / `useMachine`. */
  store: Store<FormState<V>>
  getState(): FormState<V>
  subscribe(listener: (state: FormState<V>) => void): () => void
  /**
   * Set a field's value. A flat top-level key is type-checked as `V[K]`; a
   * nested PATH (`address.city`, `items[2].sku`) is accepted too (value typed
   * loosely) and written with structural sharing along the touched path only.
   */
  setFieldValue<K extends Key<V>>(name: K, value: V[K]): void
  setFieldValue(path: FieldPath<V>, value: unknown): void
  /** Read a field's value by flat key or nested path. */
  getFieldValue(path: FieldPath<V>): unknown
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
  setFieldTouched(name: FieldPath<V>, touched?: boolean): void
  setFieldError(name: FieldPath<V>, error: string | undefined): void
  setErrors(errors: FieldErrors<V>): void
  validateField(name: FieldPath<V>): Promise<string | undefined>
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
  /** True when any field's value differs from its initial value. */
  isDirty(): boolean
  /** Names of fields whose value differs from initial. */
  getDirtyFields(): Key<V>[]
  /** Undo the last mutation. No-op when nothing to undo. */
  undo(): void
  /** Redo a previously undone mutation. No-op when nothing to redo. */
  redo(): void
  /** True when at least one undo snapshot exists. */
  canUndo(): boolean
  /** True when at least one redo snapshot exists. */
  canRedo(): boolean
  /**
   * Serialize form values + touched for draft persistence (localStorage etc).
   * Set `includeTouched: false` to skip touched in the snapshot. Pass
   * `exclude` to drop sensitive fields (passwords, tokens) from the
   * snapshot — persisting a draft to storage should not leak them.
   */
  serialize(opts?: { includeTouched?: boolean; exclude?: (keyof V)[] }): {
    values: Partial<V>
    touched?: FieldFlags<V>
  }
  /**
   * Hydrate form state from a serialized draft. Marks all hydrated fields as
   * dirty. Call after construction in the adapter's mount effect.
   */
  hydrate(draft: { values: Partial<V>; touched?: FieldFlags<V> }): void
}

export function createFormStore<V extends FormValues>(config: FormConfig<V>): FormStore<V> {
  const validators: FormValidators<V> = config.validators ?? {}
  const validateOnChange = config.validateOnChange ?? true
  const validateOnBlur = config.validateOnBlur ?? true
  const parse = config.parse ?? ((v: V) => v)
  const transform = config.transform ?? ((v: V) => v)

  let initialValues: V = parse({ ...config.initialValues })

  // Dev-mode warning: field keys containing dots or brackets will be interpreted
  // as nested paths by the form system. Use escapePathSegment() for literal dots.
  if (process.env.NODE_ENV === 'development') {
    const suspicious = Object.keys(initialValues).filter(
      (k) => k.includes('.') || k.includes('[') || k.includes(']'),
    )
    if (suspicious.length > 0) {
      console.warn(
        '[iris-ui] createFormStore: initialValues keys contain dots or brackets — ' +
          'these will be treated as nested paths, not literal field names. ' +
          'Use escapePathSegment() from @iris-ui/core/path for literal dots. ' +
          'Suspicious keys: ' +
          suspicious.join(', '),
      )
    }
  }

  const steps = config.steps ?? []

  const store = createStore<FormState<V>>({
    values: { ...initialValues },
    errors: {},
    touched: {},
    dirty: {},
    isSubmitting: false,
    isValidating: false,
    validating: {},
    submitCount: 0,
    currentStep: 0,
  })

  // Undo/redo history stack of JSON-serialized value snapshots.
  const maxHistory = config.maxHistory ?? 50
  const history: string[] = []
  let historyIdx = -1

  const saveSnapshot = (): void => {
    if (maxHistory <= 0) return
    let snapshot: string
    try {
      snapshot = JSON.stringify(store.getState().values)
    } catch {
      // Circular reference or a BigInt/function-bearing value — undo/redo for
      // this edit is skipped rather than crashing the form.
      return
    }
    history.splice(historyIdx + 1)
    if (history.length > 0 && history[history.length - 1] === snapshot) return
    history.push(snapshot)
    if (history.length > maxHistory) history.shift()
    historyIdx = history.length - 1
  }

  // Save the initial snapshot so undo from the first edit has a valid baseline.
  saveSnapshot()

  // Monotonic per-field token. A validation result is only applied if its
  // field's token is still the latest when it resolves — so a slow async
  // validator that lost a race can never overwrite a newer answer. Keyed by the
  // canonical path string (a flat key is its own canonical key).
  const tokens = new Map<string, number>()
  const nextToken = (name: string): number => {
    const t = (tokens.get(name) ?? 0) + 1
    tokens.set(name, t)
    return t
  }
  const isCurrent = (name: string, token: number): boolean => tokens.get(name) === token

  const writeError = (name: string, error: string | undefined): void => {
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

  // Per-field validators are keyed by the (top-level) field name. A nested path
  // has no per-field validator — its errors come from the schema-level
  // `validate` — so this returns undefined for it.
  const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err)

  /** Try to resolve a validator for `key`, falling back to array pattern matching. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolveValidator(
    key: string,
  ): ((value: unknown, values: V) => string | undefined) | undefined {
    // Direct lookup first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let v = (validators as any)[key]
    if (v) return v as (value: unknown, values: V) => string | undefined
    // Array pattern fallback: 'tags[0].name' → look for 'tags[].name'
    const arrRe = /^(\w+(?:\.\w+)*)\[(\d+)\]\.(.+)$/
    const m = key.match(arrRe)
    if (m) {
      const patternKey = `${m[1]}[].${m[3]}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      v = (validators as any)[patternKey]
    }
    return v as ((value: unknown, values: V) => string | undefined) | undefined
  }

  const runFieldValidator = async (key: string, values: V): Promise<string | undefined> => {
    const validator = resolveValidator(key)
    if (!validator) return undefined
    try {
      // No `await` here: `validator(...)` may return a plain value (a sync
      // validator) or a promise. Returning it directly — rather than awaiting
      // it first — preserves the original single-microtask resolution timing
      // for the common sync case; this try/catch only needs to guard against
      // a SYNCHRONOUS throw. An async (rejecting-promise) validator still
      // propagates as a rejection here — handled at the call sites below,
      // which is where the timing-insensitive cleanup (setValidating/
      // isValidating) actually needs the guarantee.
      return validator(getByPath(values, key) as V[Key<V>], values)
    } catch (err) {
      return toErrorMessage(err)
    }
  }

  const setValidating = (name: string, on: boolean): void => {
    store.setState((s) => ({ ...s, validating: { ...s.validating, [name]: on } }))
  }

  const validateField: FormStore<V>['validateField'] = async (ref) => {
    const name = pathKey(ref)
    const token = nextToken(name)
    setValidating(name, true)
    let error: string | undefined
    try {
      error = await runFieldValidator(name, store.getState().values)
    } catch (err) {
      // An async validator that rejects (rather than resolving to an error
      // string) must not leave `validating`/`isValidating` stuck true.
      error = toErrorMessage(err)
    }
    // A newer validation superseded this one — leave it to clear the flag.
    if (!isCurrent(name, token)) return store.getState().errors[name as Key<V>]
    setValidating(name, false)
    writeError(name, error)
    return error
  }

  // Validate on mount when configured — useful for edit forms where initial
  // values come from an API. Validates every field with a validator, then
  // touches them so errors are visible without user interaction.
  const validateOnMount = config.validateOnMount ?? false
  if (validateOnMount) {
    const mountNames = Object.keys(validators) as Key<V>[]
    if (mountNames.length > 0) {
      // Fire validators but don't block construction; touch fields on resolve.
      void Promise.all(mountNames.map((name) => validateField(name))).then(() => {
        store.setState((s) => {
          const touched: FieldFlags<V> = { ...s.touched }
          for (const name of mountNames) touched[name] = true
          return { ...s, touched }
        })
      })
    }
  }

  // Debounced per-field validate-on-change (one debouncer per field), so an
  // async validator isn't fired on every keystroke. Immediate when debounce is 0.
  const debounceMs = config.validationDebounceMs ?? 0
  const fieldDebouncers = new Map<string, () => void>()
  const scheduleValidate = (name: string): void => {
    if (debounceMs <= 0) {
      void validateField(name)
      return
    }
    let run = fieldDebouncers.get(name)
    if (!run) {
      run = debounce(() => void validateField(name), debounceMs)
      fieldDebouncers.set(name, run)
    }
    run()
  }

  const fieldNames = (): Key<V>[] => {
    const names = new Set<string>([...Object.keys(initialValues), ...Object.keys(validators)])
    return [...names] as Key<V>[]
  }

  const validateForm: FormStore<V>['validateForm'] = async () => {
    store.setState((s) => ({ ...s, isValidating: true }))
    try {
      const values = store.getState().values
      const baseNames = Object.keys(validators) as Key<V>[]

      // Expand array validator patterns: a key like 'tags[].name' is NOT
      // validated directly — it's expanded to 'tags[0].name', 'tags[1].name'
      // etc. based on current array lengths. Only the expanded indices are
      // validated. The pattern key itself is skipped.
      const expandedNames: Key<V>[] = []
      const arrRe = /^(\w+(?:\.\w+)*)\[\]\.(.+)$/
      for (const name of baseNames) {
        const m = name.match(arrRe)
        if (m) {
          const [, arrayPath, subField] = m
          const arr = getByPath(values, arrayPath)
          const len = Array.isArray(arr) ? arr.length : 0
          for (let i = 0; i < len; i++) {
            expandedNames.push(`${arrayPath}[${i}].${subField}` as Key<V>)
          }
          // Pattern key itself gets no direct token; skip it
          continue
        }
        expandedNames.push(name)
      }

      const names = expandedNames
      // Bump every field's token first so any in-flight single-field validation
      // is invalidated — this form pass becomes the authoritative answer.
      const tokenById = new Map<Key<V>, number>()
      // Track tokens for both expanded keys and their base patterns
      for (const name of baseNames) {
        const t = nextToken(name)
        // Skip pattern keys — they get no direct validation
        if (!arrRe.test(name)) {
          tokenById.set(name, t)
        }
      }
      // Also tokenize each expanded key individually
      for (const name of names) {
        if (!tokenById.has(name)) tokenById.set(name, nextToken(name))
      }

      // allSettled (not all): runFieldValidator already catches per-field
      // exceptions, but this stays defense-in-depth so ONE unexpected rejection
      // can never leave the others' results (or isValidating) unresolved.
      const settled = await Promise.allSettled(
        names.map(async (name) => [name, await runFieldValidator(name, values)] as const),
      )
      let nextErrors: FieldErrors<V> = {}
      for (const result of settled) {
        if (result.status === 'rejected') continue
        const [name, error] = result.value
        if (error && isCurrent(name, tokenById.get(name) as number)) nextErrors[name] = error
      }
      if (config.validate) {
        const formErrors = await config.validate(values)
        nextErrors = { ...nextErrors, ...formErrors }
      }
      store.setState((s) => ({ ...s, errors: nextErrors }))
      return nextErrors
    } finally {
      // Always clears, even if config.validate (or anything above) throws —
      // otherwise a throwing whole-form validator leaves isValidating stuck.
      store.setState((s) => ({ ...s, isValidating: false }))
    }
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
  const setFieldValueDebounceMs = config.setFieldValueDebounceMs ?? 0

  // Debounce buffer for setFieldValue: when debounce is active, writes are
  // buffered by field key and flushed asynchronously, so subscribers (UI
  // components) only re-render after the debounce interval. getFieldValue
  // reads from the buffer + falls through to the store.
  const valueBuffer = new Map<string, unknown>()
  const fieldFlushers = new Map<string, () => void>()
  const scheduleFlush = (key: string): void => {
    if (setFieldValueDebounceMs <= 0) return
    let flush = fieldFlushers.get(key)
    if (!flush) {
      flush = debounce(() => {
        const value = valueBuffer.get(key)
        valueBuffer.delete(key)
        if (value === undefined && !valueBuffer.has(key)) return
        // Write buffered value to the store
        store.setState((s) => ({
          ...s,
          values: setByPath(s.values, key, value),
          dirty: { ...s.dirty, [key]: !Object.is(value, getByPath(initialValues, key)) },
        }))
        saveSnapshot()
      }, setFieldValueDebounceMs)
      fieldFlushers.set(key, flush)
    }
    flush()
  }

  const setFieldValue: FormStore<V>['setFieldValue'] = (
    ref: FieldPath<V>,
    value: unknown,
  ): void => {
    const key = pathKey(ref)
    if (setFieldValueDebounceMs > 0) {
      // Debounced: buffer the value and schedule a store flush. getFieldValue
      // reads from the buffer so the form is internally consistent.
      valueBuffer.set(key, value)
      scheduleFlush(key)
      // Still validate on change, reading from the buffer for cross-field rules
      if (validateOnChange) {
        scheduleValidate(key)
        for (const dep of dependencies[key as Key<V>] ?? []) {
          if (validators[dep]) scheduleValidate(dep)
        }
      }
      return
    }
    // Immediate: write to the store directly (original behavior)
    store.setState((s) => ({
      ...s,
      // Structural-sharing set along the touched path only (a flat key reduces
      // to `{ ...values, [key]: value }`, so flat behavior is unchanged).
      values: setByPath(s.values, key, value),
      dirty: { ...s.dirty, [key]: !Object.is(value, getByPath(initialValues, key)) },
    }))
    saveSnapshot()
    if (validateOnChange) {
      scheduleValidate(key)
      // Re-validate dependent fields (one level deep) so a cross-field rule
      // (e.g. confirmPassword depends on password) updates inline, not only on
      // submit. Only fields with a validator are re-run.
      for (const dep of dependencies[key as Key<V>] ?? []) {
        if (validators[dep]) scheduleValidate(dep)
      }
    }
  }

  const getFieldValue: FormStore<V>['getFieldValue'] = (ref) => {
    const key = pathKey(ref)
    // Read from debounce buffer first (if a debounced write is pending)
    if (valueBuffer.has(key)) return valueBuffer.get(key)
    return getByPath(store.getState().values, ref as Path)
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
    saveSnapshot()
    if (validateOnChange) for (const key of keys) void validateField(key)
  }

  // Array-field helpers. Each reads the current array, produces a new array
  // immutably, writes it back as a dirty value, and re-validates the field —
  // the per-framework `useFieldArray` bridges are thin wrappers over these.
  //
  // `remap` re-keys the per-ELEMENT state (errors/touched/dirty/validating
  // stored under `name[i]…`) so a row's nested error/touched/dirty follows it
  // across insert/remove/move/swap (an insert at index 1 shifts items[1..]).
  // It maps a 0-based element index to its new index, or `null` to drop it.
  const rekeyElements = (prefix: string, remap: (index: number) => number | null): void => {
    store.setState((s) => ({
      ...s,
      errors: rekeyByArrayMutation(
        s.errors as Record<string, string>,
        prefix,
        remap,
      ) as FieldErrors<V>,
      touched: rekeyByArrayMutation(
        s.touched as Record<string, boolean>,
        prefix,
        remap,
      ) as FieldFlags<V>,
      dirty: rekeyByArrayMutation(
        s.dirty as Record<string, boolean>,
        prefix,
        remap,
      ) as FieldFlags<V>,
      validating: rekeyByArrayMutation(
        s.validating as Record<string, boolean>,
        prefix,
        remap,
      ) as FieldFlags<V>,
    }))
  }

  const updateArray = <K extends ArrayKey<V>>(
    name: K,
    fn: (arr: ArrayElement<V[K]>[]) => ArrayElement<V[K]>[],
    remap?: (index: number) => number | null,
  ): void => {
    const prefix = pathKey(name)
    if (remap) rekeyElements(prefix, remap)
    const current = store.getState().values[name]
    const arr = Array.isArray(current) ? (current as ArrayElement<V[K]>[]) : []
    setFieldValue(name, fn([...arr]) as unknown as V[K])
  }

  const arrayPush: FormStore<V>['arrayPush'] = (name, item) =>
    updateArray(name, (arr) => {
      arr.push(item)
      return arr
    })
  const arrayInsert: FormStore<V>['arrayInsert'] = (name, index, item) => {
    const current = store.getState().values[name]
    const len = Array.isArray(current) ? current.length : 0
    const at = Math.max(0, Math.min(index, len))
    updateArray(
      name,
      (arr) => {
        arr.splice(at, 0, item)
        return arr
      },
      (i) => (i >= at ? i + 1 : i), // shift element keys at/after the insertion up
    )
  }
  const arrayRemove: FormStore<V>['arrayRemove'] = (name, index) => {
    const current = store.getState().values[name]
    const len = Array.isArray(current) ? current.length : 0
    if (index < 0 || index >= len) return
    updateArray(
      name,
      (arr) => {
        arr.splice(index, 1)
        return arr
      },
      (i) => (i === index ? null : i > index ? i - 1 : i), // drop the removed row, shift the tail down
    )
  }
  const arraySwap: FormStore<V>['arraySwap'] = (name, a, b) => {
    const current = store.getState().values[name]
    const len = Array.isArray(current) ? current.length : 0
    if (a < 0 || a >= len || b < 0 || b >= len) return
    updateArray(
      name,
      (arr) => {
        const tmp = arr[a]!
        arr[a] = arr[b]!
        arr[b] = tmp
        return arr
      },
      (i) => (i === a ? b : i === b ? a : i),
    )
  }
  const arrayMove: FormStore<V>['arrayMove'] = (name, from, to) => {
    const current = store.getState().values[name]
    const len = Array.isArray(current) ? current.length : 0
    if (from < 0 || from >= len || to < 0 || to >= len) return
    updateArray(
      name,
      (arr) => {
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved!)
        return arr
      },
      (i) => {
        if (i === from) return to
        // Elements between from and to shift by one toward the vacated slot.
        if (from < to) return i > from && i <= to ? i - 1 : i
        return i >= to && i < from ? i + 1 : i
      },
    )
  }

  const setFieldTouched: FormStore<V>['setFieldTouched'] = (ref, touched = true) => {
    const key = pathKey(ref)
    store.setState((s) => ({ ...s, touched: { ...s.touched, [key]: touched } }))
    if (touched && validateOnBlur) void validateField(key)
  }

  const setFieldError: FormStore<V>['setFieldError'] = (ref, error) => {
    writeError(pathKey(ref), error)
  }

  const setErrors: FormStore<V>['setErrors'] = (errors) => {
    store.setState((s) => ({ ...s, errors: { ...errors } }))
  }

  const handleSubmit: FormStore<V>['handleSubmit'] = async () => {
    // Double-submit guard: a second call (double-click, re-fired keyboard
    // Enter) while a submit is already in flight is a no-op rather than
    // racing a second validate+submit pass against the first.
    if (store.getState().isSubmitting) return
    const allTouched: FieldFlags<V> = {}
    for (const name of fieldNames()) allTouched[name] = true
    store.setState((s) => ({
      ...s,
      submitCount: s.submitCount + 1,
      isSubmitting: true,
      touched: { ...s.touched, ...allTouched },
    }))
    try {
      const errors = await validateForm()
      if (Object.keys(errors).length > 0) return
      await config.onSubmit?.(transform(store.getState().values))
    } finally {
      // Always clears, even if validateForm() or onSubmit throws — otherwise
      // a throwing whole-form validator or submit handler leaves isSubmitting
      // (and the double-submit guard above) stuck forever.
      store.setState((s) => ({ ...s, isSubmitting: false }))
    }
  }

  const reset: FormStore<V>['reset'] = (nextInitialValues) => {
    if (nextInitialValues) initialValues = parse({ ...nextInitialValues })
    tokens.clear()
    // Also clear undo history on reset — new initial values, fresh timeline.
    history.length = 0
    historyIdx = -1
    store.setState({
      values: { ...initialValues },
      errors: {},
      touched: {},
      dirty: {},
      isSubmitting: false,
      isValidating: false,
      validating: {},
      submitCount: 0,
      currentStep: 0,
    })
    // Save the new initial snapshot.
    saveSnapshot()
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    setFieldValue,
    getFieldValue,
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
    /** True when any field's value differs from its initial value. */
    isDirty: () => {
      const s = store.getState()
      return Object.values(s.dirty).some(Boolean)
    },
    /** Names of fields whose value differs from initial. */
    getDirtyFields: () => {
      const s = store.getState()
      return (Object.keys(s.dirty) as Key<V>[]).filter((k) => s.dirty[k])
    },
    undo: () => {
      if (historyIdx <= 0) return
      historyIdx -= 1
      store.setState((s) => ({ ...s, values: JSON.parse(history[historyIdx]!) }))
    },
    redo: () => {
      if (historyIdx >= history.length - 1) return
      historyIdx += 1
      store.setState((s) => ({ ...s, values: JSON.parse(history[historyIdx]!) }))
    },
    canUndo: () => historyIdx > 0,
    canRedo: () => historyIdx < history.length - 1,
    /**
     * Serialize the form's values + touched set to a JSON-compatible object for
     * draft persistence (e.g. localStorage). Excludes errors (they are
     * re-derived on validation) and submission state. Omit `touched` to skip
     * the touched set (only values matter for a restored draft). Pass
     * `exclude` to drop sensitive fields (passwords, tokens) from the
     * snapshot before it is persisted.
     */
    serialize: (opts?: { includeTouched?: boolean; exclude?: (keyof V)[] }) => {
      const values: Partial<V> = { ...store.getState().values }
      for (const key of opts?.exclude ?? []) delete values[key]
      return {
        values,
        ...(opts?.includeTouched !== false ? { touched: { ...store.getState().touched } } : {}),
      }
    },
    /**
     * Hydrate form state from a serialized draft (the output of `serialize()`).
     * Sets values, touched, and marks all hydrated fields as dirty (since they
     * differ from `initialValues`). The caller is responsible for calling this
     * after construction (e.g. in the adapter's `useEffect`/`watch`).
     */
    hydrate: (draft: { values: Partial<V>; touched?: FieldFlags<V> }) => {
      const s = store.getState()
      const nextDirty: FieldFlags<V> = { ...s.dirty }
      const nextValues = { ...s.values }
      for (const key of Object.keys(draft.values) as Key<V>[]) {
        const v = draft.values[key]
        nextValues[key] = v as V[Key<V>]
        // Only mark dirty if the hydrated value differs from the initial
        if (!Object.is(v, initialValues[key])) nextDirty[key] = true
      }
      store.setState({
        ...s,
        values: nextValues,
        dirty: nextDirty,
        touched: draft.touched ? { ...s.touched, ...draft.touched } : s.touched,
      })
    },
  }
}
/**
 * Create a `beforeunload` guard that triggers when `isDirty` returns true.
 * SSR-safe: no-ops when `window` is not defined (Node.js/SSR).
 * Call `guard.attach()` to start listening and `guard.detach()` to clean up.
 */
export function createDirtyGuard(isDirty: () => boolean): {
  attach: () => void
  detach: () => void
} {
  const g =
    typeof globalThis !== 'undefined' ? (globalThis as unknown as Record<string, unknown>) : null
  const canListen = g !== null && typeof g.addEventListener === 'function'
  const handler = (event: Event): void => {
    if (isDirty()) {
      event.preventDefault()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(event as any).returnValue = ''
    }
  }
  return {
    attach: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (canListen) (g as any).addEventListener('beforeunload', handler)
    },
    detach: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (canListen) (g as any).removeEventListener('beforeunload', handler)
    },
  }
}
