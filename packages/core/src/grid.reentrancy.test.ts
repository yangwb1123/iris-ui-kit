import { describe, expect, it, vi } from 'vitest'
import { createGridCore, createGridFeature } from './grid'

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
