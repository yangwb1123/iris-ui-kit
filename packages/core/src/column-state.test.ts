import { describe, expect, it, vi } from 'vitest'
import { createColumnState } from './column-state'

const cols = () => [
  { key: 'a', size: 100 },
  { key: 'b', size: 120 },
  { key: 'c', size: 80 },
]

describe('createColumnState — layout', () => {
  it('resolves defaults and computes offsets + totalWidth', () => {
    const cs = createColumnState({ columns: cols() })
    const s = cs.getState()
    expect(s.visibleColumns.map((c) => c.key)).toEqual(['a', 'b', 'c'])
    expect(s.offsets).toEqual({ a: 0, b: 100, c: 220 })
    expect(s.totalWidth).toBe(300)
    expect(s.columns[0]).toMatchObject({
      key: 'a',
      size: 100,
      minSize: 40,
      pinned: null,
      visible: true,
    })
  })

  it('applies config defaultSize when a column omits size', () => {
    const cs = createColumnState({ columns: [{ key: 'x' }], defaultSize: 200 })
    expect(cs.getState().columns[0]?.size).toBe(200)
  })
})

describe('createColumnState — resize', () => {
  it('setSize clamps to [minSize, maxSize]', () => {
    const cs = createColumnState({ columns: [{ key: 'a', size: 100, minSize: 60, maxSize: 180 }] })
    cs.setSize('a', 1000)
    expect(cs.getState().columns[0]?.size).toBe(180)
    cs.setSize('a', 10)
    expect(cs.getState().columns[0]?.size).toBe(60)
  })

  it('resizeBy adds a delta, clamped', () => {
    const cs = createColumnState({ columns: [{ key: 'a', size: 100, maxSize: 150 }] })
    cs.resizeBy('a', 30)
    expect(cs.getState().columns[0]?.size).toBe(130)
    cs.resizeBy('a', 100)
    expect(cs.getState().columns[0]?.size).toBe(150)
  })

  it('does not emit when size is unchanged', () => {
    const cs = createColumnState({ columns: [{ key: 'a', size: 100 }] })
    const listener = vi.fn()
    cs.subscribe(listener)
    cs.setSize('a', 100)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('createColumnState — pin / visibility', () => {
  it('orders display: left-pinned, unpinned, right-pinned', () => {
    const cs = createColumnState({ columns: cols() })
    cs.setPinned('c', 'left')
    cs.setPinned('a', 'right')
    const s = cs.getState()
    expect(s.visibleColumns.map((x) => x.key)).toEqual(['c', 'b', 'a'])
    expect(s.leftPinned.map((x) => x.key)).toEqual(['c'])
    expect(s.rightPinned.map((x) => x.key)).toEqual(['a'])
    // offsets follow display order
    expect(s.offsets).toEqual({ c: 0, b: 80, a: 200 })
  })

  it('hides a column from visibleColumns + offsets but keeps it in columns', () => {
    const cs = createColumnState({ columns: cols() })
    cs.setVisible('b', false)
    const s = cs.getState()
    expect(s.visibleColumns.map((x) => x.key)).toEqual(['a', 'c'])
    expect(s.offsets).toEqual({ a: 0, c: 100 })
    expect(s.columns.map((x) => x.key)).toEqual(['a', 'b', 'c'])
    cs.toggleVisible('b')
    expect(cs.getState().visibleColumns.map((x) => x.key)).toEqual(['a', 'b', 'c'])
  })
})

describe('createColumnState — reorder', () => {
  it('move repositions a column in logical order', () => {
    const cs = createColumnState({ columns: cols() })
    cs.move('c', 0)
    expect(cs.getState().columns.map((x) => x.key)).toEqual(['c', 'a', 'b'])
  })

  it('moveBefore inserts before a target (or appends on null)', () => {
    const cs = createColumnState({ columns: cols() })
    cs.moveBefore('a', 'c')
    expect(cs.getState().columns.map((x) => x.key)).toEqual(['b', 'a', 'c'])
    cs.moveBefore('b', null)
    expect(cs.getState().columns.map((x) => x.key)).toEqual(['a', 'c', 'b'])
  })
})

describe('createColumnState — serialize / persistence', () => {
  it('round-trips order, sizes, pin, hidden', () => {
    const cs = createColumnState({ columns: cols() })
    cs.move('c', 0)
    cs.setSize('a', 75)
    cs.setPinned('c', 'left')
    cs.setVisible('b', false)
    const snap = cs.serialize()
    expect(snap).toEqual({
      order: ['c', 'a', 'b'],
      sizes: { c: 80, a: 75, b: 120 },
      pinned: { c: 'left', a: null, b: null },
      hidden: ['b'],
    })

    const fresh = createColumnState({ columns: cols() })
    fresh.deserialize(snap)
    const s = fresh.getState()
    expect(s.columns.map((x) => x.key)).toEqual(['c', 'a', 'b'])
    expect(s.columns.find((x) => x.key === 'a')?.size).toBe(75)
    expect(s.visibleColumns.map((x) => x.key)).toEqual(['c', 'a'])
  })

  it('reset restores configured defaults', () => {
    const cs = createColumnState({ columns: cols() })
    cs.move('c', 0)
    cs.setSize('a', 40)
    cs.reset()
    const s = cs.getState()
    expect(s.columns.map((x) => x.key)).toEqual(['a', 'b', 'c'])
    expect(s.columns[0]?.size).toBe(100)
  })
})

describe('createColumnState — setColumns', () => {
  it('preserves live state for surviving keys, drops removed, appends new', () => {
    const cs = createColumnState({ columns: cols() })
    cs.setSize('a', 75)
    cs.move('c', 0) // order c,a,b
    cs.setColumns([{ key: 'a' }, { key: 'b' }, { key: 'd', size: 50 }]) // c removed, d added
    const s = cs.getState()
    // surviving keys keep relative order (c gone) then new key appended
    expect(s.columns.map((x) => x.key)).toEqual(['a', 'b', 'd'])
    // 'a' kept its resized width
    expect(s.columns.find((x) => x.key === 'a')?.size).toBe(75)
    expect(s.columns.find((x) => x.key === 'd')?.size).toBe(50)
  })
})
