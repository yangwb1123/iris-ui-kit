import { describe, expect, it, vi } from 'vitest'
import { createFormStore, createValidationEngine } from '../../form'

describe('form adversarial lifecycle and ownership cases', () => {
  it('does not treat inherited validator names as registered validators', async () => {
    const form = createFormStore({ initialValues: { name: 'value' }, validateOnChange: false })
    expect(await form.validateField('toString')).toBeUndefined()

    const engine = createValidationEngine(
      {},
      false,
      0,
      { onValidating: vi.fn(), onError: vi.fn() },
      () => ({ name: 'value' }),
    )
    expect(await engine.validateField('toString', { name: 'value' })).toBeUndefined()
  })

  it('gives validators and transforms owned nested snapshots', async () => {
    const form = createFormStore({
      initialValues: { profile: { city: 'Paris' } },
      validateOnChange: false,
      validators: {
        profile: (_value, values) => {
          values.profile.city = 'mutated by validator'
          return undefined
        },
      },
      transform: (values) => {
        values.profile.city = 'mutated by transform'
        return values
      },
      onSubmit: vi.fn(),
    })

    await form.validateField('profile')
    expect(form.getFieldValue('profile.city')).toBe('Paris')
    await form.handleSubmit()
    expect(form.getFieldValue('profile.city')).toBe('Paris')
  })

  it('does not invoke a field validator after a reentrant destroy', async () => {
    const validator = vi.fn(() => 'late')
    const form = createFormStore({
      initialValues: { name: 'value' },
      validateOnChange: false,
      validators: { name: validator },
    })
    let destroyed = false
    form.subscribe((state) => {
      if (state.validating.name && !destroyed) {
        destroyed = true
        form.destroy()
      }
    })

    await form.validateField('name')

    expect(validator).not.toHaveBeenCalled()
    expect(form.disposed).toBe(true)
  })

  it('does not invoke form validators after a reentrant destroy', async () => {
    const validator = vi.fn(() => 'late')
    const validate = vi.fn(() => ({ name: 'form error' }))
    const form = createFormStore({
      initialValues: { name: 'value' },
      validateOnChange: false,
      validators: { name: validator },
      validate,
    })
    let destroyed = false
    form.subscribe((state) => {
      if (state.isValidating && !destroyed) {
        destroyed = true
        form.destroy()
      }
    })

    await form.validateForm()

    expect(validator).not.toHaveBeenCalled()
    expect(validate).not.toHaveBeenCalled()
    expect(form.disposed).toBe(true)
  })

  it('does not let a whole-form pass erase a newer field result', async () => {
    const gates: Array<(error: string | undefined) => void> = []
    const form = createFormStore({
      initialValues: { name: 'value' },
      validateOnChange: false,
      validators: {
        name: () => new Promise<string | undefined>((resolve) => gates.push(resolve)),
      },
    })

    const wholeForm = form.validateForm()
    const field = form.validateField('name')
    gates[1]!('new field error')
    await field
    gates[0]!(undefined)
    await wholeForm

    expect(form.getState().errors).toEqual({ name: 'new field error' })
  })

  it('does not commit a field result after a reentrant value write', async () => {
    const form = createFormStore({
      initialValues: { name: 'old' },
      validateOnChange: false,
      validators: { name: () => 'stale error' },
    })
    let changed = false
    form.subscribe((state) => {
      if (!state.validating.name && !changed) {
        changed = true
        form.setFieldValue('name', 'new')
      }
    })

    const result = await form.validateField('name')

    expect(result).toBeUndefined()
    expect(form.getState().errors).toEqual({})
  })
})

describe('array validator planning', () => {
  it('expands nested array paths with non-word field names', async () => {
    const form = createFormStore({
      initialValues: {
        'line-items': [{ details: [{ 'sku-code': '' }] }],
      } as never,
      validateOnChange: false,
      validators: {
        'line-items[].details[].sku-code': () => 'invalid',
      } as never,
    })

    await expect(form.validateForm()).resolves.toEqual({
      'line-items[0].details[0].sku-code': 'invalid',
    })
  })
})

describe('form draft and prototype-sensitive cases', () => {
  it('detaches nested values in serialized and hydrated drafts', () => {
    const form = createFormStore({
      initialValues: { profile: { city: 'Paris' } },
      validateOnChange: false,
    })
    const draft = form.serialize()
    ;(draft.values.profile as { city: string }).city = 'mutated outside form'
    expect(form.getFieldValue('profile.city')).toBe('Paris')

    const incoming = { profile: { city: 'London' } }
    form.hydrate({ values: incoming })
    incoming.profile.city = 'mutated after hydrate'
    expect(form.getFieldValue('profile.city')).toBe('London')
  })

  it('does not mark structurally equal empty subtrees dirty during hydration', () => {
    const form = createFormStore({
      initialValues: { profile: {}, items: [] },
      validateOnChange: false,
    })

    form.hydrate({ values: { profile: {}, items: [] } })

    expect(form.getState().dirty).toEqual({})
  })

  it('does not let setValues change the values or dirty-map prototype', () => {
    const values = Object.create(null) as Record<string, unknown>
    values.__proto__ = { polluted: true }
    const form = createFormStore({ initialValues: { safe: true }, validateOnChange: false })

    form.setValues(values as never)

    expect(Object.getPrototypeOf(form.getState().values)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(form.getState().dirty)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(form.getState().values, '__proto__')).toBe(true)
    expect(Object.prototype.polluted).toBeUndefined()
  })

  it('keeps submit touched metadata safe for prototype-sensitive names', async () => {
    const initial = Object.create(null) as Record<string, unknown>
    initial.__proto__ = 'value'
    const form = createFormStore({ initialValues: initial as never, onSubmit: vi.fn() })

    await form.handleSubmit()

    expect(Object.getPrototypeOf(form.getState().touched)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(form.getState().touched, '__proto__')).toBe(true)
  })
})
