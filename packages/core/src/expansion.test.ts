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

  it('does not emit or replace state for equivalent expand-all/set no-ops', () => {
    const onChange = vi.fn()
    const e = createExpansion({ defaultExpanded: ['a'], onChange })
    const states: string[][] = []
    e.store.subscribe((state) => states.push(state))
    const before = e.store.getState()

    e.expandAll(['a', 'a'])
    e.set(['a', 'a'])

    expect(e.store.getState()).toBe(before)
    expect(states).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
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

  it('dedupes SameValueZero numeric keys while preserving insertion order', () => {
    const e = createExpansion<number>({ defaultExpanded: [NaN, Infinity, 0, NaN, -0, Infinity] })

    expect(e.get()).toHaveLength(3)
    expect(Number.isNaN(e.get()[0]!)).toBe(true)
    expect(e.get().slice(1)).toEqual([Infinity, 0])
    expect(e.isExpanded(NaN)).toBe(true)
    expect(e.isExpanded(Infinity)).toBe(true)
    expect(e.isExpanded(0)).toBe(true)

    e.collapse(NaN)
    expect(e.get()).toEqual([Infinity, 0])

    e.expand(NaN)
    expect(e.get()).toHaveLength(3)
    expect(e.get()[0]).toBe(Infinity)
    expect(e.get()[1]).toBe(0)
    expect(Number.isNaN(e.get()[2]!)).toBe(true)
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

describe('createExpansion — external store writes', () => {
  it('isExpanded uses a fresh index after external store.setState()', () => {
    const e = createExpansion()
    e.expand('a')
    expect(e.isExpanded('a')).toBe(true)

    e.store.setState(['b', 'c'])
    expect(e.isExpanded('a')).toBe(false)
    expect(e.isExpanded('b')).toBe(true)
    expect(e.isExpanded('c')).toBe(true)
  })

  it('toggle uses a fresh index during an external batch write', () => {
    const e = createExpansion<string>()

    e.store.batch(() => {
      e.store.setState(['x'])
      expect(e.isExpanded('x')).toBe(true)
      e.toggle('x')
      expect(e.get()).toEqual([])
    })

    expect(e.get()).toEqual([])
    expect(e.isExpanded('x')).toBe(false)
  })

  it('stays consistent when a store subscriber re-enters with another expansion change', () => {
    const e = createExpansion<string>()
    let reentered = false

    e.store.subscribe((keys) => {
      if (!reentered && keys.length === 1 && keys[0] === 'a') {
        reentered = true
        e.expand('b')
      }
    })

    e.expand('a')
    expect(e.get()).toEqual(['a', 'b'])
    expect(e.isExpanded('b')).toBe(true)

    e.collapse('b')
    expect(e.get()).toEqual(['a'])
    expect(e.isExpanded('b')).toBe(false)
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
