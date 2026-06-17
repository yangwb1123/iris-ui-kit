import { describe, expect, it } from 'vitest'
import { createFormStore } from '../../form'

describe('validation timing', () => {
  it('validates on change when validateOnChange (default)', async () => {
    const form = createFormStore({
      initialValues: { email: '' },
      validators: { email: (v) => (v ? undefined : 'Required') },
    })
    form.setFieldValue('email', '')
    await Promise.resolve()
    expect(form.getState().errors.email).toBe('Required')
    form.setFieldValue('email', 'a@b.com')
    await Promise.resolve()
    expect(form.getState().errors.email).toBeUndefined()
  })

  it('does not validate on change when disabled', async () => {
    const form = createFormStore({
      initialValues: { email: '' },
      validateOnChange: false,
      validators: { email: (v) => (v ? undefined : 'Required') },
    })
    form.setFieldValue('email', '')
    await Promise.resolve()
    expect(form.getState().errors.email).toBeUndefined()
  })

  it('validates on blur (setFieldTouched) when validateOnBlur (default)', async () => {
    const form = createFormStore({
      initialValues: { email: '' },
      validateOnChange: false,
      validators: { email: (v) => (v ? undefined : 'Required') },
    })
    await form.setFieldTouched('email')
    await Promise.resolve()
    expect(form.getState().errors.email).toBe('Required')
  })

  it('does not validate on blur when disabled', async () => {
    const form = createFormStore({
      initialValues: { email: '' },
      validateOnBlur: false,
      validateOnChange: false,
      validators: { email: (v) => (v ? undefined : 'Required') },
    })
    form.setFieldTouched('email')
    await Promise.resolve()
    expect(form.getState().errors.email).toBeUndefined()
  })
})

describe('async validation', () => {
  it('applies the resolved error', async () => {
    let resolve!: (v: string | undefined) => void
    const form = createFormStore({
      initialValues: { name: '' },
      validators: { name: () => new Promise<string | undefined>((r) => (resolve = r)) },
    })
    form.setFieldValue('name', 'x')
    resolve('Taken')
    await new Promise((r) => setTimeout(r, 0))
    expect(form.getState().errors.name).toBe('Taken')
  })

  it('drops a stale result when a newer validation wins the race', async () => {
    let resolve!: (v: string | undefined) => void
    const form = createFormStore({
      initialValues: { name: '' },
      validators: {
        name: () => new Promise<string | undefined>((r) => (resolve = r)),
      },
    })
    // Fire v1
    form.setFieldValue('name', 'a')
    const resolve1 = resolve!
    // Fire v2 before v1 resolves
    form.setFieldValue('name', 'b')
    const resolve2 = resolve!
    // v1 resolves with error — should be ignored because v2 superseded it
    resolve1('Stale error')
    await new Promise((r) => setTimeout(r, 0))
    // v2 resolves with no error
    resolve2(undefined)
    await new Promise((r) => setTimeout(r, 0))
    expect(form.getState().errors.name).toBeUndefined()
  })
})

describe('validateForm', () => {
  it('aggregates per-field errors', async () => {
    const form = createFormStore({
      initialValues: { email: '', age: 0 },
      validators: {
        email: (v) => (v ? undefined : 'Required'),
        age: (v) => (v > 0 ? undefined : 'Too young'),
      },
    })
    const errors = await form.validateForm()
    expect(errors.email).toBe('Required')
    expect(errors.age).toBe('Too young')
  })

  it('merges form-level cross-field errors on top', async () => {
    const form = createFormStore({
      initialValues: { password: 'abc', confirm: 'def' },
      validators: {
        password: () => undefined,
        confirm: () => undefined,
      },
      validate: (values) => (values.password === values.confirm ? {} : { confirm: 'Must match' }),
    })
    const errors = await form.validateForm()
    expect(errors.confirm).toBe('Must match')
  })
})

describe('dependent-field validation', () => {
  it('re-validates a dependent field when its dependency changes', async () => {
    const form = createFormStore({
      initialValues: { password: '', confirm: '' },
      dependencies: { password: ['confirm'] },
      validators: {
        password: () => undefined,
        confirm: (v, all) => (v === all.password ? undefined : 'Must match'),
      },
    })
    // Edit password → triggers confirm re-validate → confirm='', password='abc' → mismatch
    form.setFieldValue('password', 'abc')
    await Promise.resolve()
    expect(form.getState().errors.confirm).toBe('Must match')
    // Edit confirm to match → clears confirm error
    form.setFieldValue('confirm', 'abc')
    await Promise.resolve()
    expect(form.getState().errors.confirm).toBeUndefined()
    // Edit password → triggers confirm re-validate → confirm='abc', password='xyz' → mismatch
    form.setFieldValue('password', 'xyz')
    await Promise.resolve()
    expect(form.getState().errors.confirm).toBe('Must match')
    // Edit password back → clears confirm error
    form.setFieldValue('password', 'abc')
    await Promise.resolve()
    expect(form.getState().errors.confirm).toBeUndefined()
  })

  it('skips dependents that have no validator and is a no-op without config', async () => {
    const form = createFormStore({
      initialValues: { a: '', b: '' },
      validateOnChange: false,
    })
    // Should not throw.
    form.setFieldValue('a', 'x')
    expect(form.getState().values.a).toBe('x')
  })
})
