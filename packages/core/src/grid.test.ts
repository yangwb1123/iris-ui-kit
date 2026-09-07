import { describe, expect, it, vi } from 'vitest'
import { createGridCore, createGridFeature } from './grid'

describe('createGridCore', () => {
  it('loads dependencies before dependents and exposes contributed methods', () => {
    const order: string[] = []
    const data = createGridFeature({
      name: 'data',
      setup() {
        order.push('data')
        return { methods: { getRows: () => ['a', 'b'] } }
      },
    })
    const exportFeature = createGridFeature({
      name: 'export',
      dependsOn: ['data'],
      setup(context) {
        order.push('export')
        const getRows = context.getMethod<() => string[]>('getRows')
        return { methods: { exportRows: () => getRows?.().join(',') ?? '' } }
      },
    })

    const core = createGridCore({ features: [exportFeature, data] })

    expect(order).toEqual(['data', 'export'])
    expect(core.features).toEqual(['data', 'export'])
    expect(core.methodNames).toEqual(['getRows', 'exportRows'])
    expect(core.invoke<string>('exportRows')).toBe('a,b')
  })

  it('keeps setup, ready, events, and reverse dispose in one feature lifecycle', () => {
    const calls: string[] = []
    const listener = createGridFeature({
      name: 'listener',
      setup(context) {
        calls.push('listener:setup')
        context.on<{ value: number }>('change', ({ value }) => calls.push(`change:${value}`))
        return {
          onReady: () => calls.push('listener:ready'),
          dispose: () => calls.push('listener:dispose'),
        }
      },
    })
    const source = createGridFeature({
      name: 'source',
      setup(context) {
        calls.push('source:setup')
        return {
          methods: { change: (value: number) => context.emit('change', { value }) },
          onReady: () => calls.push('source:ready'),
          dispose: () => calls.push('source:dispose'),
        }
      },
    })
    const core = createGridCore({ features: [listener, source] })

    core.ready().ready()
    core.invoke('change', 3)
    core.destroy()
    core.destroy()

    expect(calls).toEqual([
      'listener:setup',
      'source:setup',
      'listener:ready',
      'source:ready',
      'change:3',
      'source:dispose',
      'listener:dispose',
    ])
    expect(core.status).toBe('destroyed')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])
  })

  it('runs onReady immediately for a feature loaded after ready', () => {
    const ready = vi.fn()
    const core = createGridCore().ready()

    core.use(createGridFeature({ name: 'late', setup: () => ({ onReady: ready }) }))

    expect(ready).toHaveBeenCalledOnce()
  })

  it('rejects duplicate methods and rolls back setup subscriptions', () => {
    const core = createGridCore({
      features: [createGridFeature({ name: 'first', setup: () => ({ methods: { reset() {} } }) })],
    })
    const bad = createGridFeature({
      name: 'bad',
      setup(context) {
        context.on('ping', () => {})
        return { methods: { reset() {} } }
      },
    })

    expect(() => core.use(bad)).toThrow('already registered')
    expect(core.features).toEqual(['first'])
  })

  it('rolls back earlier features when a later setup fails', () => {
    const calls: string[] = []
    const first = createGridFeature({
      name: 'first',
      setup(context) {
        context.on('ping', () => calls.push('first:event'))
        return {
          methods: { firstMethod: () => 'first' },
          dispose: () => calls.push('first:dispose'),
        }
      },
    })
    const failing = createGridFeature({
      name: 'failing',
      setup(context) {
        context.on('ping', () => calls.push('failing:event'))
        throw new Error('setup failed')
      },
    })
    const core = createGridCore()

    expect(() => core.use(first, failing)).toThrow('setup failed')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])

    core.emit('ping', undefined)
    expect(calls).toEqual(['first:dispose'])
  })

  it('cleans up all features installed during failed construction', () => {
    const dispose = vi.fn()
    const first = createGridFeature({
      name: 'first',
      setup: () => ({ dispose }),
    })
    const failing = createGridFeature({
      name: 'failing',
      setup() {
        throw new Error('construction failed')
      },
    })

    expect(() => createGridCore({ features: [first, failing] })).toThrow('construction failed')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('rolls back batch methods and features after a method collision', () => {
    const calls: string[] = []
    const existing = createGridFeature({
      name: 'existing',
      setup: () => ({ methods: { reset: () => 'existing' } }),
    })
    const first = createGridFeature({
      name: 'first',
      setup(context) {
        context.on('ping', () => calls.push('first:event'))
        return {
          methods: { firstMethod: () => 'first' },
          dispose: () => calls.push('first:dispose'),
        }
      },
    })
    const collision = createGridFeature({
      name: 'collision',
      setup(context) {
        context.on('ping', () => calls.push('collision:event'))
        return {
          methods: { reset: () => 'collision' },
          dispose: () => calls.push('collision:dispose'),
        }
      },
    })
    const core = createGridCore({ features: [existing] })

    expect(() => core.use(first, collision)).toThrow('Grid method "reset" is already registered.')
    expect(core.features).toEqual(['existing'])
    expect(core.methodNames).toEqual(['reset'])
    expect(core.hasFeature('first')).toBe(false)
    expect(core.hasMethod('firstMethod')).toBe(false)
    expect(core.invoke<string>('reset')).toBe('existing')

    core.emit('ping', undefined)
    expect(calls).toEqual(['collision:dispose', 'first:dispose'])
  })

  it('atomically rolls back an initial ready failure and can retry', () => {
    const readyCalls: string[] = []
    const disposeCalls: string[] = []
    const eventCalls: string[] = []
    const firstError = new Error('initial ready failed')
    let failingAttempts = 0

    const first = createGridFeature({
      name: 'first',
      setup(context) {
        context.on('ping', () => eventCalls.push('first:event'))
        return {
          methods: { firstMethod: () => 'first' },
          onReady: () => readyCalls.push('first:ready'),
          dispose: () => disposeCalls.push('first:dispose'),
        }
      },
    })
    const failing = createGridFeature({
      name: 'failing',
      setup(context) {
        context.on('ping', () => eventCalls.push('failing:event'))
        return {
          methods: { failingMethod: () => 'failing' },
          onReady: () => {
            readyCalls.push('failing:ready')
            failingAttempts += 1
            if (failingAttempts === 1) throw firstError
          },
          dispose: () => disposeCalls.push('failing:dispose'),
        }
      },
    })
    const last = createGridFeature({
      name: 'last',
      setup(context) {
        context.on('ping', () => eventCalls.push('last:event'))
        return {
          methods: { lastMethod: () => 'last' },
          onReady: () => readyCalls.push('last:ready'),
          dispose: () => disposeCalls.push('last:dispose'),
        }
      },
    })
    const core = createGridCore({ features: [first, failing, last] })

    let caught: unknown
    try {
      core.ready()
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(firstError)
    expect(readyCalls).toEqual(['first:ready', 'failing:ready', 'last:ready'])
    expect(disposeCalls).toEqual(['last:dispose', 'failing:dispose', 'first:dispose'])
    expect(core.status).toBe('created')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])

    core.emit('ping', undefined)
    expect(eventCalls).toEqual([])

    core.use(first, failing, last).ready()
    expect(core.status).toBe('ready')
    expect(readyCalls).toEqual([
      'first:ready',
      'failing:ready',
      'last:ready',
      'first:ready',
      'failing:ready',
      'last:ready',
    ])
    expect(core.features).toEqual(['first', 'failing', 'last'])
  })

  it('rolls back a ready-time batch after onReady fails and remains usable', () => {
    const existingReady = vi.fn()
    const existing = createGridFeature({
      name: 'existing',
      setup: () => ({
        methods: { existingMethod: () => 'existing' },
        onReady: existingReady,
      }),
    })
    const firstDispose = vi.fn()
    const first = createGridFeature({
      name: 'first',
      setup: (context) => {
        context.on('ping', () => {})
        return { methods: { firstMethod: () => 'first' }, dispose: firstDispose }
      },
    })
    const failingDispose = vi.fn()
    const failing = createGridFeature({
      name: 'failing',
      setup: (context) => {
        context.on('ping', () => {})
        return {
          methods: { failingMethod: () => 'failing' },
          onReady: () => {
            throw new Error('ready failed')
          },
          dispose: failingDispose,
        }
      },
    })
    const core = createGridCore({ features: [existing] }).ready()

    expect(() => core.use(first, failing)).toThrow('ready failed')
    expect(core.status).toBe('ready')
    expect(core.features).toEqual(['existing'])
    expect(core.methodNames).toEqual(['existingMethod'])
    expect(existingReady).toHaveBeenCalledOnce()
    expect(firstDispose).toHaveBeenCalledOnce()
    expect(failingDispose).toHaveBeenCalledOnce()

    const recoveryReady = vi.fn()
    core.use(
      createGridFeature({
        name: 'recovery',
        setup: () => ({ onReady: recoveryReady }),
      }),
    )
    expect(recoveryReady).toHaveBeenCalledOnce()
    expect(core.features).toEqual(['existing', 'recovery'])
  })

  it('fails fast for missing, cyclic, and duplicate feature dependencies', () => {
    const missing = createGridFeature({
      name: 'missing-user',
      dependsOn: ['missing'],
      setup() {},
    })
    expect(() => createGridCore({ features: [missing] })).toThrow('requires missing feature')

    const a = createGridFeature({ name: 'a', dependsOn: ['b'], setup() {} })
    const b = createGridFeature({ name: 'b', dependsOn: ['a'], setup() {} })
    expect(() => createGridCore({ features: [a, b] })).toThrow('dependency cycle')

    const duplicate = createGridFeature({ name: 'duplicate', setup() {} })
    expect(() => createGridCore({ features: [duplicate, duplicate] })).toThrow('already installed')
  })

  it('does not allow new work after destroy', () => {
    const core = createGridCore()
    core.destroy()

    expect(() => core.ready()).toThrow('destroyed')
    expect(() => core.emit('change', 1)).toThrow('destroyed')
    expect(() => core.invoke('missing')).toThrow('destroyed')
  })
})
