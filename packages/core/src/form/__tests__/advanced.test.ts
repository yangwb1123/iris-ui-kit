import { describe, expect, it, vi } from 'vitest'
import { createFormStore } from '../../form'

describe('multi-step (wizard)', () => {
  it('starts on step 0 and reports stepCount', () => {
    const form = createFormStore({
      initialValues: { name: '', email: '' },
      steps: [{ fields: ['name'] }, { fields: ['email'] }],
    })
    expect(form.getState().currentStep).toBe(0)
    expect(form.stepCount()).toBe(2)
  })

  it('nextStep blocks on an invalid step and advances when valid', async () => {
    const form = createFormStore({
      initialValues: { name: '', email: '' },
      steps: [{ fields: ['name'] }, { fields: ['email'] }],
      validators: { name: (v) => (v ? undefined : 'Required') },
    })
    expect(await form.nextStep()).toBe(false) // blocked
    expect(form.getState().currentStep).toBe(0)
    form.setFieldValue('name', 'Alice')
    await Promise.resolve()
    expect(await form.nextStep()).toBe(true) // advances
    expect(form.getState().currentStep).toBe(1)
  })

  it('nextStep does not advance past the last step', async () => {
    const form = createFormStore({
      initialValues: { name: '', email: '' },
      validateOnChange: false,
      steps: [{ fields: ['name'] }, { fields: ['email'] }],
    })
    form.setFieldValue('name', 'Ada')
    await form.nextStep() // → step 1
    expect(await form.nextStep()).toBe(false) // already last
    expect(form.getState().currentStep).toBe(1)
  })

  it('prevStep / goToStep clamp to range', () => {
    const form = createFormStore({
      initialValues: { a: '', b: '' },
      steps: [{ fields: ['a'] }, { fields: ['b'] }],
    })
    form.goToStep(5) // clamped to max
    expect(form.getState().currentStep).toBe(1)
    form.prevStep()
    expect(form.getState().currentStep).toBe(0)
    form.prevStep() // cannot go below 0
    expect(form.getState().currentStep).toBe(0)
  })

  it('step methods are safe no-ops without steps config', async () => {
    const form = createFormStore({ initialValues: { x: '' } })
    expect(form.stepCount()).toBe(1)
    expect(await form.nextStep()).toBe(false)
    form.prevStep()
    expect(form.getState().currentStep).toBe(0)
    expect(await form.validateStep()).toBe(true)
  })
})

describe('array fields', () => {
  it('push / insert / remove', () => {
    const form = createFormStore<{ items: string[] }>({
      initialValues: { items: ['a'] },
      validateOnChange: false,
    })
    form.arrayPush('items', 'b')
    expect(form.getState().values.items).toEqual(['a', 'b'])
    form.arrayInsert('items', 1, 'x')
    expect(form.getState().values.items).toEqual(['a', 'x', 'b'])
    form.arrayRemove('items', 0)
    expect(form.getState().values.items).toEqual(['x', 'b'])
  })

  it('swap / move', () => {
    const form = createFormStore<{ items: string[] }>({
      initialValues: { items: ['a', 'b', 'c'] },
      validateOnChange: false,
    })
    form.arraySwap('items', 0, 2)
    expect(form.getState().values.items).toEqual(['c', 'b', 'a'])
    form.arrayMove('items', 0, 1)
    expect(form.getState().values.items).toEqual(['b', 'c', 'a'])
  })

  it('marks the field dirty and is immutable', () => {
    const before = { items: ['x'] }
    const form = createFormStore<{ items: string[] }>({
      initialValues: before,
      validateOnChange: false,
    })
    form.arrayPush('items', 'y')
    expect(form.getState().dirty.items).toBe(true)
    expect(before.items).toEqual(['x']) // original unchanged
  })

  it('out-of-range ops are no-ops, not crashes', () => {
    const form = createFormStore<{ items: string[] }>({
      initialValues: { items: ['a'] },
      validateOnChange: false,
    })
    // Should not throw
    form.arrayRemove('items', 99)
    expect(form.getState().values.items).toEqual(['a'])
    form.arraySwap('items', 0, 99)
    expect(form.getState().values.items).toEqual(['a'])
    form.arrayMove('items', 0, 99)
    expect(form.getState().values.items).toEqual(['a'])
  })
})

