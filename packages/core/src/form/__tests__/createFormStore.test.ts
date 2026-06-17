import { describe, expect, it, vi } from 'vitest'
import { createFormStore } from '../../form'

describe('createFormStore', () => {
  it('seeds state from initialValues', () => {
    const form = createFormStore({ initialValues: { email: '', age: 0 } })
    expect(form.getState()).toEqual({
      values: { email: '', age: 0 },
      errors: {},
      touched: {},
      dirty: {},
      isSubmitting: false,
      isValidating: false,
      validating: {},
      submitCount: 0,
      currentStep: 0,
    })
  })

  it('setFieldValue updates the value and tracks dirty against initial', () => {
    const form = createFormStore({ initialValues: { name: 'Alice' }, validateOnChange: false })
    expect(form.getState().dirty).toEqual({})
    form.setFieldValue('name', 'Bob')
    expect(form.getState().values.name).toBe('Bob')
    expect(form.getState().dirty.name).toBe(true)
    form.setFieldValue('name', 'Alice')
    expect(form.getState().dirty.name).toBe(false)
  })

  it('getFieldValue reads the current value', () => {
    const form = createFormStore({ initialValues: { x: 1 } })
    expect(form.getFieldValue('x')).toBe(1)
    form.setFieldValue('x', 2)
    expect(form.getFieldValue('x')).toBe(2)
  })

  it('setValues merges a partial into the current values and sets dirty', () => {
    const form = createFormStore({ initialValues: { a: 1, b: 2 }, validateOnChange: false })
    form.setValues({ a: 10 })
    expect(form.getState().values).toEqual({ a: 10, b: 2 })
    expect(form.getState().dirty.a).toBe(true)
    expect(form.getState().dirty.b).toBeUndefined()
  })

  it('subscribes and notifies on state changes', () => {
    const form = createFormStore({ initialValues: { x: 0 }, validateOnChange: false })
    const fn = vi.fn()
    const unsub = form.subscribe(fn)
    form.setFieldValue('x', 1)
    expect(fn).toHaveBeenCalledTimes(1)
    unsub()
    form.setFieldValue('x', 2)
    expect(fn).toHaveBeenCalledTimes(1) // no more notifications after unsub
  })

  it('isValid returns true only when errors is empty', () => {
    const form = createFormStore({ initialValues: { x: '' }, validateOnChange: false })
    expect(form.isValid()).toBe(true)
    form.setFieldError('x', 'Required')
    expect(form.isValid()).toBe(false)
    form.setFieldError('x', undefined)
    expect(form.isValid()).toBe(true)
  })
})
