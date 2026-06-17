import { describe, expect, it, vi } from 'vitest'
import { createFormStore } from '../../form'

describe('handleSubmit', () => {
  it('calls onSubmit with values when valid and manages the lifecycle', async () => {
    const onSubmit = vi.fn()
    const form = createFormStore({
      initialValues: { email: 'a@b.com' },
      validators: { email: () => undefined },
      onSubmit,
    })
    expect(form.getState().isSubmitting).toBe(false)
    const promise = form.handleSubmit()
    expect(form.getState().isSubmitting).toBe(true)
    await promise
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com' })
    expect(form.getState().isSubmitting).toBe(false)
    expect(form.getState().submitCount).toBe(1)
  })

  it('does not call onSubmit when invalid, but still records the attempt', async () => {
    const onSubmit = vi.fn()
    const form = createFormStore({
      initialValues: { email: '' },
      validators: { email: (v) => (v ? undefined : 'Required') },
      onSubmit,
    })
    form.setFieldValue('email', '')
    await form.handleSubmit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(form.getState().submitCount).toBe(1)
  })

  it('clears isSubmitting even if onSubmit throws', async () => {
    const form = createFormStore({
      initialValues: { x: 'ok' },
      onSubmit: () => {
        throw new Error('crash')
      },
    })
    await expect(form.handleSubmit()).rejects.toThrow('crash')
    expect(form.getState().isSubmitting).toBe(false)
  })
})

describe('imperative setters', () => {
  it('setFieldError sets and clears a single error', () => {
    const form = createFormStore({ initialValues: { x: '' } })
    form.setFieldError('x', 'Error')
    expect(form.getState().errors.x).toBe('Error')
    form.setFieldError('x', undefined)
    expect(form.getState().errors.x).toBeUndefined()
  })

  it('setErrors replaces the error map and isValid reflects it', () => {
    const form = createFormStore({ initialValues: { x: '' } })
    form.setErrors({ x: 'E1', y: 'E2' })
    expect(form.getState().errors).toEqual({ x: 'E1', y: 'E2' })
    expect(form.isValid()).toBe(false)
    form.setErrors({})
    expect(form.getState().errors).toEqual({})
    expect(form.isValid()).toBe(true)
  })

  it('setFieldTouched can mark a field untouched', () => {
    const form = createFormStore({ initialValues: { x: '' }, validateOnChange: false })
    form.setFieldTouched('x', true)
    expect(form.getState().touched.x).toBe(true)
    form.setFieldTouched('x', false)
    expect(form.getState().touched.x).toBe(false)
  })
})

describe('reset', () => {
  it('restores the initial snapshot', async () => {
    const form = createFormStore({
      initialValues: { email: '' },
      validators: { email: (v) => (v ? undefined : 'Required') },
    })
    form.setFieldValue('email', 'a@b.com')
    await Promise.resolve()
    form.setFieldTouched('email')
    form.reset()
    expect(form.getState().values).toEqual({ email: '' })
    expect(form.getState().dirty).toEqual({})
    expect(form.getState().touched).toEqual({})
    expect(form.getState().submitCount).toBe(0)
  })

  it('reset(nextInitialValues) rebases dirty tracking', () => {
    const form = createFormStore({ initialValues: { x: 1 } })
    form.setFieldValue('x', 2)
    form.reset({ x: 2 }) // rebase: current value matches new initial → not dirty
    expect(form.getState().values).toEqual({ x: 2 })
    expect(form.getState().dirty.x).toBeUndefined()
  })
})

describe('parse + transform', () => {
  it('parse normalizes the initial values (and the dirty baseline)', () => {
    const form = createFormStore({
      initialValues: { date: '2024-01-15' },
      parse: (v) => ({ ...v, date: `parsed:${v.date}` }),
      validateOnChange: false,
    })
    expect(form.getState().values.date).toBe('parsed:2024-01-15')
    // Setting it back to the initial (parsed) value is NOT dirty.
    form.setFieldValue('date', 'parsed:2024-01-15')
    // dirty is set to false (matching initial), not undefined
    expect(form.getState().dirty.date).toBe(false)
  })

  it('transform is applied to what onSubmit receives; form state is unchanged', async () => {
    const onSubmit = vi.fn()
    const form = createFormStore({
      initialValues: { name: 'Alice' },
      transform: (v) => ({ ...v, name: v.name.toUpperCase() }),
      onSubmit,
    })
    await form.handleSubmit()
    expect(onSubmit).toHaveBeenCalledWith({ name: 'ALICE' })
    expect(form.getState().values.name).toBe('Alice')
  })

  it('reset re-parses the next initial values', () => {
    const form = createFormStore({
      initialValues: { x: 'a' },
      parse: (v) => ({ ...v, x: v.x.toUpperCase() }),
    })
    form.setFieldValue('x', 'B')
    form.reset({ x: 'b' })
    expect(form.getState().values.x).toBe('B') // re-parsed
  })
})
