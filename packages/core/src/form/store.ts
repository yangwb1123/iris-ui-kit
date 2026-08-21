import { createStore } from '../store'
import { debounce } from '../data-view'
import { getByPath, setByPath, type Path } from '../path'
import { createFormValidationPlan, runFormFieldValidator } from './array-validation'
import { createFormArrayOperations } from './arrays'
import { hydrateFormDraft, serializeFormDraft } from './drafts'
import { createFormHistory } from './history'
import { createStepNavigation } from './steps'
import type {
  FieldErrors,
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
): void {
  const mountNames = Object.keys(validators) as Key<V>[]
  if (mountNames.length === 0) return
  void Promise.all(mountNames.map((name) => validateField(name))).then(() => {
    for (const name of mountNames) setTouched(name)
  })
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

    // Monotonic tokens prevent stale async field and form-level validation from
    // writing over newer values or errors.
    const tokens = new Map<string, number>()
    const nextToken = (name: string): number => {
      const token = (tokens.get(name) ?? 0) + 1
      tokens.set(name, token)
      return token
    }
    const isCurrent = (name: string, token: number): boolean => tokens.get(name) === token
    let formToken = 0
    const bumpFormToken = (): number => ++formToken
    const isFormCurrent = (token: number): boolean => formToken === token

    const history = createFormHistory<V>({
      max: config.maxHistory ?? 50,
      read: () => store.getState().values,
      write: (values) => {
        store.setState((state) => ({ ...state, values }))
      },
      invalidate: () => bumpFormToken(),
    })
    history.save()

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

    const toErrorMessage = (error: unknown): string =>
      error instanceof Error ? error.message : String(error)
    const runFieldValidator = (key: string, values: V): Promise<string | undefined> =>
      runFormFieldValidator(validators, key, values)

    const setValidating = (name: string, on: boolean): void => {
      store.setState((state) => ({
        ...state,
        validating: { ...state.validating, [name]: on },
      }))
    }

    const validateField: FormStore<V>['validateField'] = async (ref) => {
      const name = pathKey(ref)
      const token = nextToken(name)
      setValidating(name, true)
      let error: string | undefined
      try {
        error = await runFieldValidator(name, store.getState().values)
      } catch (reason) {
        error = toErrorMessage(reason)
      }
      if (!isCurrent(name, token)) return store.getState().errors[name as Key<V>]
      setValidating(name, false)
      writeError(name, error)
      return error
    }

    if (config.validateOnMount) {
      triggerMountValidation(validators, validateField, (name) => {
        store.setState((state) => ({
          ...state,
          touched: { ...state.touched, [name]: true },
        }))
      })
    }

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
      store.setState((state) => ({ ...state, isValidating: true }))
      try {
        const formTokenAtStart = bumpFormToken()
        const values = store.getState().values
        const { names, tokenById } = createFormValidationPlan(values, validators, nextToken)
        const settled = await Promise.allSettled(
          names.map(async (name) => [name, await runFieldValidator(name, values)] as const),
        )
        let nextErrors: FieldErrors<V> = {}
        for (const result of settled) {
          if (result.status === 'rejected') continue
          const [name, error] = result.value
          if (error && isCurrent(name, tokenById.get(name) as number)) {
            ;(nextErrors as Record<string, string>)[name] = error
          }
        }
        if (config.validate) {
          const formErrors = await config.validate(values)
          nextErrors = { ...nextErrors, ...formErrors }
        }
        if (!isFormCurrent(formTokenAtStart)) return store.getState().errors
        store.setState((state) => ({ ...state, errors: nextErrors }))
        return nextErrors
      } finally {
        store.setState((state) => ({ ...state, isValidating: false }))
      }
    }

    const dependencies: Partial<Record<Key<V>, Key<V>[]>> = config.dependencies ?? {}
    const setFieldValueDebounceMs = config.setFieldValueDebounceMs ?? 0
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
          bumpFormToken()
          store.setState((state) => ({
            ...state,
            values: setByPath(state.values, key, value),
            dirty: { ...state.dirty, [key]: !Object.is(value, getByPath(initialValues, key)) },
          }))
          history.save()
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
        valueBuffer.set(key, value)
        scheduleFlush(key)
        if (validateOnChange) {
          scheduleValidate(key)
          for (const dep of dependencies[key as Key<V>] ?? []) {
            if (validators[dep]) scheduleValidate(dep)
          }
        }
        return
      }
      bumpFormToken()
      store.setState((state) => ({
        ...state,
        values: setByPath(state.values, key, value),
        dirty: { ...state.dirty, [key]: !Object.is(value, getByPath(initialValues, key)) },
      }))
      history.save()
      if (validateOnChange) {
        scheduleValidate(key)
        for (const dep of dependencies[key as Key<V>] ?? []) {
          if (validators[dep]) scheduleValidate(dep)
        }
      }
    }

    const getFieldValue: FormStore<V>['getFieldValue'] = (ref) => {
      const key = pathKey(ref)
      if (valueBuffer.has(key)) return valueBuffer.get(key)
      return getByPath(store.getState().values, ref as Path)
    }

    const setValues: FormStore<V>['setValues'] = (values) => {
      const keys = Object.keys(values) as Key<V>[]
      bumpFormToken()
      store.setState((state) => {
        const nextValues = { ...state.values }
        const nextDirty = { ...state.dirty }
        for (const key of keys) {
          const value = values[key]
          nextValues[key] = value as V[Key<V>]
          nextDirty[key] = !Object.is(value, initialValues[key])
        }
        return { ...state, values: nextValues, dirty: nextDirty }
      })
      history.save()
      if (validateOnChange) for (const key of keys) void validateField(key)
    }

    const { arrayPush, arrayInsert, arrayRemove, arraySwap, arrayMove } =
      createFormArrayOperations<V>({
        readValues: () => store.getState().values,
        setFieldValue,
        updateState: (update) => store.setState((state) => ({ ...state, ...update(state) })),
        pathKey,
      })

    const setFieldTouched: FormStore<V>['setFieldTouched'] = (ref, touched = true) => {
      const key = pathKey(ref)
      store.setState((state) => ({
        ...state,
        touched: { ...state.touched, [key]: touched },
      }))
      if (touched && validateOnBlur) void validateField(key)
    }

    const { validateStep, stepCount, goToStep, nextStep, prevStep } = createStepNavigation(
      steps,
      () => store.getState().currentStep,
      (index) => store.setState((state) => ({ ...state, currentStep: index })),
      async (names) => Promise.all(names.map((name) => validateField(name))),
      (names) => names.forEach((name) => setFieldTouched(name, true)),
    )
    const setFieldError: FormStore<V>['setFieldError'] = (ref, error) => {
      writeError(pathKey(ref), error)
    }
    const setErrors: FormStore<V>['setErrors'] = (errors) => {
      store.setState((state) => ({ ...state, errors: { ...errors } }))
    }

    const handleSubmit: FormStore<V>['handleSubmit'] = async () => {
      if (store.getState().isSubmitting) return
      const allTouched: FieldFlags<V> = {}
      for (const name of fieldNames()) allTouched[name] = true
      store.setState((state) => ({
        ...state,
        submitCount: state.submitCount + 1,
        isSubmitting: true,
        touched: { ...state.touched, ...allTouched },
      }))
      try {
        const errors = await validateForm()
        if (Object.keys(errors).length > 0) return
        await config.onSubmit?.(transform(store.getState().values))
      } finally {
        store.setState((state) => ({ ...state, isSubmitting: false }))
      }
    }

    const reset: FormStore<V>['reset'] = (nextInitialValues) => {
      if (nextInitialValues) initialValues = parse({ ...nextInitialValues })
      tokens.clear()
      bumpFormToken()
      history.clear()
      valueBuffer.clear()
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
      isValid: () => Object.keys(store.getState().errors).length === 0,
      isDirty: () => Object.values(store.getState().dirty).some(Boolean),
      getDirtyFields: () => {
        const state = store.getState()
        return (Object.keys(state.dirty) as Key<V>[]).filter((key) => state.dirty[key])
      },
      undo: history.undo,
      redo: history.redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      serialize: (opts) =>
        serializeFormDraft(store.getState().values, store.getState().touched, opts),
      hydrate: (draft) => {
        const state = store.getState()
        const next = hydrateFormDraft(state, draft, initialValues)
        bumpFormToken()
        store.setState({
          ...state,
          values: next.values,
          dirty: next.dirty,
          touched: next.touched,
        })
      },
    }
    this.api = api
  }
}

export function createFormStore<V extends FormValues>(config: FormConfig<V>): FormStore<V> {
  return new FormStoreEngine(config).api
}
