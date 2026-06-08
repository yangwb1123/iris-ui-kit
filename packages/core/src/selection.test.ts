import { describe, it, expect, vi } from 'vitest'
import { createSelectionModel } from './selection'

describe('createSelectionModel — multiple', () => {
  it('toggles keys and reports membership', () => {
    const sel = createSelectionModel()
    sel.toggle('a')
    sel.toggle('b')
    expect(sel.get()).toEqual(['a', 'b'])
    expect(sel.isSelected('a')).toBe(true)
    sel.toggle('a')
    expect(sel.get()).toEqual(['b'])
  })

  it('page-scoped toggleAll / isAllSelected', () => {
    const sel = createSelectionModel()
    sel.toggleAll(['a', 'b', 'c'])
    expect(sel.isAllSelected(['a', 'b', 'c'])).toBe(true)
    sel.toggleAll(['a', 'b', 'c'])
    expect(sel.get()).toEqual([])
  })

  it('fires onChange with the next selection', () => {
    const onChange = vi.fn()
    const sel = createSelectionModel({ onChange })
    sel.select('x')
    expect(onChange).toHaveBeenCalledWith(['x'])
  })

  it('seeds from defaultSelected and dedupes', () => {
    const sel = createSelectionModel({ defaultSelected: ['a', 'a', 'b'] })
    expect(sel.get()).toEqual(['a', 'b'])
  })
})

describe('createSelectionModel — single', () => {
  it('keeps at most one key; re-toggle clears', () => {
    const sel = createSelectionModel({ mode: 'single' })
    sel.toggle('a')
    expect(sel.get()).toEqual(['a'])
    sel.toggle('b')
    expect(sel.get()).toEqual(['b'])
    sel.toggle('b')
    expect(sel.get()).toEqual([])
  })

  it('set keeps only the last key in single mode', () => {
    const sel = createSelectionModel({ mode: 'single' })
    sel.set(['a', 'b', 'c'])
    expect(sel.get()).toEqual(['c'])
  })
})

describe('createSelectionModel — store + clear', () => {
  it('exposes a subscribable store and clear()', () => {
    const sel = createSelectionModel()
    const seen: string[][] = []
    sel.store.subscribe((s) => seen.push(s))
    sel.select('a')
    sel.clear()
    expect(sel.get()).toEqual([])
    expect(seen.at(-1)).toEqual([])
  })
})
