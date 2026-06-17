import { debounce } from '../data-view'
import { getByPath } from '../path'
import type { FormValues, Validator, FormValidators, FieldErrors, Key } from './types'

/**
 * Per-field validation engine.
 *
 * Manages monotonic per-field tokens (stale-result race protection),
 * debounced change validation, and the validator runner.
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

  const runFieldValidator = async (name: string, values: V): Promise<string | undefined> => {
    const validator = validators[name as Key<V>] as Validator<V> | undefined
    if (!validator) return undefined
    return validator(getByPath(values, name) as V[Key<V>], values)
  }

  const validateField: ValidationEngine<V>['validateField'] = async (name, values) => {
    const token = nextToken(name)
    callbacks.onValidating(name, true)
    const error = await runFieldValidator(name, values)
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
