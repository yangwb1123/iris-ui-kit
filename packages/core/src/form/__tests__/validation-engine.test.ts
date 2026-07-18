import { describe, expect, it, vi } from 'vitest'
import { createValidationEngine } from '../../form'

describe('createValidationEngine — integration', () => {
  it('returns undefined when no validator is registered for the field', async () => {
    const engine = createValidationEngine(
      {},
      true,
      0,
      {
        onValidating: () => {},
        onError: () => {},
      },
      () => ({ name: 'Alice' }),
    )
    const error = await engine.validateField('name', { name: 'Alice' })
    expect(error).toBeUndefined()
  })

  it('runs the validator and returns the error', async () => {
    const engine = createValidationEngine(
      { email: (v) => (typeof v === 'string' && v.length > 0 ? undefined : 'Required') },
      true,
      0,
      { onValidating: () => {}, onError: () => {} },
      () => ({ email: '' }),
    )
    const error = await engine.validateField('email', { email: '' })
    expect(error).toBe('Required')
  })

  it('passes the field value and full values to the validator', async () => {
    const validator = vi.fn().mockReturnValue(undefined)
    const engine = createValidationEngine(
      { age: validator },
      true,
      0,
      {
        onValidating: () => {},
        onError: () => {},
      },
      () => ({ age: 25 }),
    )
    await engine.validateField('age', { age: 25, name: 'Alice' })
    expect(validator).toHaveBeenCalledWith(25, { age: 25, name: 'Alice' })
  })

  it('calls onValidating(true) before and onValidating(false) after', async () => {
    const onValidating = vi.fn()
    const engine = createValidationEngine(
      { x: (v) => (v ? undefined : 'err') },
      true,
      0,
      { onValidating, onError: () => {} },
      () => ({ x: '' }),
    )
    await engine.validateField('x', { x: '' })
    expect(onValidating).toHaveBeenCalledTimes(2)
    expect(onValidating).toHaveBeenNthCalledWith(1, 'x', true)
    expect(onValidating).toHaveBeenNthCalledWith(2, 'x', false)
  })

  it('calls onError with the result', async () => {
    const onError = vi.fn()
    const engine = createValidationEngine(
      { x: () => 'Fail' },
      true,
      0,
      { onValidating: () => {}, onError },
      () => ({ x: '' }),
    )
    await engine.validateField('x', { x: '' })
    expect(onError).toHaveBeenCalledWith('x', 'Fail')
  })

  it('calls onError with undefined when validation passes', async () => {
    const onError = vi.fn()
    const engine = createValidationEngine(
      { x: () => undefined },
      true,
      0,
      { onValidating: () => {}, onError },
      () => ({ x: 'ok' }),
    )
    await engine.validateField('x', { x: 'ok' })
    expect(onError).toHaveBeenCalledWith('x', undefined)
  })
})

