import { describe, expect, it, vi } from 'vitest'
import { createStore } from './store'
import { createMachine } from './machine'

describe('createStore', () => {
  it('returns the initial state from getState', () => {
    const store = createStore({ count: 0 })
    expect(store.getState()).toEqual({ count: 0 })
  })

  it('setState updates state via value', () => {
    const store = createStore({ count: 0 })
    store.setState({ count: 1 })
    expect(store.getState()).toEqual({ count: 1 })
  })

  it('setState updates state via updater function', () => {
    const store = createStore({ count: 0 })
    store.setState((prev) => ({ count: prev.count + 1 }))
    expect(store.getState()).toEqual({ count: 1 })
  })

  it('notifies subscribers on state change', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    store.subscribe(listener)
    store.setState({ count: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ count: 1 })
  })

  it('does not notify when state is Object.is-equal', () => {
    const store = createStore(0)
    const listener = vi.fn()
    store.subscribe(listener)
    store.setState(0)
    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribe stops further notifications', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.setState({ count: 1 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers', () => {
    const store = createStore(0)
    const a = vi.fn()
    const b = vi.fn()
    store.subscribe(a)
    store.subscribe(b)
    store.setState(1)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('subscribe DURING a notify does not fire for the current emit (snapshot)', () => {
    const store = createStore(0)
    const late = vi.fn()
    store.subscribe(() => store.subscribe(late))
    store.setState(1)
    expect(late).not.toHaveBeenCalled()
    store.setState(2)
    expect(late).toHaveBeenCalledTimes(1)
  })

  it('a listener removed mid-notify by a sibling is skipped, not called stale', () => {
    const store = createStore(0)
    const b = vi.fn()
    let unsub = () => {}
    store.subscribe(() => unsub()) // first listener tears down the second
    unsub = store.subscribe(b)
    store.setState(1)
    expect(b).not.toHaveBeenCalled()
  })

  it('a listener that unsubscribes itself is still called for the current emit', () => {
    const store = createStore(0)
    const self = vi.fn()
    const unsub = store.subscribe((s) => {
      self(s)
      unsub()
    })
    store.setState(1)
    expect(self).toHaveBeenCalledTimes(1)
    store.setState(2)
    expect(self).toHaveBeenCalledTimes(1) // not called again
  })
})

describe('createStore.subscribeWith (selective subscription)', () => {
  it('fires only when the selected slice changes', () => {
    const store = createStore({ a: 1, b: 1 })
    const listener = vi.fn()
    store.subscribeWith((s) => s.a, listener)
    store.setState((s) => ({ ...s, b: 2 })) // a unchanged → no fire
    expect(listener).not.toHaveBeenCalled()
    store.setState((s) => ({ ...s, a: 2 })) // a changed → fire with the slice
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(2)
  })

  it('does not fire on subscribe; captures the current slice', () => {
    const store = createStore({ a: 5 })
    const listener = vi.fn()
    store.subscribeWith((s) => s.a, listener)
    expect(listener).not.toHaveBeenCalled()
  })

  it('honors a custom equals (e.g. shallow array compare)', () => {
    const store = createStore({ ids: [1, 2] as number[] })
    const listener = vi.fn()
    const shallow = (x: number[], y: number[]) =>
      x.length === y.length && x.every((v, i) => v === y[i])
    store.subscribeWith((s) => s.ids, listener, shallow)
    store.setState((s) => ({ ...s, ids: [1, 2] })) // new array, equal contents → no fire
    expect(listener).not.toHaveBeenCalled()
    store.setState((s) => ({ ...s, ids: [1, 2, 3] }))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith([1, 2, 3])
  })

  it('unsubscribe stops slice notifications', () => {
    const store = createStore({ a: 1 })
    const listener = vi.fn()
    const unsub = store.subscribeWith((s) => s.a, listener)
    unsub()
    store.setState({ a: 2 })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('createMachine (smoke)', () => {
  type State = 'closed' | 'open'
  type Event = { type: 'OPEN' } | { type: 'CLOSE'; reason?: string }
  type Context = { reason?: string }

  const make = () =>
    createMachine<State, Context, Event>({
      initial: 'closed',
      context: {},
      states: {
        closed: { on: { OPEN: { target: 'open' } } },
        open: {
          on: {
            CLOSE: {
              target: 'closed',
              actions: (_ctx, event) => ({ reason: event.reason }),
            },
          },
        },
      },
    })

  it('starts in the initial state with the initial context', () => {
    const m = make()
    expect(m.store.getState()).toEqual({ value: 'closed', context: {} })
  })

  it('transitions on a matching event', () => {
    const m = make()
    m.send({ type: 'OPEN' })
    expect(m.store.getState().value).toBe('open')
  })

  it('runs actions to update context', () => {
    const m = make()
    m.send({ type: 'OPEN' })
    m.send({ type: 'CLOSE', reason: 'esc' })
    expect(m.store.getState()).toEqual({ value: 'closed', context: { reason: 'esc' } })
  })

  it('ignores events with no matching transition', () => {
    const m = make()
    const listener = vi.fn()
    m.store.subscribe(listener)
    m.send({ type: 'CLOSE' })
    expect(m.store.getState().value).toBe('closed')
    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies subscribers on transition', () => {
    const m = make()
    const listener = vi.fn()
    m.store.subscribe(listener)
    m.send({ type: 'OPEN' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]).toEqual({ value: 'open', context: {} })
  })

  it('guards block transitions when returning false', () => {
    type GState = 'a' | 'b'
    type GEvent = { type: 'GO'; ok: boolean }
    const m = createMachine<GState, Record<string, never>, GEvent>({
      initial: 'a',
      context: {},
      states: {
        a: {
          on: {
            GO: { target: 'b', guard: (_ctx, e) => e.ok },
          },
        },
        b: {},
      },
    })
    m.send({ type: 'GO', ok: false })
    expect(m.store.getState().value).toBe('a')
    m.send({ type: 'GO', ok: true })
    expect(m.store.getState().value).toBe('b')
  })
})
