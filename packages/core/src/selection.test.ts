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

  it('membership index stays consistent across mixed ops (Set-backed isSelected)', () => {
    const sel = createSelectionModel<number>()
    sel.toggleAll([1, 2, 3, 4])
    sel.deselect(2)
    sel.toggle(5)
    expect(sel.get()).toEqual([1, 3, 4, 5])
    for (const k of [1, 3, 4, 5]) expect(sel.isSelected(k)).toBe(true)
    for (const k of [2, 6]) expect(sel.isSelected(k)).toBe(false)
    // membership survives a controlled `sync` (which bypasses commit)
    sel.sync([9])
    expect(sel.isSelected(9)).toBe(true)
    expect(sel.isSelected(1)).toBe(false)
  })

  it('deselect of an unselected key is a no-op (no spurious onChange)', () => {
    const onChange = vi.fn()
    const sel = createSelectionModel({ onChange })
    sel.deselect('x')
    expect(onChange).not.toHaveBeenCalled()
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

describe('createSelectionModel — boundary safety', () => {
  it('returns an independent get snapshot', () => {
    const sel = createSelectionModel()
    sel.set(['a', 'b'])

    const snapshot = sel.get()
    snapshot.splice(0, 1)
    snapshot.push('polluted')

    expect(sel.get()).toEqual(['a', 'b'])
    expect(sel.isSelected('a')).toBe(true)
    expect(sel.isSelected('polluted')).toBe(false)
  })

  it('does not retain mutable set or sync inputs', () => {
    const sel = createSelectionModel()
    const setInput = ['a']
    sel.set(setInput)
    setInput.push('set-polluted')
    expect(sel.get()).toEqual(['a'])

    const syncInput = ['b']
    sel.sync(syncInput)
    syncInput.splice(0, 1, 'sync-polluted')
    expect(sel.get()).toEqual(['b'])

    const toggleAllInput = ['c']
    sel.toggleAll(toggleAllInput)
    toggleAllInput.push('toggle-all-polluted')
    expect(sel.get()).toEqual(['b', 'c'])
  })

  it('isolates onChange mutations from state and later events', () => {
    const received: string[][] = []
    const sel = createSelectionModel({
      onChange(keys) {
        received.push(keys)
        keys.push('polluted')
      },
    })

    sel.select('a')
    expect(sel.get()).toEqual(['a'])
    expect(sel.isSelected('a')).toBe(true)
    expect(sel.isSelected('polluted')).toBe(false)

    sel.select('b')
    expect(sel.get()).toEqual(['a', 'b'])
    expect(received).toHaveLength(2)
    expect(received[0]).toEqual(['a', 'polluted'])
    expect(received[1]).toEqual(['a', 'b', 'polluted'])
    expect(received[0]).not.toBe(received[1])
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

describe('createSelectionModel — sync (controlled mirror)', () => {
  it('replaces state WITHOUT firing onChange', () => {
    const onChange = vi.fn()
    const sel = createSelectionModel({ onChange })
    sel.sync(['a', 'b'])
    expect(sel.get()).toEqual(['a', 'b'])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('works with numeric keys', () => {
    const sel = createSelectionModel<number>()
    sel.toggle(1)
    sel.toggle(2)
    expect(sel.get()).toEqual([1, 2])
    expect(sel.isSelected(1)).toBe(true)
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

describe('createSelectionModel — external setState safety', () => {
  it('isSelected updates after external store.setState()', () => {
    const sel = createSelectionModel()
    sel.select('a')
    expect(sel.isSelected('a')).toBe(true)
    // External code calls store.setState directly
    sel.store.setState(['b', 'c'])
    expect(sel.isSelected('a')).toBe(false)
    expect(sel.isSelected('b')).toBe(true)
    expect(sel.isSelected('c')).toBe(true)
  })

  it('isSelected works inside a batch with external setState', () => {
    const sel = createSelectionModel()
    sel.select('a')
    sel.store.batch(() => {
      sel.store.setState(['x'])
      // Inside batch, version diverges but ensureIndex should handle it
      expect(sel.isSelected('x')).toBe(true)
    })
    expect(sel.isSelected('x')).toBe(true)
    expect(sel.isSelected('a')).toBe(false)
  })

  it('isSelected correct after sync inside batch', () => {
    const sel = createSelectionModel()
    sel.select('a')
    sel.store.batch(() => {
      sel.sync(['y', 'z'])
      expect(sel.isSelected('y')).toBe(true)
      expect(sel.isSelected('a')).toBe(false)
    })
    expect(sel.get()).toEqual(['y', 'z'])
  })

  it('version-based lazy rebuild survives repeated external writes', () => {
    const sel = createSelectionModel()
    for (let i = 0; i < 100; i++) {
      sel.store.setState([`key-${i}`])
      expect(sel.isSelected(`key-${i}`)).toBe(true)
    }
  })

  it('toggleAll uses fresh index after external setState', () => {
    const sel = createSelectionModel()
    sel.store.setState(['a', 'b', 'c'])
    expect(sel.isAllSelected(['a', 'b', 'c'])).toBe(true)
    sel.toggleAll(['a', 'b', 'c']) // should deselect all
    expect(sel.get()).toEqual([])
  })

  it('select uses fresh index after external setState', () => {
    const sel = createSelectionModel()
    sel.store.setState(['a'])
    sel.select('b')
    expect(sel.get()).toEqual(['a', 'b'])
  })

  it('deselect uses fresh index after external setState', () => {
    const sel = createSelectionModel()
    sel.store.setState(['a', 'b', 'c'])
    sel.deselect('b')
    expect(sel.get()).toEqual(['a', 'c'])
  })

  it('toggle uses fresh index after external setState', () => {
    const sel = createSelectionModel()
    sel.store.setState(['a'])
    sel.toggle('a') // should deselect
    expect(sel.get()).toEqual([])
    sel.toggle('a') // should reselect
    expect(sel.get()).toEqual(['a'])
  })
})

describe('createSelectionModel — multiple instances isolation', () => {
  it('two independent selection models do not interfere', () => {
    const a = createSelectionModel()
    const b = createSelectionModel()
    a.select('x')
    b.select('y')
    expect(a.get()).toEqual(['x'])
    expect(b.get()).toEqual(['y'])
    expect(a.isSelected('y')).toBe(false)
    expect(b.isSelected('x')).toBe(false)
  })
})