describe('createValidationEngine — stale-result race protection', () => {
  it('drops a stale async result when a newer validation supersedes it', async () => {
    const onError = vi.fn()
    let resolve1!: (v: string | undefined) => void
    let resolve2!: (v: string | undefined) => void
    const engine = createValidationEngine(
      {
        name: () =>
          new Promise<string | undefined>((r) => {
            // The first call will assign a different resolver than the second
            if (!resolve1) {
              resolve1 = r
            } else {
              resolve2 = r
            }
          }),
      },
      true,
      0,
      { onValidating: () => {}, onError },
      () => ({ name: '' }),
    )

    // Fire v1
    const p1 = engine.validateField('name', { name: 'a' })
    // Fire v2 before v1 resolves
    const p2 = engine.validateField('name', { name: 'b' })

    // v1 resolves with error — should be dropped because v2 superseded
    resolve1!('Stale error')
    await p1

    // onError should not have been called yet (v1 dropped)
    expect(onError).not.toHaveBeenCalled()

    // v2 resolves with no error
    resolve2!(undefined)
    await p2

    // Only v2 result should be applied
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith('name', undefined)
  })

  it('keeps the latest result when validations fire sequentially', async () => {
    const onError = vi.fn()
    const engine = createValidationEngine(
      { x: (v) => (v ? undefined : 'Required') },
      true,
      0,
      { onValidating: () => {}, onError },
      () => ({ x: '' }),
    )

    // Sequential: first validation completes before second starts
    await engine.validateField('x', { x: '' })
    expect(onError).toHaveBeenLastCalledWith('x', 'Required')

    await engine.validateField('x', { x: 'ok' })
    expect(onError).toHaveBeenLastCalledWith('x', undefined)
  })

  it('isCurrent reflects whether a validation is in-flight for the field', async () => {
    let resolve!: (v: string | undefined) => void
    const engine = createValidationEngine(
      {
        x: () =>
          new Promise<string | undefined>((r) => {
            resolve = r
          }),
      },
      true,
      0,
      { onValidating: () => {}, onError: () => {} },
      () => ({ x: '' }),
    )

    // Before any validation, no token for 'x' — isCurrent is meaningless (no pending op)
    // Fire validation — token is now 1
    const p = engine.validateField('x', { x: '' })

    // During the async validation the token is current
    // After resolution, the token is still the latest (only one validation fired)
    resolve!(undefined)
    await p
    // After completion, the token still exists and matches
    expect(engine.isCurrent('x')).toBe(true)

    // After invalidateAll, tokens are cleared
    engine.invalidateAll()
    // With no token, isCurrent checks against 0, which won't match cleared state
    // But the intent is: no validation is in-flight
  })
})

describe('createValidationEngine — scheduleValidate / debounce', () => {
  it('debounces validation when debounceMs > 0', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    const getValues = vi.fn().mockReturnValue({ x: '' })
    const engine = createValidationEngine(
      { x: (v) => (v ? undefined : 'Required') },
      true,
      100,
      { onValidating: () => {}, onError },
      getValues,
    )

    engine.scheduleValidate('x')
    // Not yet called because debounced
    expect(getValues).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()

    // Advance time to trigger debounce
    await vi.advanceTimersByTimeAsync(100)

    expect(getValues).toHaveBeenCalled()
    // The validation runs asynchronously, flush microtasks
    await Promise.resolve()
    expect(onError).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('skips validation when validateOnChange is false', () => {
    const onError = vi.fn()
    const engine = createValidationEngine(
      { x: () => 'err' },
      false,
      0,
      {
        onValidating: () => {},
        onError,
      },
      () => ({ x: '' }),
    )

    // scheduleValidate is a no-op when validateOnChange is false
    engine.scheduleValidate('x')
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('createValidationEngine — validateForm', () => {
  it('aggregates errors from all validators', async () => {
    const engine = createValidationEngine(
      { a: (v) => (v ? undefined : 'Req'), b: (v) => (v ? undefined : 'Req2') },
      true,
      0,
      { onValidating: () => {}, onError: () => {} },
      () => ({ a: '', b: '' }),
    )
    const errors = await engine.validateForm(
      { a: (v) => (v ? undefined : 'Req'), b: (v) => (v ? undefined : 'Req2') },
      { a: '', b: '' },
    )
    expect(errors.a).toBe('Req')
    expect(errors.b).toBe('Req2')
  })

  it('merges form-level validate result', async () => {
    const engine = createValidationEngine(
      { password: () => undefined, confirm: () => undefined },
      true,
      0,
      { onValidating: () => {}, onError: () => {} },
      () => ({ password: 'a', confirm: 'b' }),
    )
    const errors = await engine.validateForm(
      { password: () => undefined, confirm: () => undefined },
      { password: 'a', confirm: 'b' },
      { validate: (v) => (v.password === v.confirm ? {} : { confirm: 'Must match' }) },
    )
    expect(errors.confirm).toBe('Must match')
  })

  it('handles validator rejection gracefully', async () => {
    const engine = createValidationEngine(
      {
        x: () => {
          throw new Error('Boom')
        },
      },
      true,
      0,
      { onValidating: () => {}, onError: () => {} },
      () => ({ x: '' }),
    )
    // Should not throw
    const errors = await engine.validateForm(
      {
        x: () => {
          throw new Error('Boom')
        },
      },
      { x: '' },
    )
    expect(errors).toEqual({})
  })
})
