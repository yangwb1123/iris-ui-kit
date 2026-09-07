import { describe, expect, it, vi } from 'vitest'
import { createFormStore, createValidationEngine, type FieldErrors } from '../../form'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('transactional form validation and submission', () => {
  it('revalidates a submit-time edit and submits the latest snapshot', async () => {
    const gates: Array<ReturnType<typeof deferred<string | undefined>>> = []
    const transform = vi.fn((values: { name: string }) => ({ ...values }))
    const onSubmit = vi.fn()
    const form = createFormStore({
      initialValues: { name: 'first' },
      validateOnChange: false,
      validators: {
        name: () => {
          const gate = deferred<string | undefined>()
          gates.push(gate)
          return gate.promise
        },
      },
      transform,
      onSubmit,
    })

    const submission = form.handleSubmit()
    expect(gates).toHaveLength(1)
    form.setFieldValue('name', 'latest')
    gates[0]!.resolve(undefined)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(gates).toHaveLength(2)
    gates[1]!.resolve(undefined)
    await submission

    expect(transform).toHaveBeenCalledWith({ name: 'latest' })
    expect(onSubmit).toHaveBeenCalledWith({ name: 'latest' })
    expect(form.getState().isSubmitting).toBe(false)
  })

  it('does not submit the old snapshot at the validation boundary', async () => {
    const gate = deferred<string | undefined>()
    const onSubmit = vi.fn()
    const form = createFormStore({
      initialValues: { name: 'first' },
      validateOnChange: false,
      validators: { name: () => gate.promise },
      onSubmit,
    })
    const submission = form.handleSubmit()
    form.setFieldValue('name', 'latest')
    gate.resolve(undefined)
    await submission
    expect(onSubmit).toHaveBeenCalledWith({ name: 'latest' })
    expect(onSubmit).not.toHaveBeenCalledWith({ name: 'first' })
    expect(form.getState().isSubmitting).toBe(false)
  })

  it('ignores an onSubmit rejection after cancellation', async () => {
    const gate = deferred<void>()
    const onSubmit = vi.fn(() => gate.promise)
    const form = createFormStore({ initialValues: { name: 'value' }, onSubmit })
    const submission = form.handleSubmit()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onSubmit).toHaveBeenCalledWith({ name: 'value' })
    form.cancel()
    gate.reject(new Error('late submit failure'))
    await expect(submission).resolves.toBeUndefined()
    expect(form.getState().isSubmitting).toBe(false)
  })

  it('keeps the newer form validation authoritative', async () => {
    const first = deferred<FieldErrors<{ name: string }>>()
    const second = deferred<FieldErrors<{ name: string }>>()
    let calls = 0
    const form = createFormStore({
      initialValues: { name: 'value' },
      validateOnChange: false,
      validate: () => (calls++ === 0 ? first.promise : second.promise),
    })

    const older = form.validateForm()
    const newer = form.validateForm()
    expect(form.getState().isValidating).toBe(true)
    first.resolve({ name: 'old' })
    await older
    expect(form.getState().isValidating).toBe(true)
    expect(form.getState().errors).toEqual({})
    second.resolve({ name: 'new' })
    await newer
    expect(form.getState().errors).toEqual({ name: 'new' })
    expect(form.getState().isValidating).toBe(false)
  })

  it('clears validation immediately when a value changes', async () => {
    const gate = deferred<string | undefined>()
    const form = createFormStore({
      initialValues: { name: 'value' },
      validateOnChange: false,
      validators: { name: () => gate.promise },
    })
    const validation = form.validateField('name')
    expect(form.getState().validating.name).toBe(true)
    form.setFieldValue('name', 'changed')
    expect(form.getState().validating.name).toBe(false)
    gate.resolve('late')
    await validation
    expect(form.getState().errors.name).toBeUndefined()
  })

  it('flushes an explicitly queued undefined value', () => {
    vi.useFakeTimers()
    const form = createFormStore({
      initialValues: { name: 'initial' },
      setFieldValueDebounceMs: 50,
      validateOnChange: false,
    })
    form.setFieldValue('name', undefined)
    vi.advanceTimersByTime(50)
    expect('name' in form.getState().values).toBe(true)
    expect(form.getState().values.name).toBeUndefined()
    expect(form.canUndo()).toBe(true)
    vi.useRealTimers()
  })

  it('cancels pending validation and value timers without a write', async () => {
    vi.useFakeTimers()
    const validator = vi.fn(() => 'error')
    const form = createFormStore({
      initialValues: { name: 'initial' },
      validationDebounceMs: 50,
      setFieldValueDebounceMs: 50,
      validators: { name: validator },
    })
    form.setFieldValue('name', 'pending')
    form.cancel()
    await vi.advanceTimersByTimeAsync(100)
    expect(validator).not.toHaveBeenCalled()
    expect(form.getState().values.name).toBe('initial')
    expect(form.canUndo()).toBe(false)
    expect(form.getState().isValidating).toBe(false)
    vi.useRealTimers()
  })

  it('cancel is reusable and destroy is terminal', async () => {
    const gate = deferred<string | undefined>()
    const validator = vi.fn(() => gate.promise)
    const form = createFormStore({
      initialValues: { name: 'value' },
      validateOnChange: false,
      validators: { name: validator },
    })
    const stale = form.validateField('name')
    form.cancel()
    gate.resolve('stale')
    await stale
    expect(form.disposed).toBe(false)
    expect(form.getState().errors).toEqual({})

    validator.mockImplementation(() => undefined)
    expect(await form.validateField('name')).toBeUndefined()
    form.destroy()
    form.destroy()
    expect(form.disposed).toBe(true)
    form.setFieldValue('name', 'ignored')
    form.setFieldError('name', 'ignored')
    form.reset({ name: 'ignored' })
    form.hydrate({ values: { name: 'ignored' } })
    await form.validateField('name')
    await form.validateForm()
    expect(validator).toHaveBeenCalledTimes(2)
    expect(form.getState().values.name).toBe('value')
    expect(form.getState().errors).toEqual({})
  })
})

