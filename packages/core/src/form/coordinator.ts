import { debounce } from '../data-view'
import type { FieldErrors, FormValues } from './types'

/** @internal The reason a validation result is not allowed to write. */
export type RunStatus = 'current' | 'superseded' | 'cancelled' | 'destroyed'

/** @internal Result metadata shared by the store and standalone engine. */
export interface InternalFieldResult {
  status: RunStatus
  name: string
  runId: number
  revision: number
  epoch: number
  error: string | undefined
}

/** @internal A snapshot-safe result for one whole-form validation pass. */
export interface InternalFormResult<V extends FormValues> {
  status: RunStatus
  runId: number
  revision: number
  epoch: number
  snapshot: V
  errors: FieldErrors<V>
  /** Fields superseded by a newer direct validation during this pass. */
  supersededFields?: string[]
}

type FieldRunner<V extends FormValues> = (
  name: string,
  values: V,
) => string | undefined | Promise<string | undefined>

type FormValidator<V extends FormValues> = (values: V) => FieldErrors<V> | Promise<FieldErrors<V>>

export interface ValidationCoordinatorOptions<V extends FormValues> {
  validateOnChange: boolean
  debounceMs: number
  getValues: () => V
  onFieldValidating?: (name: string, on: boolean) => void
  onFieldError?: (name: string, error: string | undefined) => void
  onFormValidating?: (on: boolean) => void
}

/** @internal The framework-neutral lifecycle authority for form validation. */
export interface ValidationCoordinator<V extends FormValues> {
  readonly disposed: boolean
  revision(): number
  epoch(): number
  isEpochCurrent(epoch: number): boolean
  isCurrent(name: string): boolean
  isCurrentField(result: InternalFieldResult): boolean
  isCurrent(result: InternalFormResult<V>): boolean
  invalidateValue(): void
  invalidateAll(): void
  cancel(): void
  destroy(): void
  runField(name: string, values: V, runner: FieldRunner<V>): Promise<InternalFieldResult>
  runForm(
    names: readonly string[],
    values: V,
    runner: FieldRunner<V>,
    validate?: FormValidator<V>,
  ): Promise<InternalFormResult<V>>
  scheduleValidate(name: string, runner: FieldRunner<V>): void
  scheduleValidateWith(name: string, values: V, runner: FieldRunner<V>): void
}

interface FieldRun {
  name: string
  runId: number
  revision: number
  epoch: number
}

interface FormRun<V extends FormValues> {
  runId: number
  revision: number
  epoch: number
  snapshot: V
  fieldRunIds: Map<string, number>
}

interface DebouncedValidation {
  run: (epoch: number) => void
  cancel: () => void
}

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

function setOwnError(target: FieldErrors<never>, name: string, error: string): void {
  Object.defineProperty(target, name, {
    configurable: true,
    enumerable: true,
    value: error,
    writable: true,
  })
}

/**
 * Create the shared authority used by both createFormStore and
 * createValidationEngine. The coordinator never reads or writes framework
 * state; callbacks are the only bridge back to a consumer.
 */
