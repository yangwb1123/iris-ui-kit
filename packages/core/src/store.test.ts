import { describe, expect, it, vi } from 'vitest'
import { createStore, derived } from './store'
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

describe('createStore.batch', () => {
  it('coalesces N setState calls into ONE notification with the final state', () => {
    const store = createStore({ a: 0, b: 0 })
    const listener = vi.fn()
    store.subscribe(listener)
    store.batch(() => {
      store.setState((s) => ({ ...s, a: 1 }))
      store.setState((s) => ({ ...s, b: 2 }))
      store.setState((s) => ({ ...s, a: 3 }))
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ a: 3, b: 2 })
  })

  it('updates state synchronously inside the batch (getState is current)', () => {
    const store = createStore({ count: 0 })
    store.batch(() => {
      store.setState({ count: 5 })
      expect(store.getState()).toEqual({ count: 5 })
      store.setState((s) => ({ count: s.count + 1 }))
      expect(store.getState()).toEqual({ count: 6 })
    })
    expect(store.getState()).toEqual({ count: 6 })
  })

  it('does not notify when the batch produces no net change path', () => {
    const store = createStore(0)
    const listener = vi.fn()
    store.subscribe(listener)
    store.batch(() => {
      store.setState(0)
      store.setState(0)
    })
    expect(listener).not.toHaveBeenCalled()
  })

  it('nested batches flush once at the outermost boundary', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    store.subscribe(listener)
    store.batch(() => {
      store.setState((s) => ({ count: s.count + 1 }))
      store.batch(() => {
        store.setState((s) => ({ count: s.count + 1 }))
      })
      expect(listener).not.toHaveBeenCalled()
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ count: 2 })
  })

  it('returns the result of fn and flushes even if fn throws', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.batch(() => 42)).toBe(42)
    expect(() =>
      store.batch(() => {
        store.setState({ count: 1 })
        throw new Error('boom')
      }),
    ).toThrow('boom')
    // the write before the throw is still flushed once the batch unwinds
    expect(store.getState()).toEqual({ count: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('batch with no actual state change fires no notification', () => {
    const store = createStore({ x: 1 })
    const listener = vi.fn()
    store.subscribe(listener)
    store.setState({ x: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('derived', () => {
  it('computes its value from the source stores', () => {
    const a = createStore(2)
    const b = createStore(3)
    const sum = derived([a, b], (x, y) => x + y)
    expect(sum.getState()).toBe(5)
  })

  it('recomputes and emits when a source changes', () => {
    const a = createStore(1)
    const doubled = derived([a], (x) => x * 2)
    const listener = vi.fn()
    doubled.subscribe(listener)
    a.setState(5)
    expect(doubled.getState()).toBe(10)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(10)
  })

  it('does not emit when the derived result is unchanged per equals', () => {
    const a = createStore({ n: 1, other: 'x' })
    const justN = derived([a], (s) => s.n)
    const listener = vi.fn()
    justN.subscribe(listener)
    a.setState((s) => ({ ...s, other: 'y' })) // n unchanged
    expect(listener).not.toHaveBeenCalled()
    a.setState((s) => ({ ...s, n: 2 }))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('lazily (un)subscribes from sources by listener reference count', () => {
    let liveSubs = 0
    const base = createStore(0)
    const tracked = {
      ...base,
      subscribe(listener: (s: number) => void) {
        liveSubs++
        const off = base.subscribe(listener)
        return () => {
          liveSubs--
          off()
        }
      },
    }
    const d = derived([tracked], (x) => x + 1)
    expect(liveSubs).toBe(0) // no listeners → no source subscription
    const off1 = d.subscribe(() => {})
    const off2 = d.subscribe(() => {})
    expect(liveSubs).toBe(1) // one source subscription shared across listeners
    off1()
    expect(liveSubs).toBe(1)
    off2()
    expect(liveSubs).toBe(0) // last listener gone → source unsubscribed
  })

  it('getState reflects source changes even while unobserved', () => {
    const a = createStore(1)
    const d = derived([a], (x) => x * 10)
    a.setState(4) // no listeners attached
    expect(d.getState()).toBe(40)
  })

  it('is read-only: setState throws', () => {
    const a = createStore(1)
    const d = derived([a], (x) => x)
    expect(() => d.setState(2)).toThrow(/read-only/)
  })

  it('batch coalesces multiple writes into one notification', () => {
    const store = createStore({ a: 1, b: 2 })
    const listener = vi.fn()
    store.subscribe(listener)
    store.batch(() => {
      store.setState({ a: 2, b: 2 })
      store.setState({ a: 2, b: 3 })
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState()).toEqual({ a: 2, b: 3 })
  })

  it('nested batch joins the outermost flush', () => {
    const store = createStore(0)
    const listener = vi.fn()
    store.subscribe(listener)
    store.batch(() => {
      store.setState(1)
      store.batch(() => {
        store.setState(2)
      })
      store.setState(3)
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState()).toBe(3)
  })

  it('subscribeWith fires only when the selected slice changes', () => {
    const store = createStore({ a: 1, b: 1 })
    const listener = vi.fn()
    store.subscribeWith((s) => s.a, listener)
    store.setState({ a: 1, b: 2 }) // b changes, a does not — no notification
    expect(listener).not.toHaveBeenCalled()
    store.setState({ a: 2, b: 2 }) // a changes — notification fires
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(2)
  })

  it('subscribeWith uses custom equals', () => {
    const store = createStore({ tags: ['a', 'b'] })
    const listener = vi.fn()
    store.subscribeWith(
      (s) => s.tags,
      listener,
      (a, b) => a.length === b.length,
    )
    store.setState({ tags: ['a', 'c'] }) // same length — equals says equal
    expect(listener).not.toHaveBeenCalled()
    store.setState({ tags: ['a'] }) // different length — fires
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('subscribeWith returns an unsubscribe that stops notifications', () => {
    const store = createStore({ x: 1 })
    const listener = vi.fn()
    const unsub = store.subscribeWith((s) => s.x, listener)
    store.setState({ x: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
    store.setState({ x: 3 })
    expect(listener).toHaveBeenCalledTimes(1) // no additional call
  })
})
