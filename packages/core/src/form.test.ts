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
      validating: {},
      submitCount: 0,
      currentStep: 0,
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
        validating: {},
        submitCount: 0,
        currentStep: 0,
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

  describe('multi-step (wizard)', () => {
    const make = () =>
      createFormStore<{ name: string; email: string }>({
        initialValues: { name: '', email: '' },
        validateOnChange: false,
        validators: {
          name: (v) => (v ? undefined : 'Name required'),
          email: (v) => (v ? undefined : 'Email required'),
        },
        steps: [
          { id: 'who', fields: ['name'] },
          { id: 'contact', fields: ['email'] },
        ],
      })

    it('starts on step 0 and reports stepCount', () => {
      const form = make()
      expect(form.getState().currentStep).toBe(0)
      expect(form.stepCount()).toBe(2)
    })

    it('nextStep blocks on an invalid step and advances when valid', async () => {
      const form = make()
      expect(await form.nextStep()).toBe(false) // name empty → blocked
      expect(form.getState().currentStep).toBe(0)
      expect(form.getState().errors.name).toBe('Name required')
      form.setFieldValue('name', 'Ada')
      expect(await form.nextStep()).toBe(true)
      expect(form.getState().currentStep).toBe(1)
    })

    it('nextStep does not advance past the last step', async () => {
      const form = make()
      form.setFieldValue('name', 'Ada')
      form.setFieldValue('email', 'a@b.com')
      await form.nextStep() // → step 1
      expect(await form.nextStep()).toBe(false) // already last
      expect(form.getState().currentStep).toBe(1)
    })

    it('prevStep / goToStep clamp to range', () => {
      const form = make()
      form.goToStep(99)
      expect(form.getState().currentStep).toBe(1)
      form.prevStep()
      expect(form.getState().currentStep).toBe(0)
      form.prevStep()
      expect(form.getState().currentStep).toBe(0) // clamped
    })

    it('step methods are safe no-ops without steps config', async () => {
      const form = createFormStore({ initialValues: { x: '' } })
      expect(form.stepCount()).toBe(1)
      expect(await form.validateStep()).toBe(true)
      expect(await form.nextStep()).toBe(false)
      expect(form.getState().currentStep).toBe(0)
    })
  })

  describe('dependent-field validation', () => {
    it('re-validates a dependent field when its dependency changes', async () => {
      const form = createFormStore<{ password: string; confirm: string }>({
        initialValues: { password: '', confirm: '' },
        dependencies: { password: ['confirm'] },
        validators: {
          confirm: (v, all) => (v === all.password ? undefined : 'Must match'),
        },
      })
      form.setFieldValue('confirm', 'abc')
      await Promise.resolve()
      expect(form.getState().errors.confirm).toBe('Must match')
      // Editing `password` to match should clear confirm's error inline.
      form.setFieldValue('password', 'abc')
      await Promise.resolve()
      await Promise.resolve()
      expect(form.getState().errors.confirm).toBeUndefined()
    })

    it('skips dependents that have no validator and is a no-op without config', async () => {
      const form = createFormStore<{ a: string; b: string }>({
        initialValues: { a: '', b: '' },
        dependencies: { a: ['b'] },
      })
      expect(() => form.setFieldValue('a', 'x')).not.toThrow()
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

  describe('parse + transform', () => {
    it('parse normalizes the initial values (and the dirty baseline)', () => {
      const form = createFormStore({
        initialValues: { name: '  Ann  ' },
        parse: (v) => ({ name: v.name.trim() }),
      })
      expect(form.getState().values.name).toBe('Ann')
      expect(form.getState().dirty.name).toBeFalsy()
    })

    it('transform is applied to what onSubmit receives; form state is unchanged', async () => {
      const onSubmit = vi.fn()
      const form = createFormStore({
        initialValues: { name: 'ann' },
        transform: (v) => ({ name: v.name.toUpperCase() }),
        onSubmit,
      })
      await form.handleSubmit()
      expect(onSubmit).toHaveBeenCalledWith({ name: 'ANN' })
      expect(form.getState().values.name).toBe('ann')
    })

    it('reset re-parses the next initial values', () => {
      const form = createFormStore({
        initialValues: { name: 'x' },
        parse: (v) => ({ name: v.name.trim() }),
      })
      form.reset({ name: '  Bob  ' })
      expect(form.getState().values.name).toBe('Bob')
    })
  })

  describe('nested-path engine (v3 R19)', () => {
    it('flat-key reads/writes are 100% back-compatible (canonical 1-segment path)', () => {
      const form = createFormStore({ initialValues: { email: 'a@b.com' }, validateOnChange: false })
      form.setFieldValue('email', 'c@d.com')
      // The flat key is stored under its own canonical key — no nested wrapping.
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
      // Dirty is keyed by the full path; untouched siblings keep identity.
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
      // A bare top-level key on the same array is unaffected.
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
      // e0 stays on index 0; e1 follows its row to index 2.
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
      expect(form.getState().errors['items[0].sku']).toBe('e0') // unchanged
      expect(form.getState().errors['items[1].sku']).toBe('e2') // e2 shifted down
      expect(form.getState().errors['items[2].sku']).toBeUndefined() // e1 dropped
    })

    it('array MOVE / SWAP re-key per-element state with the moved row', () => {
      const form = createFormStore<{ items: { sku: string }[] }>({
        initialValues: { items: [{ sku: 'a' }, { sku: 'b' }, { sku: 'c' }] },
        validateOnChange: false,
      })
      form.setFieldError('items[0].sku', 'e0')
      form.setFieldError('items[2].sku', 'e2')
      form.arrayMove('items', 0, 2) // a → end: [b, c, a]
      expect(form.getState().values.items.map((i) => i.sku)).toEqual(['b', 'c', 'a'])
      expect(form.getState().errors['items[2].sku']).toBe('e0') // a's error follows to index 2
      expect(form.getState().errors['items[1].sku']).toBe('e2') // c shifted from 2 → 1

      form.arraySwap('items', 0, 2) // swap back-ish: [a, c, b]
      expect(form.getState().errors['items[0].sku']).toBe('e0') // a back to index 0
    })

    it('a nested validateField via setFieldTouched lands on the element path', async () => {
      const form = createFormStore<{ items: { sku: string }[] }>({
        initialValues: { items: [{ sku: '' }] },
        // A per-field validator keyed by the array path isn't how nested
        // validation works; setFieldError is the imperative path here.
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
      await new Promise((r) => setTimeout(r, 0)) // flush all microtasks
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
})
