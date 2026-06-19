import { describe, it, expect } from 'vitest'
import { createColumnState } from './column-state'

const cols = [
  { key: 'a', title: 'A', width: 100 },
  { key: 'b', title: 'B', width: 200 },
  { key: 'c', title: 'C', width: 150 },
]

describe('createColumnState', () => {
  it('initial state: all columns visible in order', () => {
    const cs = createColumnState(cols)
    expect(cs.visibleColumns().map((c) => c.key)).toEqual(['a', 'b', 'c'])
    expect(cs.allColumns().map((c) => c.key)).toEqual(['a', 'b', 'c'])
  })

  it('toggleColumn hides and shows', () => {
    const cs = createColumnState(cols)
    cs.toggleColumn('b')
    expect(cs.visibleColumns().map((c) => c.key)).toEqual(['a', 'c'])
    expect(cs.isVisible('b')).toBe(false)
    cs.toggleColumn('b')
    expect(cs.visibleColumns().map((c) => c.key)).toEqual(['a', 'b', 'c'])
    expect(cs.isVisible('b')).toBe(true)
  })

  it('hide and show', () => {
    const cs = createColumnState(cols)
    cs.hide('a')
    expect(cs.isVisible('a')).toBe(false)
    cs.show('a')
    expect(cs.isVisible('a')).toBe(true)
  })

  it('setWidth and getWidth', () => {
    const cs = createColumnState(cols)
    expect(cs.getWidth('a')).toBe(100)
    cs.setWidth('a', 250)
    expect(cs.getWidth('a')).toBe(250)
  })

  it('reorder moves columns', () => {
    const cs = createColumnState(cols)
    cs.reorder(0, 2) // a → position 2
    expect(cs.order()).toEqual(['b', 'c', 'a'])
  })

  it('reset restores initial state', () => {
    const cs = createColumnState(cols)
    cs.toggleColumn('b')
    cs.reorder(0, 1)
    cs.setWidth('a', 999)
    cs.reset()
    expect(cs.visibleColumns().map((c) => c.key)).toEqual(['a', 'b', 'c'])
    expect(cs.getWidth('a')).toBe(100)
  })

  it('reset restores INITIALLY-hidden columns (not all-visible)', () => {
    const cs = createColumnState([
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B', hidden: true },
    ])
    expect(cs.isVisible('b')).toBe(false) // b starts hidden
    cs.show('b')
    expect(cs.isVisible('b')).toBe(true)
    cs.reset()
    // reset must restore the INITIAL hidden set, not blanket-show every column
    expect(cs.isVisible('b')).toBe(false)
    expect(cs.visibleColumns().map((c) => c.key)).toEqual(['a'])
  })

  it('subscribe notifies on changes', () => {
    const cs = createColumnState(cols)
    const snapshots: string[][] = []
    cs.subscribe((snap) => snapshots.push(snap.order))
    cs.toggleColumn('b')
    cs.reorder(1, 0)
    expect(snapshots.length).toBe(2)
  })

  it('setOrder replaces column order', () => {
    const cs = createColumnState(cols)
    cs.setOrder(['c', 'a', 'b'])
    expect(cs.order()).toEqual(['c', 'a', 'b'])
  })
})
