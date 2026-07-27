import { describe, it, expect, vi } from 'vitest'
import { createStore, derived } from './store'

describe('Store concurrent behavior', () => {
  it('rapid setState calls coalesce via batch', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    store.subscribe(listener)
    // Simulate rapid keystrokes
    for (let i = 1; i <= 100; i++) {
      store.setState({ count: i })
    }
    // Without batch, each setState fires individually
    expect(listener).toHaveBeenCalledTimes(100)
  })

  it('batch coalesces 100 writes into 1 notification', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    store.subscribe(listener)
    store.batch(() => {
      for (let i = 1; i <= 100; i++) {
        store.setState({ count: i })
      }
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().count).toBe(100)
  })

  it('subscribeWith selector is called on every state change', () => {
    const store = createStore({ a: 1, b: 1 })
    const selector = vi.fn((s: { a: number; b: number }) => s.a)
    const listener = vi.fn()
    store.subscribeWith(selector, listener)
    store.setState({ a: 1, b: 2 })
    expect(selector).toHaveBeenCalled()
  })

  it('derived store updates when source changes', () => {
    const source = createStore(1)
    const doubled = derived([source], (x) => x * 2)
    expect(doubled.getState()).toBe(2)
    source.setState(5)
    expect(doubled.getState()).toBe(10)
  })

  it('multiple derived stores from same source', () => {
    const source = createStore(10)
    const doubled = derived([source], (x) => x * 2)
    const tripled = derived([source], (x) => x * 3)
    expect(doubled.getState()).toBe(20)
    expect(tripled.getState()).toBe(30)
    source.setState(1)
    expect(doubled.getState()).toBe(2)
    expect(tripled.getState()).toBe(3)
  })

  it('subscribe returns unsubscribe that stops notifications', () => {
    const store = createStore(0)
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    store.setState(1)
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
    store.setState(2)
    expect(listener).toHaveBeenCalledTimes(1) // no more calls
  })
})
