import { describe, expect, it, vi } from 'vitest'
import { createFormStore } from './form'

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
      submitCount: 0,
    })
  })

  it('setFieldValue updates the value and tracks dirty against initial', () => {
    const form = createFormStore({
      initialValues: { name: 'ann' },
      validateOnChange: false,
    })
    form.setFieldValue('name', 'bob')
    expect(form.getState().values.name).toBe('bob')
    expect(form.getState().dirty.name).toBe(true)
    // Reverting to the initial value clears dirty.
    form.setFieldValue('name', 'ann')
    expect(form.getState().dirty.name).toBe(false)
  })

  it('setValues merges multiple fields and recomputes dirty', () => {
    const form = createFormStore({
      initialValues: { a: 1, b: 2 },
      validateOnChange: false,
    })
    form.setValues({ a: 9 })
    expect(form.getState().values).toEqual({ a: 9, b: 2 })
    expect(form.getState().dirty).toEqual({ a: true })
  })

  it('notifies subscribers on change', () => {
    const form = createFormStore({ initialValues: { x: '' }, validateOnChange: false })
    const listener = vi.fn()
    form.subscribe(listener)
    form.setFieldValue('x', 'y')
    expect(listener).toHaveBeenCalled()
  })

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
      form.setFieldTouched('email')
      expect(form.getState().touched.email).toBe(true)
      await Promise.resolve()
      expect(form.getState().errors.email).toBe('Required')
    })
  })

  describe('async validation', () => {
    it('applies the resolved error', async () => {
      const form = createFormStore({
        initialValues: { user: '' },
        validators: {
          user: async (v) => (v === 'taken' ? 'Already taken' : undefined),
        },
      })
      await form.validateField('user')
      expect(form.getState().errors.user).toBeUndefined()
      form.setFieldValue('user', 'taken')
      const err = await form.validateField('user')
      expect(err).toBe('Already taken')
      expect(form.getState().errors.user).toBe('Already taken')
    })

    it('drops a stale result when a newer validation wins the race', async () => {
      const gate: Array<(e: string | undefined) => void> = []
      const form = createFormStore({
        initialValues: { user: '' },
        validateOnChange: false,
        validators: {
          user: () => new Promise<string | undefined>((resolve) => gate.push(resolve)),
        },
      })
      const stale = form.validateField('user') // token 1
      const fresh = form.validateField('user') // token 2 (latest)
      // Resolve the *newer* call first, then the older (stale) one.
      gate[1]('E2')
      gate[0]('E1-stale')
      await Promise.all([stale, fresh])
      // The stale 'E1-stale' must not clobber the current 'E2'.
      expect(form.getState().errors.user).toBe('E2')
    })
  })

  describe('validateForm', () => {
    it('aggregates per-field errors', async () => {
      const form = createFormStore({
        initialValues: { a: '', b: 'ok' },
        validateOnChange: false,
        validators: {
          a: (v) => (v ? undefined : 'A required'),
          b: (v) => (v ? undefined : 'B required'),
        },
      })
      const errors = await form.validateForm()
      expect(errors).toEqual({ a: 'A required' })
      expect(form.getState().errors).toEqual({ a: 'A required' })
    })

    it('merges form-level cross-field errors on top', async () => {
      const form = createFormStore({
        initialValues: { pw: 'x', confirm: 'y' },
        validateOnChange: false,
        validate: (vals) => (vals.pw === vals.confirm ? {} : { confirm: 'Passwords must match' }),
      })
      const errors = await form.validateForm()
      expect(errors.confirm).toBe('Passwords must match')
    })
  })

  describe('handleSubmit', () => {
    it('calls onSubmit with values when valid and manages the lifecycle', async () => {
      let submittingDuring: boolean | undefined
      const onSubmit = vi.fn(() => {
        submittingDuring = form.getState().isSubmitting
      })
      const form = createFormStore({
        initialValues: { email: 'a@b.com' },
        validators: { email: (v) => (v ? undefined : 'Required') },
        onSubmit,
      })
      await form.handleSubmit()
      expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com' })
      expect(submittingDuring).toBe(true)
      expect(form.getState().isSubmitting).toBe(false)
      expect(form.getState().submitCount).toBe(1)
      // Every known field is marked touched on submit.
      expect(form.getState().touched.email).toBe(true)
    })

    it('does not call onSubmit when invalid, but still records the attempt', async () => {
      const onSubmit = vi.fn()
      const form = createFormStore({
        initialValues: { email: '' },
        validators: { email: (v) => (v ? undefined : 'Required') },
        onSubmit,
      })
      await form.handleSubmit()
      expect(onSubmit).not.toHaveBeenCalled()
      expect(form.getState().errors.email).toBe('Required')
      expect(form.getState().isSubmitting).toBe(false)
      expect(form.getState().submitCount).toBe(1)
      expect(form.getState().touched.email).toBe(true)
    })

    it('clears isSubmitting even if onSubmit throws', async () => {
      const form = createFormStore({
        initialValues: { x: 1 },
        onSubmit: () => {
          throw new Error('boom')
        },
      })
      await expect(form.handleSubmit()).rejects.toThrow('boom')
      expect(form.getState().isSubmitting).toBe(false)
    })
  })

  describe('imperative setters', () => {
    it('setFieldError sets and clears a single error', () => {
      const form = createFormStore({ initialValues: { x: '' } })
      form.setFieldError('x', 'Bad')
      expect(form.getState().errors.x).toBe('Bad')
      form.setFieldError('x', undefined)
      expect(form.getState().errors.x).toBeUndefined()
      expect('x' in form.getState().errors).toBe(false)
    })

    it('setErrors replaces the error map and isValid reflects it', () => {
      const form = createFormStore({ initialValues: { x: '', y: '' } })
      expect(form.isValid()).toBe(true)
      form.setErrors({ x: 'Nope' })
      expect(form.isValid()).toBe(false)
      expect(form.getState().errors).toEqual({ x: 'Nope' })
    })

    it('setFieldTouched can mark a field untouched', () => {
      const form = createFormStore({ initialValues: { x: '' }, validateOnBlur: false })
      form.setFieldTouched('x', true)
      expect(form.getState().touched.x).toBe(true)
      form.setFieldTouched('x', false)
      expect(form.getState().touched.x).toBe(false)
    })
  })

  describe('reset', () => {
    it('restores the initial snapshot', async () => {
      const form = createFormStore({
        initialValues: { name: 'ann' },
        validators: { name: () => 'always' },
      })
      form.setFieldValue('name', 'bob')
      await form.validateForm()
      form.setFieldTouched('name')
      expect(form.getState().errors.name).toBe('always')
      form.reset()
      expect(form.getState()).toEqual({
        values: { name: 'ann' },
        errors: {},
        touched: {},
        dirty: {},
        isSubmitting: false,
        isValidating: false,
        submitCount: 0,
      })
    })

    it('reset(nextInitialValues) rebases dirty tracking', () => {
      const form = createFormStore({ initialValues: { n: 1 }, validateOnChange: false })
      form.reset({ n: 5 })
      expect(form.getState().values.n).toBe(5)
      form.setFieldValue('n', 5)
      expect(form.getState().dirty.n).toBe(false)
      form.setFieldValue('n', 6)
      expect(form.getState().dirty.n).toBe(true)
    })
  })

  describe('array fields', () => {
    const make = () => createFormStore<{ tags: string[] }>({ initialValues: { tags: ['a', 'b'] } })

    it('push / insert / remove', () => {
      const form = make()
      form.arrayPush('tags', 'c')
      expect(form.getState().values.tags).toEqual(['a', 'b', 'c'])
      form.arrayInsert('tags', 1, 'x')
      expect(form.getState().values.tags).toEqual(['a', 'x', 'b', 'c'])
      form.arrayRemove('tags', 0)
      expect(form.getState().values.tags).toEqual(['x', 'b', 'c'])
    })

    it('swap / move', () => {
      const form = make()
      form.arraySwap('tags', 0, 1)
      expect(form.getState().values.tags).toEqual(['b', 'a'])
      form.arrayMove('tags', 1, 0)
      expect(form.getState().values.tags).toEqual(['a', 'b'])
    })

    it('marks the field dirty and is immutable', () => {
      const form = make()
      const before = form.getState().values.tags
      form.arrayPush('tags', 'c')
      expect(form.getState().dirty.tags).toBe(true)
      expect(form.getState().values.tags).not.toBe(before) // new array reference
    })

    it('out-of-range ops are no-ops, not crashes', () => {
      const form = make()
      form.arrayRemove('tags', 99)
      form.arraySwap('tags', 0, 99)
      form.arrayMove('tags', 5, 0)
      expect(form.getState().values.tags).toEqual(['a', 'b'])
    })
  })
})
