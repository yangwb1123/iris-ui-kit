import { debounce } from '../data-view'
import { getByPath } from '../path'
import type { FormValues, Validator, FormValidators, FieldErrors, Key } from './types'

/**
 * Per-field validation engine.
 *
 * Manages monotonic per-field tokens (stale-result race protection),
 * debounced change validation, and the validator runner.
 *
 * @remarks
 * This engine is used internally by `createFormStore`. When you use
 * `createFormStore`, its `.validateField()`, `.validateForm()`, and
 * `validateOnChange` all delegate here. You normally **don't** need to
 * create one separately unless you're building a custom form pipeline.
 *
 * @see createValidationEngine
 */
export interface ValidationEngine<V extends FormValues> {
  validateField(name: string, values: V): Promise<string | undefined>
  validateForm(
    validators: FormValidators<V>,
    values: V,
    config?: { validate?: (values: V) => FieldErrors<V> | Promise<FieldErrors<V>> },
  ): Promise<FieldErrors<V>>
  isCurrent(name: string): boolean
  invalidateAll(): void
  /** Schedule a debounced validate-on-change. Returns the debounced function so
   *  the caller can tee it up with the current values at invocation time. */
  scheduleValidate(name: string): void
  /** Same as scheduleValidate but accepts an explicit values snapshot. */
  scheduleValidateWith(name: string, values: V): void
}

/**
 * Create a standalone validation engine for forms.
 *
 * This is the **same engine** used internally by `createFormStore`. Use it
 * directly when you need race-safe async validation **without** a full form
 * store — e.g., preview validation before submit, validate-on-interval, or
 * building a custom form engine.
 *
 * Each field uses a monotonic token: if a newer validation for the same field
 * starts before an older one completes, the older result is silently dropped.
 * This prevents stale async errors from "winning the race."
 *
 * @param validators - Per-field validator map. Each receives `(value, allValues)`.
 * @param validateOnChange - If `true`, `scheduleValidate` triggers validation.
 * @param debounceMs - Debounce window for `scheduleValidate` (0 = sync).
 * @param callbacks - Lifecycle hooks (`onValidating`, `onError`).
 * @param getValues - Snapshot function for debounced validation reads.
 *
 * @example
 * ```ts
 * const engine = createValidationEngine(
 *   { email: (v) => (v ? undefined : 'Required') },
 *   true,
 *   300,
 *   { onValidating: (n, on) => updateSpinner(n, on),
 *     onError: (n, err) => updateError(n, err) },
 *   () => getCurrentValues(),
 * )
 * const err = await engine.validateField('email', values)
 * ```
 */
export function createValidationEngine<V extends FormValues>(
  validators: FormValidators<V>,
  validateOnChange: boolean,
  debounceMs: number,
  callbacks: {
    onValidating: (name: string, on: boolean) => void
    onError: (name: string, error: string | undefined) => void
  },
  /** Called to get the current values snapshot. Used by the debounced path. */
  getValues: () => V,
): ValidationEngine<V> {
  const tokens = new Map<string, number>()
  const fieldDebouncers = new Map<string, { run: () => void; cancel: () => void }>()

  const nextToken = (name: string): number => {
    const t = (tokens.get(name) ?? 0) + 1
    tokens.set(name, t)
    return t
  }

  const isCurrent = (name: string, token: number): boolean => tokens.get(name) === token

  const toErrorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err)

  // NOTE: intentionally NOT try/caught here. `validateForm` (below) relies on
  // a throwing/rejecting validator propagating as a REJECTED promise — it
  // uses Promise.allSettled and silently drops a rejected entry (a
  // deliberate, tested "don't let one broken validator crash whole-form
  // validation" contract). Catching here would turn that rejection into a
  // resolved error string and surface it instead of swallowing it. The
  // single-field `validateField` below is where the stuck-flag fix belongs —
  // it catches its OWN await of this function.
  const runFieldValidator = async (name: string, values: V): Promise<string | undefined> => {
    const validator = validators[name as Key<V>] as Validator<V> | undefined
    if (!validator) return undefined
    return validator(getByPath(values, name) as V[Key<V>], values)
  }

  const validateField: ValidationEngine<V>['validateField'] = async (name, values) => {
    const token = nextToken(name)
    callbacks.onValidating(name, true)
    let error: string | undefined
    try {
      error = await runFieldValidator(name, values)
    } catch (err) {
      // A throwing/rejecting validator must not leave onValidating(name, true)
      // stuck forever for the SINGLE-FIELD path — surface it as the field's
      // error instead (validateForm's whole-form contract, above, is
      // deliberately different and untouched).
      error = toErrorMessage(err)
    }
    if (!isCurrent(name, token)) return undefined
    callbacks.onValidating(name, false)
    callbacks.onError(name, error)
    return error
  }

  const runPending = (name: string): void => {
    void validateField(name, getValues())
  }

  const scheduleValidate = (name: string): void => {
    if (!validateOnChange) return
    if (debounceMs <= 0) {
      void validateField(name, getValues())
      return
    }
    let entry = fieldDebouncers.get(name)
    if (!entry) {
      const debounced = debounce(() => runPending(name), debounceMs)
      entry = { run: debounced, cancel: debounced.cancel }
      fieldDebouncers.set(name, entry)
    }
    entry.run()
  }

  const scheduleValidateWith = (name: string, values: V): void => {
    if (!validateOnChange) return
    void validateField(name, values)
  }

  return {
    validateField,
    async validateForm(vals, values, config) {
      const names = Object.keys(vals) as Key<V>[]
      const tokenById = new Map<Key<V>, number>()
      for (const name of names) tokenById.set(name, nextToken(name))

      const results = await Promise.allSettled(
        names.map(async (name) => [name, await runFieldValidator(name, values)] as const),
      )
      const nextErrors: FieldErrors<V> = {}
      for (const result of results) {
        if (result.status === 'rejected') continue
        const [name, error] = result.value
        const token = tokenById.get(name)
        if (error && token !== undefined && isCurrent(name, token)) {
          nextErrors[name] = error
        }
      }
      if (config?.validate) {
        const formErrors = await config.validate(values)
        Object.assign(nextErrors, formErrors)
      }
      return nextErrors
    },
    isCurrent: (name) => isCurrent(name, tokens.get(name) ?? 0),
    invalidateAll: () => tokens.clear(),
    scheduleValidate,
    scheduleValidateWith,
  }
}
