import { describe, expect, it } from 'vitest'
import { createFormStore } from '../../form'

describe('unused private validation snapshot output still has observable writes', () => {
  it('rejects a clone push setter error before publishing validation flags', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, '0')
    let setterCalls = 0
    const row = {
      id: 'snapshot-row',
      get title() {
        Object.defineProperty(Array.prototype, '0', {
          configurable: true,
          set(this: unknown[], value: unknown) {
            if (
              value &&
              typeof value === 'object' &&
              (value as { id?: string }).id === 'snapshot-row'
            ) {
              setterCalls++
              throw new Error('snapshot array setter failed')
            }
            Object.defineProperty(this, '0', {
              value,
              enumerable: true,
              configurable: true,
              writable: true,
            })
          },
        })
        return 'kept'
      },
    }
    const form = createFormStore({ initialValues: { items: [row] }, maxHistory: 0 })
    let states = 0
    form.subscribe(() => {
      states++
    })
    let pending: Promise<string | undefined>
    try {
      pending = form.validateField('items')
    } finally {
      if (descriptor) Object.defineProperty(Array.prototype, '0', descriptor)
      else Reflect.deleteProperty(Array.prototype, '0')
    }
    await expect(pending!).rejects.toThrow('snapshot array setter failed')
    expect(setterCalls).toBe(1)
    expect(states).toBe(0)
    expect(form.getState().validating.items).toBeUndefined()
    form.destroy()
  })

  it('gives an observable push setter detached child values, not original rows', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, '0')
    let exposed: { id: string; profile: { city: string } } | undefined
    const profile = { city: 'original' }
    const row = {
      id: 'detached-row',
      profile,
      get title() {
        Object.defineProperty(Array.prototype, '0', {
          configurable: true,
          set(this: unknown[], value: unknown) {
            if (
              value &&
              typeof value === 'object' &&
              (value as { id?: string }).id === 'detached-row'
            ) {
              exposed = value as typeof row
              exposed.profile.city = 'setter edit'
            }
            Object.defineProperty(this, '0', {
              value,
              enumerable: true,
              configurable: true,
              writable: true,
            })
          },
        })
        return 'kept'
      },
    }
    const form = createFormStore({ initialValues: { items: [row] }, maxHistory: 0 })
    let pending: Promise<string | undefined>
    try {
      pending = form.validateField('items')
    } finally {
      if (descriptor) Object.defineProperty(Array.prototype, '0', descriptor)
      else Reflect.deleteProperty(Array.prototype, '0')
    }
    await pending!
    expect(exposed?.profile.city).toBe('setter edit')
    // Keep matcher diagnostics from rereading the deliberately effectful row
    // getter and reinstalling the prototype hook after restoration.
    expect(exposed === row).toBe(false)
    expect(exposed?.profile === profile).toBe(false)
    expect(profile.city).toBe('original')
    form.destroy()
  })

  it('reads push before cloning the next element and preserves its exception', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'push')!
    const push = Array.prototype.push
    let nextReads = 0
    const first = {
      id: 'first-row',
      get title() {
        Object.defineProperty(Array.prototype, 'push', {
          configurable: true,
          get(this: { id?: string }[]) {
            if (this[0]?.id === 'first-row') throw new Error('snapshot push lookup failed')
            return push
          },
        })
        return 'kept'
      },
    }
    const second = {
      id: 'second-row',
      get title() {
        nextReads++
        return 'unread'
      },
    }
    const form = createFormStore({ initialValues: { items: [first, second] }, maxHistory: 0 })
    let states = 0
    form.subscribe(() => {
      states++
    })
    let pending: Promise<string | undefined>
    try {
      pending = form.validateField('items')
    } finally {
      Object.defineProperty(Array.prototype, 'push', descriptor)
    }
    await expect(pending!).rejects.toThrow('snapshot push lookup failed')
    expect(nextReads).toBe(0)
    expect(states).toBe(0)
    expect(form.getState().validating.items).toBeUndefined()
    form.destroy()
  })
})
