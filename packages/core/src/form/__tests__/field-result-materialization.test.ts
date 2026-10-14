import { describe, expect, it } from 'vitest'
import { createValidationCoordinator, type InternalFieldResult } from '../coordinator'

const base = { validateOnChange: true, debounceMs: 0, getValues: () => ({ x: '' }) }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('validation field result materialization', () => {
  it('returns fresh ordinary metadata without exposing the private authority record', async () => {
    const coordinator = createValidationCoordinator(base)
    const first = await coordinator.runField('x', { x: '' }, () => 'required')
    expect(Reflect.ownKeys(first)).toEqual([
      'name',
      'runId',
      'revision',
      'epoch',
      'status',
      'error',
    ])
    expect(Object.getPrototypeOf(first) === Object.prototype).toBe(true)
    for (const key of Object.keys(first)) {
      expect(Object.getOwnPropertyDescriptor(first, key)).toEqual({
        value: first[key as keyof InternalFieldResult],
        configurable: true,
        enumerable: true,
        writable: true,
      })
    }
    const token = { ...first }
    first.name = 'changed'
    first.runId = 500
    first.epoch = 100
    first.status = 'destroyed'
    expect(coordinator.isCurrentField(token)).toBe(true)
    const second = await coordinator.runField('x', { x: '' }, () => undefined)
    expect(second !== first).toBe(true)
    expect(second).toEqual({
      name: 'x',
      runId: 2,
      revision: 0,
      epoch: 0,
      status: 'current',
      error: undefined,
    })
    expect(coordinator.isCurrentField(token)).toBe(false)
    coordinator.destroy()
  })

  it.each([
    ['cancel', 'cancelled', 0, 1],
    ['destroy', 'destroyed', 0, 1],
    ['invalidateValue', 'superseded', 1, 0],
  ] as const)(
    'publishing true can %s before the runner executes',
    async (method, status, revision, epoch) => {
      const flags: boolean[] = []
      let calls = 0
      const coordinator = createValidationCoordinator({
        ...base,
        onFieldValidating: (_name, on) => {
          flags.push(on)
          if (on) coordinator[method]()
        },
      })
      const result = await coordinator.runField('x', { x: '' }, () => {
        calls++
        return 'unused'
      })
      expect(result).toEqual({
        name: 'x',
        runId: 1,
        revision: 0,
        epoch: 0,
        status,
        error: undefined,
      })
      expect(calls).toBe(0)
      expect(flags).toEqual([true, false])
      expect(coordinator.revision()).toBe(revision)
      expect(coordinator.epoch()).toBe(epoch)
      expect(coordinator.isCurrentField(result)).toBe(false)
      coordinator.destroy()
    },
  )

  it('rechecks authority after false starts a newer validation', async () => {
    let newer: Promise<InternalFieldResult> | undefined
    let restarted = false
    const errors: (string | undefined)[] = []
    const coordinator = createValidationCoordinator({
      ...base,
      onFieldValidating: (_name, on) => {
        if (on || restarted) return
        restarted = true
        newer = coordinator.runField('x', { x: 'new' }, () => 'new error')
      },
      onFieldError: (_name, error) => errors.push(error),
    })
    const old = await coordinator.runField('x', { x: 'old' }, () => 'old error')
    const current = await newer
    expect(old.status).toBe('superseded')
    expect(old.error).toBeUndefined()
    expect(current?.status).toBe('current')
    expect(current?.runId).toBe(2)
    expect(errors).toEqual(['new error'])
    coordinator.destroy()
  })

  it.each(['invalidateValue', 'cancel'] as const)(
    'preserves the captured result status if the error callback invokes %s',
    async (method) => {
      const coordinator = createValidationCoordinator({
        ...base,
        onFieldError: () => coordinator[method](),
      })
      const result = await coordinator.runField('x', { x: '' }, () => 'required')
      expect(result.status).toBe('current')
      expect(result.error).toBe('required')
      expect(result.revision).toBe(0)
      expect(result.epoch).toBe(0)
      expect(coordinator.isCurrentField(result)).toBe(false)
      coordinator.destroy()
    },
  )

  it('settles stale rejection without clearing newer flags or publishing its error', async () => {
    const pending = deferred<string>()
    const errors: (string | undefined)[] = []
    const flags: boolean[] = []
    const coordinator = createValidationCoordinator({
      ...base,
      onFieldValidating: (_name, on) => flags.push(on),
      onFieldError: (_name, error) => errors.push(error),
    })
    const old = coordinator.runField('x', { x: 'old' }, () => pending.promise)
    const newer = await coordinator.runField('x', { x: 'new' }, () => 'new error')
    pending.reject(new Error('late failure'))
    expect((await old).status).toBe('superseded')
    expect(newer.error).toBe('new error')
    expect(errors).toEqual(['new error'])
    expect(flags).toEqual([true, true, false])
    coordinator.destroy()
  })

  it('keeps native thenable assimilation and the runner await boundary', async () => {
    const events: string[] = []
    const coordinator = createValidationCoordinator({
      ...base,
      onFieldValidating: (_name, on) => events.push(String(on)),
      onFieldError: (_name, error) => events.push(`error:${error}`),
    })
    const thenable = {
      get then() {
        events.push('get then')
        return (resolve: (value: string) => void) => {
          events.push('call then')
          resolve('required')
        }
      },
    }
    const pending = coordinator.runField('x', { x: '' }, () => {
      events.push('runner')
      return thenable as unknown as Promise<string>
    })
    events.push('caller')
    expect((await pending).error).toBe('required')
    expect(events).toEqual([
      'true',
      'runner',
      'get then',
      'caller',
      'call then',
      'false',
      'error:required',
    ])
    coordinator.destroy()
  })

  it('still resolves scheduled results as ordinary objects even when the caller discards them', async () => {
    const before = Object.getOwnPropertyDescriptor(Object.prototype, 'then')
    const statuses: string[] = []
    const coordinator = createValidationCoordinator(base)
    Object.defineProperty(Object.prototype, 'then', {
      configurable: true,
      get(this: Record<string, unknown>) {
        if (
          Object.prototype.hasOwnProperty.call(this, 'runId') &&
          Object.prototype.hasOwnProperty.call(this, 'status')
        ) {
          statuses.push(String(this.status))
        }
        return undefined
      },
    })
    try {
      coordinator.scheduleValidateWith('x', { x: '' }, () => undefined)
      for (let i = 0; i < 6; i++) await Promise.resolve()
    } finally {
      if (before) Object.defineProperty(Object.prototype, 'then', before)
      else delete (Object.prototype as Record<string, unknown>).then
      coordinator.destroy()
    }
    expect(statuses).toEqual(['current'])
  })
})
