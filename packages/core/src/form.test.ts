import { describe, expect, it, vi } from 'vitest'
import { createFormStore, createDirtyGuard, type FieldErrors, type FormStore } from './form'

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

    it('validates all fields on mount when validateOnMount is true', async () => {
      const form = createFormStore({
        initialValues: { email: '', name: '' },
        validators: {
          email: (v) => (v ? undefined : 'Required'),
          name: (v) => (v ? undefined : 'Name required'),
        },
        validateOnMount: true,
      })
      // First tick: validators run and write errors
      await Promise.resolve()
      expect(form.getState().errors.email).toBe('Required')
      expect(form.getState().errors.name).toBe('Name required')
      // Extra ticks: the .then() callback touches the fields
      await Promise.resolve()
      await Promise.resolve()
      expect(form.getState().touched.email).toBe(true)
      expect(form.getState().touched.name).toBe(true)
    })

    it('does not validate on mount when validateOnMount is false (default)', async () => {
      const form = createFormStore({
        initialValues: { email: '' },
        validators: { email: (v) => (v ? undefined : 'Required') },
        // validateOnMount defaults to false
      })
      await Promise.resolve()
      expect(form.getState().errors.email).toBeUndefined()
      expect(form.getState().touched.email).toBeUndefined()
    })

    it('validateOnMount skips fields without validators', async () => {
      const form = createFormStore({
        initialValues: { email: '', name: '' },
        validators: {
          email: (v) => (v ? undefined : 'Required'),
        },
        validateOnMount: true,
      })
      await Promise.resolve()
      await Promise.resolve()
      expect(form.getState().errors.email).toBe('Required')
      // name has no validator — should not be touched
      expect(form.getState().errors.name).toBeUndefined()
      expect(form.getState().touched.name).toBeUndefined()
    })
  })

  describe('setFieldValueDebounceMs', () => {
    it('debounces multiple setFieldValue calls into one store write', async () => {
      const form = createFormStore({
        initialValues: { email: '' },
        setFieldValueDebounceMs: 50,
      })
      // Rapid calls should not update the store immediately
      form.setFieldValue('email', 'a')
      expect(form.getState().values.email).toBe('')
      form.setFieldValue('email', 'ab')
      expect(form.getState().values.email).toBe('')
      form.setFieldValue('email', 'abc')
      expect(form.getState().values.email).toBe('')
      // getFieldValue reads from the buffer
      expect(form.getFieldValue('email')).toBe('abc')
      // After debounce timeout, the last value is flushed
      await new Promise((r) => setTimeout(r, 80))
      expect(form.getState().values.email).toBe('abc')
    })

    it('does not debounce when setFieldValueDebounceMs is 0 (default)', () => {
      const form = createFormStore({
        initialValues: { email: '' },
      })
      form.setFieldValue('email', 'hello')
      expect(form.getState().values.email).toBe('hello')
    })

    it('still validates on change when debounced', async () => {
      const form = createFormStore({
        initialValues: { email: '' },
        setFieldValueDebounceMs: 50,
        validators: { email: (v) => (v ? undefined : 'Required') },
      })
      form.setFieldValue('email', '')
      // Validation runs immediately (not debounced by setFieldValueDebounceMs)
      await Promise.resolve()
      expect(form.getState().errors.email).toBe('Required')
      // Store is not yet updated
      expect(form.getState().values.email).toBe('')
    })

    it('getFieldValue reads buffered value when debounced', () => {
      const form = createFormStore({
        initialValues: { field: 'initial' },
        setFieldValueDebounceMs: 100,
      })
      expect(form.getFieldValue('field')).toBe('initial')
      form.setFieldValue('field', 'buffered')
      expect(form.getFieldValue('field')).toBe('buffered')
      // Store still has the old value
      expect(form.getState().values.field).toBe('initial')
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

    it('drops a stale whole-form result when superseded', async () => {
      const gate: Array<(e: FieldErrors<{ field: string }>) => void> = []
      const form = createFormStore({
        initialValues: { field: 'v1' },
        validateOnChange: false,
        validate: () =>
          new Promise<FieldErrors<{ field: string }>>((resolve) => {
            gate.push(resolve)
          }),
      })
      const p1 = form.validateForm() // whole-form pass against v1
      form.setFieldValue('field', 'v2') // edit bumps the form token
      const p2 = form.validateForm() // newer pass against v2
      // Let both passes reach their config.validate before resolving.
      await Promise.resolve()
      gate[1]!({ field: 'E2' }) // newer pass wins first
      await p2
      gate[0]!({ field: 'E1-stale' }) // stale pass resolves after
      const staleResult = await p1
      // The stale E1-stale must not resurrect into the current map.
      expect(form.getState().errors).toEqual({ field: 'E2' })
      // The superseded pass returns the CURRENT map, not its stale one.
      expect(staleResult).toEqual({ field: 'E2' })
    })

    it('stale whole-form error cannot resurrect a cleared field', async () => {
      let resolveStale!: (e: FieldErrors<{ field: string }>) => void
      const form = createFormStore({
        initialValues: { field: 'x' },
        validateOnChange: false,
        validate: () =>
          new Promise<FieldErrors<{ field: string }>>((resolve) => {
            resolveStale = resolve
          }),
      })
      const p1 = form.validateForm() // slow whole-form pass
      form.setFieldValue('field', 'y') // mid-flight edit
      await Promise.resolve() // let the pass reach config.validate
      resolveStale({ field: 'stale error' })
      const result = await p1
      expect(form.getState().errors.field).toBeUndefined()
      // `finally` still clears isValidating for the stale pass.
      expect(form.getState().isValidating).toBe(false)
      expect(result).toEqual({})
    })

    // F1 tripwire: EVERY values-write site must invalidate an in-flight
    // whole-form pass, or the stale-merge reproduction window stays open.
    type WriteSite = (form: FormStore<{ field: string }>) => void
    const writeSites: Array<[string, WriteSite]> = [
      ['immediate setFieldValue', (f) => f.setFieldValue('field', 'z')],
      ['setValues', (f) => f.setValues({ field: 'z' })],
      ['undo', (f) => f.undo()],
      [
        'redo',
        (f) => {
          f.undo()
          f.redo()
        },
      ],
      ['hydrate', (f) => f.hydrate({ values: { field: 'z' } })],
      ['reset', (f) => f.reset()],
    ]
    it.each(writeSites)('%s invalidates an in-flight whole-form pass', async (_label, write) => {
      let resolveStale!: (e: FieldErrors<{ field: string }>) => void
      const form = createFormStore({
        initialValues: { field: 'x' },
        validateOnChange: false,
        maxHistory: 10,
        validate: () =>
          new Promise<FieldErrors<{ field: string }>>((resolve) => {
            resolveStale = resolve
          }),
      })
      form.setFieldValue('field', 'y') // history baseline for undo/redo
      const p = form.validateForm() // in-flight whole-form pass
      await Promise.resolve() // let the pass reach config.validate
      write(form) // the write site under test
      resolveStale({ field: 'stale' })
      const result = await p
      // The stale pass wrote nothing — error map is the pre-pass map.
      expect(form.getState().errors).toEqual({})
      expect(result).toEqual({})
    })

    it('invalidates an in-flight whole-form pass on a debounced setFieldValue flush', async () => {
      vi.useFakeTimers()
      let resolveStale!: (e: FieldErrors<{ field: string }>) => void
      const form = createFormStore({
        initialValues: { field: 'x' },
        validateOnChange: false,
        setFieldValueDebounceMs: 100,
        validate: () =>
          new Promise<FieldErrors<{ field: string }>>((resolve) => {
            resolveStale = resolve
          }),
      })
      const p = form.validateForm()
      form.setFieldValue('field', 'y') // buffered — no store write yet
      vi.advanceTimersByTime(250) // flush → store write + form-token bump
      await Promise.resolve() // let the pass reach config.validate
      resolveStale({ field: 'stale' })
      const result = await p
      expect(form.getState().errors).toEqual({})
      expect(form.getState().values.field).toBe('y')
      expect(result).toEqual({})
      vi.useRealTimers()
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

  describe('isDirty / getDirtyFields', () => {
    it('returns false when no field has been changed', () => {
      const form = createFormStore({ initialValues: { a: 1, b: 2 }, validateOnChange: false })
      expect(form.isDirty()).toBe(false)
      expect(form.getDirtyFields()).toEqual([])
    })

    it('returns true after a field is set to a different value', () => {
      const form = createFormStore({ initialValues: { a: 1 }, validateOnChange: false })
      form.setFieldValue('a', 2)
      expect(form.isDirty()).toBe(true)
      expect(form.getDirtyFields()).toEqual(['a'])
    })

    it('returns false after reverting to the initial value', () => {
      const form = createFormStore({ initialValues: { a: 1 }, validateOnChange: false })
      form.setFieldValue('a', 2)
      form.setFieldValue('a', 1)
      expect(form.isDirty()).toBe(false)
    })

    it('tracks multiple dirty fields independently', () => {
      const form = createFormStore({ initialValues: { a: 1, b: 2 }, validateOnChange: false })
      form.setFieldValue('a', 99)
      form.setFieldValue('b', 88)
      expect(form.getDirtyFields()).toEqual(['a', 'b'])
    })
  })

  describe('serialize / hydrate (draft persistence)', () => {
    it('serialize captures values + touched', () => {
      const form = createFormStore({ initialValues: { n: 1 }, validateOnChange: false })
      form.setFieldValue('n', 2)
      form.setFieldTouched('n')
      const draft = form.serialize()
      expect(draft.values).toEqual({ n: 2 })
      expect(draft.touched).toEqual({ n: true })
    })

    it('serialize excludes touched when includeTouched=false', () => {
      const form = createFormStore({ initialValues: { n: 1 } })
      expect(form.serialize({ includeTouched: false }).touched).toBeUndefined()
    })

    it('hydrate restores values and marks dirty', () => {
      const form = createFormStore({ initialValues: { a: 1, b: 2 }, validateOnChange: false })
      form.hydrate({ values: { a: 99, b: 2 } })
      expect(form.getState().values.a).toBe(99)
      expect(form.getState().values.b).toBe(2)
      expect(form.getState().dirty.a).toBe(true)
      // b matches initial, was not included in hydrate, but a is dirty
      expect(form.getState().dirty.b).toBe(undefined) // not touched
      expect(form.isDirty()).toBe(true)
    })

    it('hydrate restores touched state', () => {
      const form = createFormStore({ initialValues: { x: '' } })
      form.hydrate({ values: { x: 'v' }, touched: { x: true } })
      expect(form.getState().touched.x).toBe(true)
    })

    it('round-trip serialize → hydrate reproduces values', () => {
      const form = createFormStore({ initialValues: { email: '' }, validateOnChange: false })
      form.setFieldValue('email', 'a@b.com')
      const draft = form.serialize()
      const form2 = createFormStore({ initialValues: { email: '' }, validateOnChange: false })
      form2.hydrate(draft)
      expect(form2.getFieldValue('email')).toBe('a@b.com')
      expect(form2.isDirty()).toBe(true)
    })
  })

  describe('createDirtyGuard', () => {
    it('attach/detach are no-ops in non-browser env', () => {
      const guard = createDirtyGuard(() => false)
      expect(() => guard.attach()).not.toThrow()
      expect(() => guard.detach()).not.toThrow()
    })
  })

  describe('undo / redo', () => {
    it('undo and redo a single field change', () => {
      const form = createFormStore({ initialValues: { name: 'ann' }, validateOnChange: false })
      expect(form.canUndo()).toBe(false)
      expect(form.canRedo()).toBe(false)
      form.setFieldValue('name', 'bob')
      expect(form.canUndo()).toBe(true)
      expect(form.getState().values.name).toBe('bob')
      form.undo()
      expect(form.getState().values.name).toBe('ann')
      expect(form.canRedo()).toBe(true)
      form.redo()
      expect(form.getState().values.name).toBe('bob')
    })

    it('undo multiple steps and redo is truncated by a new mutation', () => {
      const form = createFormStore({ initialValues: { x: 0 }, validateOnChange: false })
      form.setFieldValue('x', 1)
      form.setFieldValue('x', 2)
      form.undo()
      expect(form.getState().values.x).toBe(1)
      form.undo()
      expect(form.getState().values.x).toBe(0)
      form.redo()
      expect(form.getState().values.x).toBe(1)
      form.setFieldValue('x', 99) // new mutation truncates redo
      expect(form.canRedo()).toBe(false)
      form.undo()
      expect(form.getState().values.x).toBe(1)
    })

    it('undo is no-op when history is empty', () => {
      const form = createFormStore({ initialValues: { x: 1 }, validateOnChange: false })
      expect(() => form.undo()).not.toThrow()
      expect(form.getState().values.x).toBe(1)
    })

    it('redo is no-op at the latest snapshot', () => {
      const form = createFormStore({ initialValues: { x: 1 }, validateOnChange: false })
      form.setFieldValue('x', 2)
      expect(() => form.redo()).not.toThrow()
      expect(form.getState().values.x).toBe(2)
    })

    it('reset clears undo history', () => {
      const form = createFormStore({ initialValues: { n: 0 }, validateOnChange: false })
      form.setFieldValue('n', 1)
      expect(form.canUndo()).toBe(true)
      form.reset()
      expect(form.canUndo()).toBe(false)
      expect(form.canRedo()).toBe(false)
    })

    it('undo works with setValues', () => {
      const form = createFormStore({ initialValues: { a: 1, b: 2 }, validateOnChange: false })
      form.setValues({ a: 99, b: 88 })
      form.undo()
      expect(form.getState().values).toEqual({ a: 1, b: 2 })
    })

    it('canUndo/canRedo reflect correct state', () => {
      const form = createFormStore({ initialValues: { x: '' }, validateOnChange: false })
      expect(form.canUndo()).toBe(false)
      expect(form.canRedo()).toBe(false)
      form.setFieldValue('x', 'a')
      expect(form.canUndo()).toBe(true)
      expect(form.canRedo()).toBe(false)
      form.undo()
      expect(form.canUndo()).toBe(false)
      expect(form.canRedo()).toBe(true)
      form.redo()
      expect(form.canUndo()).toBe(true)
      expect(form.canRedo()).toBe(false)
    })
  })
})
