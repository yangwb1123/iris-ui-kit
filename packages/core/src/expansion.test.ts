import { describe, it, expect, vi } from 'vitest'
import { createExpansion } from './expansion'

describe('createExpansion — multiple', () => {
  it('toggles and reports membership', () => {
    const e = createExpansion()
    e.toggle('a')
    e.toggle('b')
    expect(e.get()).toEqual(['a', 'b'])
    expect(e.isExpanded('a')).toBe(true)
    e.toggle('a')
    expect(e.get()).toEqual(['b'])
  })

  it('merge unions in the active trail without removals', () => {
    const e = createExpansion({ defaultExpanded: ['a'] })
    e.merge(['b', 'c'])
    expect(e.get()).toEqual(['a', 'b', 'c'])
    const before = e.get()
    e.merge(['a']) // already present → no-op
    expect(e.get()).toEqual(before)
  })

  it('fires onChange', () => {
    const onChange = vi.fn()
    const e = createExpansion({ onChange })
    e.expand('x')
    expect(onChange).toHaveBeenCalledWith(['x'])
  })
})

describe('createExpansion — boundary safety', () => {
  it('returns an independent get snapshot', () => {
    const e = createExpansion()
    e.set(['a', 'b'])

    const snapshot = e.get()
    snapshot.splice(0, 1)
    snapshot.push('polluted')

    expect(e.get()).toEqual(['a', 'b'])
    expect(e.isExpanded('a')).toBe(true)
    expect(e.isExpanded('polluted')).toBe(false)
  })

  it('does not retain mutable set, merge, or expandAll inputs', () => {
    const e = createExpansion()
    const setInput = ['a']
    e.set(setInput)
    setInput.push('set-polluted')
    expect(e.get()).toEqual(['a'])

    const mergeInput = ['b']
    e.merge(mergeInput)
    mergeInput.push('merge-polluted')
    expect(e.get()).toEqual(['a', 'b'])

    const expandAllInput = ['c']
    e.expandAll(expandAllInput)
    expandAllInput.splice(0, 1, 'expand-all-polluted')
    expect(e.get()).toEqual(['a', 'b', 'c'])
  })

  it('isolates onChange mutations from state and later events', () => {
    const received: string[][] = []
    const e = createExpansion({
      onChange(keys) {
        received.push(keys)
        keys.push('polluted')
      },
    })

    e.expand('a')
    expect(e.get()).toEqual(['a'])
    expect(e.isExpanded('a')).toBe(true)
    expect(e.isExpanded('polluted')).toBe(false)

    e.expand('b')
    expect(e.get()).toEqual(['a', 'b'])
    expect(received).toHaveLength(2)
    expect(received[0]).toEqual(['a', 'polluted'])
    expect(received[1]).toEqual(['a', 'b', 'polluted'])
    expect(received[0]).not.toBe(received[1])
  })
})

describe('createExpansion — single (accordion)', () => {
  it('keeps at most one open', () => {
    const e = createExpansion({ mode: 'single' })
    e.expand('a')
    e.expand('b')
    expect(e.get()).toEqual(['b'])
    e.toggle('b')
    expect(e.get()).toEqual([])
  })
})

describe('createExpansion — edge cases', () => {
  it('starts empty with no defaults', () => {
    expect(createExpansion().get()).toEqual([])
  })

  it('defaultExpanded seeds initial state', () => {
    const e = createExpansion({ defaultExpanded: ['a', 'b'] })
    expect(e.get()).toEqual(['a', 'b'])
  })

  it('collapse removes a single key', () => {
    const e = createExpansion()
    e.expand('a')
    e.expand('b')
    e.collapse('a')
    expect(e.get()).toEqual(['b'])
  })

  it('expand is idempotent', () => {
    const e = createExpansion()
    e.expand('a')
    e.expand('a')
    expect(e.get()).toEqual(['a'])
  })

  it('toggle is idempotent', () => {
    const e = createExpansion()
    e.toggle('a')
    e.toggle('a')
    expect(e.get()).toEqual([])
  })

  it('set replaces all keys', () => {
    const e = createExpansion()
    e.expand('a')
    e.expand('b')
    e.set(['c'])
    expect(e.get()).toEqual(['c'])
  })

  it('collapseAll removes all', () => {
    const e = createExpansion()
    e.expand('a')
    e.expand('b')
    e.collapseAll()
    expect(e.get()).toEqual([])
  })

  it('expand on single mode replaces existing', () => {
    const e = createExpansion({ mode: 'single' })
    e.expand('a')
    e.expand('b')
    expect(e.get()).toEqual(['b'])
  })

  it('store subscribe fires on state changes', () => {
    const e = createExpansion()
    const listener = vi.fn()
    e.store.subscribe(listener)
    e.expand('x')
    expect(listener).toHaveBeenCalled()
  })

  it('store unsubscribe stops notifications', () => {
    const e = createExpansion()
    const listener = vi.fn()
    const unsub = e.store.subscribe(listener)
    e.expand('x')
    expect(listener).toHaveBeenCalledTimes(1)
    unsub()
    e.expand('y')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
