import { describe, it, expect, vi } from 'vitest'
import { createDisposable, createDisposableScope } from './disposable'

describe('createDisposable', () => {
  it('runs teardowns once, in reverse order', () => {
    const order: number[] = []
    const d = createDisposable(
      () => order.push(1),
      () => order.push(2),
      () => order.push(3),
    )
    expect(d.disposed).toBe(false)
    d.destroy()
    expect(order).toEqual([3, 2, 1]) // LIFO
    expect(d.disposed).toBe(true)
  })

  it('is idempotent — a second destroy() does nothing', () => {
    const fn = vi.fn()
    const d = createDisposable(fn)
    d.destroy()
    d.destroy()
    d.destroy()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('createDisposableScope', () => {
  it('add returns its argument for inline assignment', () => {
    const scope = createDisposableScope()
    const fn = () => {}
    expect(scope.add(fn)).toBe(fn)
    const child = createDisposableScope()
    expect(scope.add(child)).toBe(child)
  })

  it('tracks size and clears it on destroy', () => {
    const scope = createDisposableScope()
    scope.add(() => {})
    scope.add(() => {})
    expect(scope.size).toBe(2)
    scope.destroy()
    expect(scope.size).toBe(0)
  })

  it('destroys child Disposables when the parent is destroyed', () => {
    const scope = createDisposableScope()
    const child = scope.scope()
    const leaf = vi.fn()
    child.add(leaf)
    expect(child.disposed).toBe(false)
    scope.destroy()
    expect(child.disposed).toBe(true)
    expect(leaf).toHaveBeenCalledTimes(1)
  })

  it('runs a child added AFTER destroy immediately (no late leak)', () => {
    const scope = createDisposableScope()
    scope.destroy()
    const fn = vi.fn()
    scope.add(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(scope.size).toBe(0)
  })

  it('isolates teardown errors and rethrows the first', () => {
    const later = vi.fn()
    const scope = createDisposableScope()
    scope.add(later) // registered first → runs LAST (LIFO)
    scope.add(() => {
      throw new Error('boom')
    })
    expect(() => scope.destroy()).toThrow('boom')
    // The error did not prevent the other teardown from running.
    expect(later).toHaveBeenCalledTimes(1)
    expect(scope.disposed).toBe(true)
  })

  it('clearTimeout/clearInterval via addTimeout/addInterval', () => {
    vi.useFakeTimers()
    try {
      const scope = createDisposableScope()
      const timeoutFn = vi.fn()
      const intervalFn = vi.fn()
      scope.addTimeout(setTimeout(timeoutFn, 100))
      scope.addInterval(setInterval(intervalFn, 100))
      scope.destroy()
      vi.advanceTimersByTime(500)
      expect(timeoutFn).not.toHaveBeenCalled()
      expect(intervalFn).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a DOM cleanup registered as a plain teardown runs on destroy', () => {
    // Core stays DOM-agnostic: adapters wrap removeEventListener as a teardown.
    const detach = vi.fn()
    const scope = createDisposableScope()
    scope.add(detach)
    expect(detach).not.toHaveBeenCalled()
    scope.destroy()
    expect(detach).toHaveBeenCalledTimes(1)
  })

  it('destroying the root tears down the whole nested tree exactly once', () => {
    const root = createDisposableScope()
    const child = root.scope()
    const grandchild = child.scope()
    const childFn = vi.fn()
    const grandchildFn = vi.fn()
    child.add(childFn)
    grandchild.add(grandchildFn)
    root.destroy()
    expect(root.disposed).toBe(true)
    expect(child.disposed).toBe(true)
    expect(grandchild.disposed).toBe(true)
    expect(childFn).toHaveBeenCalledTimes(1)
    expect(grandchildFn).toHaveBeenCalledTimes(1)
  })
})
