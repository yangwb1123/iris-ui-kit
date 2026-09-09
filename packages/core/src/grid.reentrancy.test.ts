import { describe, expect, it, vi } from 'vitest'
import { createGridCore, createGridFeature, type GridFeature } from './grid'

describe('createGridCore reentrancy hardening', () => {
  it('rolls back reentrant feature installs when the outer setup fails', () => {
    const dispose = vi.fn()
    const event = vi.fn()
    const child = createGridFeature({
      name: 'child',
      setup(context) {
        context.on('ping', event)
        return { methods: { childMethod: () => 'child' }, dispose }
      },
    })
    const outer = createGridFeature({
      name: 'outer',
      setup(context) {
        context.core.use(child)
        throw new Error('outer failed')
      },
    })
    const core = createGridCore()

    expect(() => core.use(outer)).toThrow('outer failed')
    expect(dispose).toHaveBeenCalledOnce()
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])
    core.emit('ping', undefined)
    expect(event).not.toHaveBeenCalled()
  })

  it('rejects self-installation without overflowing the stack', () => {
    const core = createGridCore()
    const selfRef: { current?: GridFeature } = {}
    const setup = vi.fn((context) => {
      context.core.use(selfRef.current!)
      return { methods: { leaked: () => true } }
    })

    const self = createGridFeature({
      name: 'self',
      setup,
    })
    selfRef.current = self

    let thrown: unknown
    try {
      core.use(self)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).not.toBeInstanceOf(RangeError)
    expect(thrown).toMatchObject({
      message: expect.stringMatching(/self/),
    })
    expect((thrown as Error).message).toMatch(/already|reentr/i)
    expect(setup).toHaveBeenCalledOnce()

    expect(core.status).toBe('created')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])
    expect(core.hasFeature('self')).toBe(false)
    expect(core.hasMethod('leaked')).toBe(false)

    const unrelated = createGridFeature({
      name: 'unrelated',
      setup: () => ({ methods: { unrelated: () => true } }),
    })
    core.use(unrelated)
    expect(core.hasFeature('unrelated')).toBe(true)
    expect(core.hasMethod('unrelated')).toBe(true)
  })

  it('installs an overlapping nested feature only once', () => {
    const setup = vi.fn()
    const event = vi.fn()
    const dispose = vi.fn()
    const child = createGridFeature({
      name: 'child',
      setup(context) {
        setup()
        context.on('ping', event)
        return { dispose }
      },
    })
    const parent = createGridFeature({
      name: 'parent',
      setup(context) {
        context.core.use(child)
      },
    })
    const core = createGridCore()

    core.use(parent, child)

    expect(setup).toHaveBeenCalledOnce()
    core.emit('ping', undefined)
    expect(event).toHaveBeenCalledOnce()

    core.destroy()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('delivers late readiness callbacks once during an active ready pass', () => {
    const lateReady = vi.fn()
    const late = createGridFeature({
      name: 'late',
      setup: () => ({ onReady: lateReady }),
    })
    const installer = createGridFeature({
      name: 'installer',
      setup(context) {
        return { onReady: () => context.core.use(late) }
      },
    })
    const core = createGridCore({ features: [installer] })

    core.ready()

    expect(core.hasFeature('late')).toBe(true)
    expect(lateReady).toHaveBeenCalledOnce()
    core.ready()
    expect(lateReady).toHaveBeenCalledOnce()
  })

  it('preserves destruction when onReady destroys before throwing', () => {
    const failure = new Error('ready failed after destroy')
    const core = createGridCore()
    const failing = createGridFeature({
      name: 'destroy-then-throw',
      setup: () => ({
        onReady: () => {
          core.destroy()
          throw failure
        },
      }),
    })

    core.use(failing)

    expect(() => core.ready()).toThrow(failure)
    expect(core.status).toBe('destroyed')

    const afterDestroy = createGridFeature({
      name: 'after-destroy',
      setup: () => ({}),
    })

    expect(() => core.use(afterDestroy)).toThrow(/destroyed/)
    expect(() => core.ready()).toThrow(/destroyed/)
    expect(() => core.on('event', () => {})).toThrow(/destroyed/)
    expect(() => core.once('event-once', () => {})).toThrow(/destroyed/)
    expect(core.status).toBe('destroyed')
  })

  it('restores the previous status when setup fails after a reentrant ready call', () => {
    const core = createGridCore()
    const bad = createGridFeature({
      name: 'bad',
      setup(context) {
        context.core.ready()
        throw new Error('setup failed')
      },
    })

    expect(() => core.use(bad)).toThrow('setup failed')
    expect(core.status).toBe('created')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])
  })

  it('does not leak feature state when destroy is called during setup', () => {
    const dispose = vi.fn()
    const core = createGridCore()
    const destroyer = createGridFeature({
      name: 'destroyer',
      setup(context) {
        context.core.destroy()
        return { methods: { leaked: () => 'leaked' }, dispose }
      },
    })

    expect(() => core.use(destroyer)).toThrow('destroyed')
    expect(dispose).toHaveBeenCalledOnce()
    expect(core.status).toBe('destroyed')
    expect(core.features).toEqual([])
    expect(core.methodNames).toEqual([])
    expect(core.hasMethod('leaked')).toBe(false)
  })
})
