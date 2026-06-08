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
