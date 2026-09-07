import { getByPath } from '../path'
import { createValidationCoordinator, type ValidationCoordinator } from './coordinator'
import type { FormValues, Validator, FormValidators, FieldErrors, Key } from './types'

/**
 * Per-field validation engine.
 *
 * The engine is a small compatibility facade over the shared form-validation
 * coordinator. It remains useful without a form store, while the coordinator
 * supplies the same lifecycle and stale-result rules to both consumers.
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
  cancel(): void
  destroy(): void
  readonly disposed: boolean
  /** Schedule a debounced validate-on-change. */
  scheduleValidate(name: string): void
  /** Same as scheduleValidate but accepts an explicit values snapshot. */
  scheduleValidateWith(name: string, values: V): void
}

/**
 * Create a standalone validation engine for forms.
 *
 * The public surface intentionally remains compatible with the original
 * engine. Lifecycle methods are direct coordinator pass-throughs and do not
 * expose revisions, run IDs, or cancellation errors.
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
  const runValidator = (
    name: string,
    values: V,
  ): string | undefined | Promise<string | undefined> => {
    const map = validators as Record<string, Validator<V> | undefined>
    // Validator maps are caller-supplied objects; inherited names such as
    // `toString` are not registered validators.
    if (!Object.prototype.hasOwnProperty.call(map, name)) return undefined
    const validator = map[name]
    if (!validator) return undefined
    return validator(getByPath(values, name) as V[Key<V>], values)
  }

  const coordinator: ValidationCoordinator<V> = createValidationCoordinator({
    validateOnChange,
    debounceMs,
    getValues,
    onFieldValidating: callbacks.onValidating,
    onFieldError: callbacks.onError,
  })

  return {
    validateField: async (name, values) => {
      const result = await coordinator.runField(name, values, runValidator)
      return result.status === 'current' ? result.error : undefined
    },
    validateForm: async (vals, values, config) => {
      const result = await coordinator.runForm(
        Object.keys(vals),
        values,
        runValidator,
        config?.validate,
      )
      return result.status === 'cancelled' || result.status === 'destroyed' ? {} : result.errors
    },
    isCurrent: coordinator.isCurrent,
    invalidateAll: coordinator.invalidateAll,
    cancel: coordinator.cancel,
    destroy: coordinator.destroy,
    get disposed() {
      return coordinator.disposed
    },
    scheduleValidate: (name) => coordinator.scheduleValidate(name, runValidator),
    scheduleValidateWith: (name, values) =>
      coordinator.scheduleValidateWith(name, values, runValidator),
  }
}
