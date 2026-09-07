import { createStore } from '../store'
import { debounce } from '../data-view'
import { getByPath, setByPath, type Path } from '../path'
import { createFormValidationPlan, runFormFieldValidator } from './array-validation'
import {
  createValidationCoordinator,
  type InternalFormResult,
  type ValidationCoordinator,
} from './coordinator'
import { createFormArrayOperations } from './arrays'
import { cloneFormDraftValue, hydrateFormDraft, serializeFormDraft } from './drafts'
import { createFormHistory } from './history'
import { createSubmissionController, type SubmissionController } from './submission'
import { createStepNavigation } from './steps'
import type {
  FieldFlags,
  FieldPath,
  FormConfig,
  FormState,
  FormStore,
  FormValues,
  Key,
  FormValidators,
} from './types'
import { pathKey } from './types'

/** @internal warn when initial values have keys that look like nested paths. */
function devWarnSuspiciousPaths<V extends FormValues>(values: V): void {
  if (process.env.NODE_ENV !== 'development') return
  const suspicious = Object.keys(values).filter(
    (key) => key.includes('.') || key.includes('[') || key.includes(']'),
  )
  if (suspicious.length === 0) return
  console.warn(
    '[iris-ui] createFormStore: initialValues keys contain dots or brackets — ' +
      'these will be treated as nested paths, not literal field names. ' +
      'Use escapePathSegment() from @iris-ui-kit/core/path for literal dots. Suspicious keys: ' +
      suspicious.join(', '),
  )
}

/** @internal fire validators on mount and touch fields on resolve. */
function triggerMountValidation<V extends FormValues>(
  validators: FormValidators<V>,
  validateField: (name: FieldPath<V>) => Promise<string | undefined>,
  setTouched: (field: string) => void,
  isEpochCurrent: (epoch: number) => boolean,
  epoch: number,
): void {
  const mountNames = Object.keys(validators) as Key<V>[]
  if (mountNames.length === 0) return
  let remaining = mountNames.length
  void Promise.all(
    mountNames.map((name) =>
      validateField(name).then(() => {
        remaining--
        if (remaining === 0 && isEpochCurrent(epoch)) {
          for (const field of mountNames) setTouched(field)
        }
      }),
    ),
  )
}

/** Create the framework-neutral form store consumed by all adapters. */
class FormStoreEngine<V extends FormValues> {
  readonly api: FormStore<V>