export function createValidationCoordinator<V extends FormValues>(
  options: ValidationCoordinatorOptions<V>,
): ValidationCoordinator<V> {
  let valueRevision = 0
  let lifecycleEpoch = 0
  let nextFieldRunId = 0
  let nextFormRunId = 0
  let disposed = false

  const fieldRunIds = new Map<string, number>()
  const activeFields = new Map<string, FieldRun>()
  const validationDebouncers = new Map<string, DebouncedValidation>()
  let currentForm: FormRun<V> | null = null
  let formActive = false

  const isEpochCurrent = (epoch: number): boolean => !disposed && lifecycleEpoch === epoch
  const isFieldCurrent = (run: FieldRun): boolean =>
    isEpochCurrent(run.epoch) &&
    valueRevision === run.revision &&
    fieldRunIds.get(run.name) === run.runId
  const isFormCurrent = (run: FormRun<V>): boolean =>
    isEpochCurrent(run.epoch) && valueRevision === run.revision && currentForm === run

  const statusForField = (run: FieldRun): RunStatus => {
    if (disposed) return 'destroyed'
    if (run.epoch !== lifecycleEpoch) return 'cancelled'
    return isFieldCurrent(run) ? 'current' : 'superseded'
  }

  const statusForForm = (run: FormRun<V>): RunStatus => {
    if (disposed) return 'destroyed'
    if (run.epoch !== lifecycleEpoch) return 'cancelled'
    return isFormCurrent(run) ? 'current' : 'superseded'
  }

  const cancelDebouncers = (): void => {
    for (const entry of validationDebouncers.values()) entry.cancel()
    validationDebouncers.clear()
  }

  /** Clear active flags without changing committed errors or values. */
  const clearActiveRuns = (): void => {
    const hadActiveForm = formActive
    const fields = [...activeFields.values()]

    // Invalidate authority before callbacks run. A callback may synchronously
    // start a fresh validation, and that fresh run must not be cleared by the
    // remainder of this cancellation pass.
    formActive = false
    currentForm = null
    activeFields.clear()
    fieldRunIds.clear()

    if (hadActiveForm) options.onFormValidating?.(false)
    for (const run of fields) options.onFieldValidating?.(run.name, false)
  }

  const invalidateLifecycle = (terminal: boolean): void => {
    if (terminal) disposed = true
    lifecycleEpoch++
    cancelDebouncers()
    clearActiveRuns()
  }

  const runField = async (
    name: string,
    values: V,
    runner: FieldRunner<V>,
  ): Promise<InternalFieldResult> => {
    if (disposed) {
      return {
        status: 'destroyed',
        name,
        runId: 0,
        revision: valueRevision,
        epoch: lifecycleEpoch,
        error: undefined,
      }
    }

    const run: FieldRun = {
      name,
      runId: ++nextFieldRunId,
      revision: valueRevision,
      epoch: lifecycleEpoch,
    }
    fieldRunIds.set(name, run.runId)
    activeFields.set(name, run)
    options.onFieldValidating?.(name, true)
    // A state subscriber may synchronously cancel or destroy the form while
    // the validating flag is published. Do not invoke user code after that
    // re-entrant lifecycle change.
    if (!isFieldCurrent(run)) {
      return { ...run, status: statusForField(run), error: undefined }
    }

    let error: string | undefined
    try {
      error = await runner(name, values)
    } catch (reason) {
      error = toErrorMessage(reason)
    }

    const status = statusForField(run)
    if (status !== 'current') {
      return { ...run, status, error: undefined }
    }

    if (activeFields.get(name) === run) activeFields.delete(name)
    options.onFieldValidating?.(name, false)
    // Publishing the false flag is also re-entrant: a subscriber can write a
    // value, cancel, or start a newer validation before the error callback.
    // Re-check so an obsolete result cannot be committed after that callback.
    if (!isFieldCurrent(run)) {
      return { ...run, status: statusForField(run), error: undefined }
    }
    options.onFieldError?.(name, error)
    return { ...run, status, error }
  }

  const beginForm = (names: readonly string[], snapshot: V): FormRun<V> | null => {
    if (disposed) return null

    const fieldRunIdsForPass = new Map<string, number>()
    const run: FormRun<V> = {
      runId: ++nextFormRunId,
      revision: valueRevision,
      epoch: lifecycleEpoch,
      snapshot,
      fieldRunIds: fieldRunIdsForPass,
    }
    currentForm = run
    formActive = true

    // A form-wide pass owns the field tokens for the names it validates. An
    // already-running field pass must not be able to clear its flags later.
    for (const name of new Set(names)) {
      const active = activeFields.get(name)
      if (active) {
        options.onFieldValidating?.(name, false)
        activeFields.delete(name)
      }
      const fieldRunId = ++nextFieldRunId
      fieldRunIds.set(name, fieldRunId)
      fieldRunIdsForPass.set(name, fieldRunId)
    }
    options.onFormValidating?.(true)
    return run
  }

  const currentFieldErrors = (run: FormRun<V>, errors: FieldErrors<V>): FieldErrors<V> => {
    if (run.revision !== valueRevision || run.epoch !== lifecycleEpoch || disposed) return {}
    const current: FieldErrors<V> = {}
    for (const name of Object.keys(errors)) {
      if (run.fieldRunIds.get(name) === fieldRunIds.get(name)) {
        setOwnError(current as FieldErrors<never>, name, errors[name]!)
      }
    }
    return current
  }

  const runForm = async (
    names: readonly string[],
    values: V,
    runner: FieldRunner<V>,
    validate?: FormValidator<V>,
  ): Promise<InternalFormResult<V>> => {
    const run = beginForm(names, values)
    if (!run) {
      return {
        status: 'destroyed',
        runId: 0,
        revision: valueRevision,
        epoch: lifecycleEpoch,
        snapshot: values,
        errors: {},
      }
    }
    // beginForm publishes isValidating before returning. A subscriber may
    // synchronously cancel or destroy the form, in which case no validator or
    // form-level callback may run for this obsolete pass.
    if (!isFormCurrent(run)) {
      return {
        status: statusForForm(run),
        runId: run.runId,
        revision: run.revision,
        epoch: run.epoch,
        snapshot: run.snapshot,
        errors: {},
      }
    }

    const fieldErrors: FieldErrors<V> = {}
    let nextErrors: FieldErrors<V> = {}
    try {
      const uniqueNames = [...new Set(names)]
      // Avoid an unnecessary microtask for an empty field plan. Besides being
      // cheaper, this lets form-level validation begin at call time when there
      // are no field validators, while authority is still checked below.
      const results =
        uniqueNames.length === 0
          ? []
          : await Promise.allSettled(
              uniqueNames.map(async (name) => [name, await runner(name, values)] as const),
            )
      for (const result of results) {
        if (result.status === 'rejected') continue
        const [name, error] = result.value
        const fieldRunId = fieldRunIds.get(name)
        // A direct validateField started during this pass supersedes only that
        // field's entry; the other current field results remain useful.
        if (error && fieldRunId === run.fieldRunIds.get(name)) {
          setOwnError(fieldErrors as FieldErrors<never>, name, error)
        }
      }

      // Do not invoke user form validation once this pass has lost authority.
      if (!isFormCurrent(run)) {
        return {
          status: statusForForm(run),
          runId: run.runId,
          revision: run.revision,
          epoch: run.epoch,
          snapshot: run.snapshot,
          errors: currentFieldErrors(run, fieldErrors),
        }
      }

      if (validate) {
        let formErrors: FieldErrors<V>
        try {
          formErrors = (await validate(values)) ?? {}
        } catch (reason) {
          // Active form-level failures preserve the public rejection contract;
          // a late rejection from an obsolete pass is only a stale result.
          if (!isFormCurrent(run)) {
            return {
              status: statusForForm(run),
              runId: run.runId,
              revision: run.revision,
              epoch: run.epoch,
              snapshot: run.snapshot,
              errors: currentFieldErrors(run, fieldErrors),
            }
          }
          throw reason
        }
        if (!isFormCurrent(run)) {
          return {
            status: statusForForm(run),
            runId: run.runId,
            revision: run.revision,
            epoch: run.epoch,
            snapshot: run.snapshot,
            errors: currentFieldErrors(run, fieldErrors),
          }
        }
        nextErrors = { ...currentFieldErrors(run, fieldErrors), ...formErrors }
      }

      return {
        status: isFormCurrent(run) ? 'current' : statusForForm(run),
        runId: run.runId,
        revision: run.revision,
        epoch: run.epoch,
        snapshot: run.snapshot,
        errors: isFormCurrent(run)
          ? { ...currentFieldErrors(run, fieldErrors), ...nextErrors }
          : {},
        supersededFields: isFormCurrent(run)
          ? [...run.fieldRunIds.keys()].filter(
              (name) => fieldRunIds.get(name) !== run.fieldRunIds.get(name),
            )
          : undefined,
      }
    } finally {
      // A stale finally must never clear the current form's flag.
      if (formActive && currentForm === run && isFormCurrent(run)) {
        formActive = false
        options.onFormValidating?.(false)
      }
    }
  }

  const scheduleValidate = (name: string, runner: FieldRunner<V>): void => {
    if (!options.validateOnChange || disposed) return
    if (options.debounceMs <= 0) {
      void runField(name, options.getValues(), runner)
      return
    }

    let entry = validationDebouncers.get(name)
    if (!entry) {
      const debounced = debounce((scheduledEpoch: number) => {
        if (validationDebouncers.get(name) === entry) validationDebouncers.delete(name)
        if (!isEpochCurrent(scheduledEpoch)) return
        void runField(name, options.getValues(), runner)
      }, options.debounceMs)
      entry = { run: debounced, cancel: debounced.cancel }
      validationDebouncers.set(name, entry)
    }
    entry.run(lifecycleEpoch)
  }

  const scheduleValidateWith = (name: string, values: V, runner: FieldRunner<V>): void => {
    if (!options.validateOnChange || disposed) return
    void runField(name, values, runner)
  }

  return {
    get disposed() {
      return disposed
    },
    revision: () => valueRevision,
    epoch: () => lifecycleEpoch,
    isEpochCurrent,
    isCurrent: (value: string | InternalFormResult<V>) => {
      if (typeof value === 'string') return !disposed && fieldRunIds.has(value)
      return (
        value.status === 'current' &&
        !disposed &&
        value.epoch === lifecycleEpoch &&
        value.revision === valueRevision &&
        currentForm?.runId === value.runId
      )
    },
    isCurrentField: (result) => {
      if (result.status !== 'current') return false
      return (
        !disposed &&
        result.epoch === lifecycleEpoch &&
        result.revision === valueRevision &&
        fieldRunIds.get(result.name) === result.runId
      )
    },
    invalidateValue: () => {
      if (disposed) return
      valueRevision++
      clearActiveRuns()
    },
    invalidateAll: () => {
      if (disposed) return
      invalidateLifecycle(false)
    },
    cancel: () => {
      if (disposed) return
      invalidateLifecycle(false)
    },
    destroy: () => {
      if (disposed) return
      invalidateLifecycle(true)
    },
    runField,
    runForm,
    scheduleValidate,
    scheduleValidateWith,
  }
}