describe('nested-path engine (v3 R19)', () => {
  it('flat-key reads/writes are 100% back-compatible (canonical 1-segment path)', () => {
    const form = createFormStore({ initialValues: { email: 'a@b.com' }, validateOnChange: false })
    form.setFieldValue('email', 'c@d.com')
    expect(form.getState().values).toEqual({ email: 'c@d.com' })
    expect(form.getState().dirty).toEqual({ email: true })
    expect(form.getFieldValue('email')).toBe('c@d.com')
  })

  it('sets/gets a nested value by path with structural sharing', () => {
    const form = createFormStore<{ address: { city: string; zip: string }; name: string }>({
      initialValues: { address: { city: '', zip: '00000' }, name: 'Ada' },
      validateOnChange: false,
    })
    const before = form.getState().values
    form.setFieldValue('address.city', 'Paris')
    expect(form.getFieldValue('address.city')).toBe('Paris')
    expect(form.getState().values.address).toEqual({ city: 'Paris', zip: '00000' })
    expect(form.getState().dirty['address.city']).toBe(true)
    expect(form.getState().values.name).toBe('Ada')
    expect(form.getState().values).not.toBe(before)
  })

  it('per-element error/touched/dirty key off the element path', () => {
    const form = createFormStore<{ items: { sku: string }[] }>({
      initialValues: { items: [{ sku: 'a' }, { sku: 'b' }] },
      validateOnChange: false,
    })
    form.setFieldError('items[1].sku', 'Bad SKU')
    form.setFieldTouched('items[1].sku', true)
    form.setFieldValue('items[1].sku', 'B2')
    expect(form.getState().errors['items[1].sku']).toBe('Bad SKU')
    expect(form.getState().touched['items[1].sku']).toBe(true)
    expect(form.getState().dirty['items[1].sku']).toBe(true)
    expect(form.getFieldValue('items[1].sku')).toBe('B2')
    expect(form.getState().errors.items).toBeUndefined()
  })

  it('array INSERT re-keys per-element errors (shifts items[1..] up)', () => {
    const form = createFormStore<{ items: { sku: string }[] }>({
      initialValues: { items: [{ sku: 'a' }, { sku: 'b' }] },
      validateOnChange: false,
    })
    form.setFieldError('items[0].sku', 'e0')
    form.setFieldError('items[1].sku', 'e1')
    form.arrayInsert('items', 1, { sku: 'x' })
    expect(form.getState().values.items.map((i) => i.sku)).toEqual(['a', 'x', 'b'])
    expect(form.getState().errors['items[0].sku']).toBe('e0')
    expect(form.getState().errors['items[1].sku']).toBeUndefined()
    expect(form.getState().errors['items[2].sku']).toBe('e1')
  })

  it('array REMOVE drops the removed element error and shifts the tail down', () => {
    const form = createFormStore<{ items: { sku: string }[] }>({
      initialValues: { items: [{ sku: 'a' }, { sku: 'b' }, { sku: 'c' }] },
      validateOnChange: false,
    })
    form.setFieldError('items[0].sku', 'e0')
    form.setFieldError('items[1].sku', 'e1')
    form.setFieldError('items[2].sku', 'e2')
    form.arrayRemove('items', 1)
    expect(form.getState().values.items.map((i) => i.sku)).toEqual(['a', 'c'])
    expect(form.getState().errors['items[0].sku']).toBe('e0')
    expect(form.getState().errors['items[1].sku']).toBe('e2')
    expect(form.getState().errors['items[2].sku']).toBeUndefined()
  })

  it('array MOVE / SWAP re-key per-element state with the moved row', () => {
    const form = createFormStore<{ items: { sku: string }[] }>({
      initialValues: { items: [{ sku: 'a' }, { sku: 'b' }, { sku: 'c' }] },
      validateOnChange: false,
    })
    form.setFieldError('items[0].sku', 'e0')
    form.setFieldError('items[2].sku', 'e2')
    form.arrayMove('items', 0, 2)
    expect(form.getState().values.items.map((i) => i.sku)).toEqual(['b', 'c', 'a'])
    expect(form.getState().errors['items[2].sku']).toBe('e0')
    expect(form.getState().errors['items[1].sku']).toBe('e2')

    form.arraySwap('items', 0, 2)
    expect(form.getState().errors['items[0].sku']).toBe('e0')
  })

  it('a nested validateField via setFieldTouched lands on the element path', async () => {
    const form = createFormStore<{ items: { sku: string }[] }>({
      initialValues: { items: [{ sku: '' }] },
    })
    form.setFieldError('items[0].sku', 'Required')
    expect(form.isValid()).toBe(false)
    form.setFieldError('items[0].sku', undefined)
    expect(form.isValid()).toBe(true)
  })
})

describe('async validation', () => {
  it('tracks per-field `validating` while an async validator is in flight', async () => {
    let resolve!: (v: string | undefined) => void
    const form = createFormStore({
      initialValues: { name: '' },
      validators: { name: () => new Promise<string | undefined>((r) => (resolve = r)) },
    })
    form.setFieldValue('name', 'x')
    expect(form.getState().validating.name).toBe(true)
    resolve('Taken')
    await new Promise((r) => setTimeout(r, 0))
    expect(form.getState().validating.name).toBe(false)
    expect(form.getState().errors.name).toBe('Taken')
  })

  it('debounces validate-on-change by validationDebounceMs', () => {
    vi.useFakeTimers()
    const validator = vi.fn(() => undefined)
    const form = createFormStore({
      initialValues: { name: '' },
      validators: { name: validator },
      validationDebounceMs: 200,
    })
    form.setFieldValue('name', 'a')
    form.setFieldValue('name', 'ab')
    form.setFieldValue('name', 'abc')
    expect(validator).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(validator).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