  constructor(config: FormConfig<V>) {
    const validators: FormValidators<V> = config.validators ?? {}
    const validateOnChange = config.validateOnChange ?? true
    const validateOnBlur = config.validateOnBlur ?? true
    const parse = config.parse ?? ((v: V) => v)
    const transform = config.transform ?? ((v: V) => v)

    let initialValues: V = parse({ ...config.initialValues })
    devWarnSuspiciousPaths(initialValues)
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

    const valueBuffer = new Map<string, { value: unknown; version: number }>()
    let nextBufferVersion = 0
    const readEffectiveValues = (): V => {
      let snapshot = store.getState().values
      for (const [key, pending] of valueBuffer) {
        snapshot = setByPath(snapshot, key, pending.value) as V
      }
      return snapshot
    }
    // Own plain snapshots before user validators/transforms run.
    const readValidationValues = (): V => cloneFormDraftValue(readEffectiveValues()) as V

    const writeError = (name: string, error: string | undefined): void => {
      store.setState((state) => {
        if (error) {
          if (state.errors[name] === error) return state
          return { ...state, errors: { ...state.errors, [name]: error } }
        }
        if (!(name in state.errors)) return state
        const errors = { ...state.errors }
        delete errors[name]
        return { ...state, errors }
      })
    }

    const runFieldValidator = (key: string, values: V): Promise<string | undefined> =>
      runFormFieldValidator(validators, key, values)

    const setValidating = (name: string, on: boolean): void => {
      store.setState((state) => ({
        ...state,
        validating: { ...state.validating, [name]: on },
      }))
    }
    const setFormValidating = (on: boolean): void => {
      store.setState((state) => ({ ...state, isValidating: on }))
    }

    const invalidateValues = (): void => {
      if (!coordinator.disposed) coordinator.invalidateValue()
    }
    const coordinator: ValidationCoordinator<V> = createValidationCoordinator<V>({
      validateOnChange,
      debounceMs: config.validationDebounceMs ?? 0,
      getValues: readValidationValues,
      onFieldValidating: setValidating,
      onFieldError: writeError,
      onFormValidating: setFormValidating,
    })

    const history = createFormHistory<V>({
      max: config.maxHistory ?? 50,
      read: () => store.getState().values,
      write: (values) => {
        if (coordinator.disposed) return
        store.setState((state) => ({ ...state, values }))
      },
      invalidate: invalidateValues,
    })
    history.save()

    const validateField: FormStore<V>['validateField'] = async (ref) => {
      const name = pathKey(ref)
      if (coordinator.disposed) return store.getState().errors[name as Key<V>]
      const result = await coordinator.runField(name, readValidationValues(), runFieldValidator)
      if (coordinator.isCurrentField(result)) return result.error
      return store.getState().errors[name as Key<V>]
    }

    const runFormValidation = async (values: V): Promise<InternalFormResult<V>> => {
      const { names } = createFormValidationPlan(values, validators)
      const result = await coordinator.runForm(names, values, runFieldValidator, config.validate)
      if (result.status !== 'current' || !coordinator.isCurrent(result)) return result

      const errors = { ...result.errors }
      for (const name of result.supersededFields ?? []) {
        const current = store.getState().errors
        if (!Object.prototype.hasOwnProperty.call(current, name)) continue
        Object.defineProperty(errors, name, {
          configurable: true,
          enumerable: true,
          value: current[name],
          writable: true,
        })
      }
      store.setState((state) => ({ ...state, errors }))
      return { ...result, errors }
    }

    const validateForm: FormStore<V>['validateForm'] = async () => {
      if (coordinator.disposed) return store.getState().errors
      const result = await runFormValidation(readValidationValues())
      if (result.status === 'current' && coordinator.isCurrent(result)) return result.errors
      return store.getState().errors
    }

    const scheduleValidate = (name: string): void => {
      coordinator.scheduleValidate(name, runFieldValidator)
    }

    const fieldNames = (): Key<V>[] => {
      const names = new Set<string>([...Object.keys(initialValues), ...Object.keys(validators)])
      return [...names] as Key<V>[]
    }

    if (config.validateOnMount) {
      const mountEpoch = coordinator.epoch()
      triggerMountValidation(
        validators,
        validateField,
        (name) => {
          store.setState((state) => ({
            ...state,
            touched: { ...state.touched, [name]: true },
          }))
        },
        coordinator.isEpochCurrent,
        mountEpoch,
      )
    }

    const dependencies: Partial<Record<Key<V>, Key<V>[]>> = config.dependencies ?? {}
    const setFieldValueDebounceMs = config.setFieldValueDebounceMs ?? 0
    const fieldFlushers = new Map<string, ((version: number) => void) & { cancel: () => void }>()

    const cancelValueDebouncers = (): void => {
      for (const flush of fieldFlushers.values()) flush.cancel()
      fieldFlushers.clear()
    }
    const discardBufferedKey = (key: string): void => {
      valueBuffer.delete(key)
      fieldFlushers.get(key)?.cancel()
      fieldFlushers.delete(key)
    }
    const discardAllBufferedValues = (): void => {
      cancelValueDebouncers()
      valueBuffer.clear()
    }

    const scheduleFlush = (key: string): void => {
      if (setFieldValueDebounceMs <= 0) return
      let flush = fieldFlushers.get(key)
      if (!flush) {
        flush = debounce((version: number) => {
          if (coordinator.disposed) return
          const pending = valueBuffer.get(key)
          if (!pending || pending.version !== version) return
          valueBuffer.delete(key)
          const value = pending.value
          store.setState((state) => ({
            ...state,
            values: setByPath(state.values, key, value),
            dirty: { ...state.dirty, [key]: !Object.is(value, getByPath(initialValues, key)) },
          }))
          history.save()
        }, setFieldValueDebounceMs)
        fieldFlushers.set(key, flush)
      }
      const pending = valueBuffer.get(key)
      if (pending) flush(pending.version)
    }

    const scheduleValueValidation = (key: string): void => {
      if (!validateOnChange) return
      scheduleValidate(key)
      for (const dep of dependencies[key as Key<V>] ?? []) {
        if (Object.prototype.hasOwnProperty.call(validators, dep)) scheduleValidate(dep)
      }
    }

    const setFieldValue: FormStore<V>['setFieldValue'] = (
      ref: FieldPath<V>,
      value: unknown,
    ): void => {
      if (coordinator.disposed) return
      const key = pathKey(ref)
      invalidateValues()
      if (setFieldValueDebounceMs > 0) {
        // Delete/reinsert so effective snapshots follow last-write order.
        valueBuffer.delete(key)
        valueBuffer.set(key, { value, version: ++nextBufferVersion })
        scheduleFlush(key)
        scheduleValueValidation(key)
        return
      }
      store.setState((state) => ({
        ...state,
        values: setByPath(state.values, key, value),
        dirty: { ...state.dirty, [key]: !Object.is(value, getByPath(initialValues, key)) },
      }))
      history.save()
      scheduleValueValidation(key)
    }

    const getFieldValue: FormStore<V>['getFieldValue'] = (ref) =>
      getByPath(readEffectiveValues(), pathKey(ref) as Path)

    const setValues: FormStore<V>['setValues'] = (values) => {
      if (coordinator.disposed) return
      const keys = Object.keys(values) as Key<V>[]
      for (const key of keys) discardBufferedKey(pathKey(key))
      invalidateValues()
      const baseValues = readEffectiveValues()
      store.setState((state) => {
        const nextValues = { ...baseValues }
        const nextDirty = { ...state.dirty }
        for (const key of keys) {
          const value = values[key]
          // Define data properties explicitly; `__proto__` must not invoke a prototype setter.
          Object.defineProperty(nextValues, key, { value, enumerable: true })
          Object.defineProperty(nextDirty, key, {
            value: !Object.is(value, initialValues[key]),
            enumerable: true,
          })
        }
        return { ...state, values: nextValues, dirty: nextDirty }
      })
      history.save()
      if (validateOnChange) for (const key of keys) void validateField(key)
    }

    const { arrayPush, arrayInsert, arrayRemove, arraySwap, arrayMove } =
      createFormArrayOperations<V>({
        readValues: readEffectiveValues,
        setFieldValue,
        updateState: (update) => {
          if (coordinator.disposed) return
          store.setState((state) => ({ ...state, ...update(state) }))
        },
        pathKey,
      })

    const setFieldTouched: FormStore<V>['setFieldTouched'] = (ref, touched = true) => {
      if (coordinator.disposed) return
      const key = pathKey(ref)
      store.setState((state) => ({
        ...state,
        touched: { ...state.touched, [key]: touched },
      }))
      if (touched && validateOnBlur) void validateField(key)
    }

    const rawStepNavigation = createStepNavigation(
      steps,
      () => store.getState().currentStep,
      (index) => {
        if (!coordinator.disposed) store.setState((state) => ({ ...state, currentStep: index }))
      },
      async (names) => Promise.all(names.map((name) => validateField(name))),
      (names) => names.forEach((name) => setFieldTouched(name, true)),
    )
    const validateStep: FormStore<V>['validateStep'] = (index) =>
      coordinator.disposed ? Promise.resolve(false) : rawStepNavigation.validateStep(index)
    const stepCount = rawStepNavigation.stepCount
    const goToStep: FormStore<V>['goToStep'] = (index) => {
      if (!coordinator.disposed) rawStepNavigation.goToStep(index)
    }
    const nextStep: FormStore<V>['nextStep'] = () =>
      coordinator.disposed ? Promise.resolve(false) : rawStepNavigation.nextStep()
    const prevStep: FormStore<V>['prevStep'] = () => {
      if (!coordinator.disposed) rawStepNavigation.prevStep()
    }

    const setFieldError: FormStore<V>['setFieldError'] = (ref, error) => {
      if (!coordinator.disposed) writeError(pathKey(ref), error)
    }
    const setErrors: FormStore<V>['setErrors'] = (errors) => {
      if (coordinator.disposed) return
      store.setState((state) => ({ ...state, errors: { ...errors } }))
    }

    const submission: SubmissionController = createSubmissionController<V>({
      coordinator,
      readValues: readValidationValues,
      runValidation: runFormValidation,
      isDisposed: () => coordinator.disposed,
      isSubmitting: () => store.getState().isSubmitting,
      startSubmission: () => {
        const allTouched = Object.fromEntries(
          fieldNames().map((name) => [name, true]),
        ) as FieldFlags<V>
        store.setState((state) => ({
          ...state,
          submitCount: state.submitCount + 1,
          isSubmitting: true,
          touched: { ...state.touched, ...allTouched },
        }))
      },
      setSubmitting: (on) => {
        if (on && coordinator.disposed) return
        store.setState((state) => ({ ...state, isSubmitting: on }))
      },
      transform,
      onSubmit: config.onSubmit,
    })

    const cancel = (): void => {
      if (coordinator.disposed) return
      submission.cancel()
      coordinator.cancel()
      discardAllBufferedValues()
    }
    const destroy = (): void => {
      if (coordinator.disposed) return
      submission.cancel()
      discardAllBufferedValues()
      coordinator.destroy()
    }

    const reset: FormStore<V>['reset'] = (nextInitialValues) => {
      if (coordinator.disposed) return
      cancel()
      if (nextInitialValues) initialValues = parse({ ...nextInitialValues })
      history.clear()
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
      history.save()
    }

    const hydrate: FormStore<V>['hydrate'] = (draft) => {
      if (coordinator.disposed) return
      cancel()
      const state = store.getState()
      const next = hydrateFormDraft(state, draft, initialValues)
      store.setState({
        ...state,
        values: next.values,
        dirty: next.dirty,
        touched: next.touched,
      })
    }

    const undo: FormStore<V>['undo'] = () => {
      if (coordinator.disposed || !history.canUndo()) return
      discardAllBufferedValues()
      history.undo()
    }
    const redo: FormStore<V>['redo'] = () => {
      if (coordinator.disposed || !history.canRedo()) return
      discardAllBufferedValues()
      history.redo()
    }
    const handleSubmit = submission.handleSubmit

    const api: FormStore<V> = {
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
      cancel,
      destroy,
      get disposed() {
        return coordinator.disposed
      },
      isValid: () => Object.keys(store.getState().errors).length === 0,
      isDirty: () => Object.values(store.getState().dirty).some(Boolean),
      getDirtyFields: () => {
        const state = store.getState()
        return (Object.keys(state.dirty) as Key<V>[]).filter((key) => state.dirty[key])
      },
      undo,
      redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      serialize: (opts) =>
        serializeFormDraft(readEffectiveValues(), store.getState().touched, opts),
      hydrate,
    }
    this.api = api
  }
}

export function createFormStore<V extends FormValues>(config: FormConfig<V>): FormStore<V> {
  return new FormStoreEngine(config).api
}
