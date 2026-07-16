import { describe, it, expect, vi } from 'vitest'
import { createEventBus, type EventBus } from './event-bus'

// A `type` (not `interface`): an object-literal type satisfies the
// `Record<string, unknown>` constraint, whereas an interface lacks the
// implicit index signature the bus's generic requires.
type TestEvents = {
  ping: { at: number }
  message: string
  count: number
}

describe('createEventBus', () => {
  it('req1: `on` returns a working unsubscribe fn', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    const off = bus.on('message', handler)

    bus.emit('message', 'hello')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('hello')
    expect(bus.listenerCount('message')).toBe(1)

    off()
    bus.emit('message', 'again')
    expect(handler).toHaveBeenCalledTimes(1) // no longer subscribed
    expect(bus.listenerCount('message')).toBe(0)
  })

  it('req2: `once` fires exactly once then auto-removes (count returns to 0)', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    bus.once('count', handler)
    expect(bus.listenerCount('count')).toBe(1)

    bus.emit('count', 1)
    bus.emit('count', 2)
    bus.emit('count', 3)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(1)
    expect(bus.listenerCount('count')).toBe(0)
  })

  it('req2b: the fn returned by `once` unsubscribes before it ever fires', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    const off = bus.once('count', handler)
    off()
    expect(bus.listenerCount('count')).toBe(0)
    bus.emit('count', 1)
    expect(handler).not.toHaveBeenCalled()
  })

  it('req3: `emit` iterates a snapshot — subscribing during emit does NOT call the new handler', () => {
    const bus = createEventBus<TestEvents>()
    const late = vi.fn()
    const first = vi.fn(() => {
      bus.on('count', late)
    })
    bus.on('count', first)

    bus.emit('count', 1)
    expect(first).toHaveBeenCalledTimes(1)
    expect(late).not.toHaveBeenCalled() // added mid-dispatch, skipped this emit

    bus.emit('count', 2)
    expect(late).toHaveBeenCalledTimes(1) // but active on the next emit
  })

  it('req3b: unsubscribing another handler during emit skips it and does not corrupt dispatch', () => {
    const bus = createEventBus<TestEvents>()
    const b = vi.fn()
    const c = vi.fn()
    // `a` removes `b` before the loop reaches it.
    const a = vi.fn(() => bus.off('count', b))
    bus.on('count', a)
    bus.on('count', b)
    bus.on('count', c)

    bus.emit('count', 1)

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled() // removed mid-dispatch, never invoked
    expect(c).toHaveBeenCalledTimes(1) // dispatch continued uncorrupted
  })

  it('req3c: a handler unsubscribing ITSELF during emit is safe and re-runs cleanly', () => {
    const bus = createEventBus<TestEvents>()
    const seen: number[] = []
    const off = bus.on('count', (n) => {
      seen.push(n)
      off()
    })
    bus.emit('count', 1)
    bus.emit('count', 2)
    expect(seen).toEqual([1]) // fired once, then gone
    expect(bus.listenerCount('count')).toBe(0)
  })

  it('req4: error isolation — remaining handlers still run; first error is re-thrown', () => {
    const bus = createEventBus<TestEvents>()
    const boom1 = new Error('boom-1')
    const boom2 = new Error('boom-2')
    const before = vi.fn()
    const throw1 = vi.fn(() => {
      throw boom1
    })
    const throw2 = vi.fn(() => {
      throw boom2
    })
    const after = vi.fn()

    bus.on('count', before)
    bus.on('count', throw1)
    bus.on('count', throw2)
    bus.on('count', after)

    expect(() => bus.emit('count', 1)).toThrow(boom1) // FIRST error re-thrown

    expect(before).toHaveBeenCalledTimes(1)
    expect(throw1).toHaveBeenCalledTimes(1)
    expect(throw2).toHaveBeenCalledTimes(1) // ran despite throw1 throwing
    expect(after).toHaveBeenCalledTimes(1) // ran despite both throwing
  })

  it('req5: `off` with an unregistered handler is a no-op; double-unsubscribe is safe', () => {
    const bus = createEventBus<TestEvents>()
    const registered = vi.fn()
    const never = vi.fn()
    const off = bus.on('message', registered)

    expect(() => bus.off('message', never)).not.toThrow() // never registered
    expect(() => bus.off('count', never)).not.toThrow() // no listeners for type at all
    expect(bus.listenerCount('message')).toBe(1)

    off()
    expect(() => off()).not.toThrow() // double unsubscribe
    expect(() => bus.off('message', registered)).not.toThrow() // off after already gone
    expect(bus.listenerCount('message')).toBe(0)
  })

  it('clear removes handlers for one type, or all types when omitted', () => {
    const bus = createEventBus<TestEvents>()
    bus.on('ping', vi.fn())
    bus.on('message', vi.fn())
    bus.on('count', vi.fn())

    bus.clear('message')
    expect(bus.listenerCount('message')).toBe(0)
    expect(bus.listenerCount('ping')).toBe(1)

    bus.clear()
    expect(bus.listenerCount('ping')).toBe(0)
    expect(bus.listenerCount('count')).toBe(0)
  })

  it('clear during an in-flight emit halts the remaining snapshot', () => {
    const bus = createEventBus<TestEvents>()
    const after = vi.fn()
    bus.on('count', () => bus.clear('count'))
    bus.on('count', after)
    bus.emit('count', 1)
    expect(after).not.toHaveBeenCalled() // cleared out from under the dispatch
  })

  it('off removes every registration of the same handler', () => {
    const bus = createEventBus<TestEvents>()
    const handler = vi.fn()
    bus.on('count', handler)
    bus.on('count', handler)
    expect(bus.listenerCount('count')).toBe(2)
    bus.off('count', handler)
    expect(bus.listenerCount('count')).toBe(0)
  })

  it('req6: typed multi-event example — payloads are inferred per event name', () => {
    // Typed alias proves the generic surface compiles against a concrete shape.
    const bus: EventBus<TestEvents> = createEventBus<TestEvents>()
    const log: string[] = []

    bus.on('ping', (payload) => {
      // payload is { at: number }
      log.push(`ping@${payload.at}`)
    })
    bus.on('message', (payload) => {
      // payload is string
      log.push(payload.toUpperCase())
    })
    bus.on('count', (payload) => {
      // payload is number
      log.push(String(payload * 2))
    })

    bus.emit('ping', { at: 7 })
    bus.emit('message', 'hi')
    bus.emit('count', 21)

    expect(log).toEqual(['ping@7', 'HI', '42'])
  })
})