describe('standalone validation lifecycle', () => {
  it('suppresses late results, then validates again after cancel', async () => {
    const gate = deferred<string | undefined>()
    const onError = vi.fn()
    const validator = vi.fn(() => gate.promise)
    const engine = createValidationEngine(
      { name: validator },
      false,
      0,
      { onValidating: vi.fn(), onError },
      () => ({ name: 'value' }),
    )
    const stale = engine.validateField('name', { name: 'old' })
    engine.cancel()
    gate.resolve('late')
    expect(await stale).toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
    expect(engine.disposed).toBe(false)
    validator.mockImplementation(() => undefined)

    const result = await engine.validateField('name', { name: 'new' })
    expect(result).toBeUndefined()
    engine.destroy()
    engine.destroy()
    expect(engine.disposed).toBe(true)
    expect(await engine.validateField('name', { name: 'ignored' })).toBeUndefined()
  })
})

describe('hydration dirty reconciliation', () => {
  it('reconciles nested leaves, arrays, omitted siblings, and Object.is values', () => {
    const form = createFormStore<{
      profile: { city: string; zip: string }
      items: { sku: string }[]
      nan: number
      signed: number
      untouched: string
    }>({
      initialValues: {
        profile: { city: 'Paris', zip: '75000' },
        items: [{ sku: 'a' }, { sku: 'b' }],
        nan: Number.NaN,
        signed: 0,
        untouched: 'initial',
      },
      validateOnChange: false,
    })
    form.setFieldValue('profile.city', 'London')
    form.setFieldValue('profile.zip', '10000')
    form.setFieldValue('items[0].sku', 'x')
    form.setFieldValue('items[1].sku', 'y')
    form.setFieldValue('nan', 1)
    form.setFieldValue('signed', -0)

    form.hydrate({
      values: {
        profile: { city: 'Paris', zip: '10000' },
        items: [{ sku: 'a' }],
        nan: Number.NaN,
        signed: -0,
      },
    })

    const dirty = form.getState().dirty
    expect(dirty['profile.city']).toBeUndefined()
    expect(dirty['profile.zip']).toBe(true)
    expect(dirty['items[0].sku']).toBeUndefined()
    expect(dirty['items[1].sku']).toBeUndefined()
    expect(dirty.items).toBe(true)
    expect(dirty.nan).toBeUndefined()
    expect(dirty.signed).toBe(true)
    expect(dirty.untouched).toBeUndefined()
    expect(form.getState().values.items).toEqual([{ sku: 'a' }])
  })

  it('keeps a dirty sibling when hydration supplies a nested path', () => {
    const form = createFormStore({
      initialValues: { profile: { city: 'Paris', zip: '75000' } },
      validateOnChange: false,
    })
    form.setFieldValue('profile.city', 'London')
    form.setFieldValue('profile.zip', '10000')
    form.hydrate({ values: { 'profile.city': 'Paris' } as never })
    expect(form.getState().dirty['profile.city']).toBeUndefined()
    expect(form.getState().dirty['profile.zip']).toBe(true)
    expect(form.getFieldValue('profile.zip')).toBe('10000')
  })
})
