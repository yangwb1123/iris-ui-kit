import { describe, it, expect, vi } from 'vitest'
import { createGroupedView } from './grouped-view'
import type { DataViewColumn } from './types'

interface Item {
  category: string
  value: number
  name: string
}

const cols: DataViewColumn<Item>[] = [
  { key: 'category', getValue: (r) => r.category },
  { key: 'value', getValue: (r) => r.value },
  { key: 'name', getValue: (r) => r.name },
]

const data: Item[] = [
  { category: 'fruit', value: 10, name: 'Apple' },
  { category: 'fruit', value: 15, name: 'Banana' },
  { category: 'veg', value: 5, name: 'Carrot' },
  { category: 'fruit', value: 20, name: 'Date' },
  { category: 'veg', value: 8, name: 'Eggplant' },
]

describe('createGroupedView', () => {
  it('groups rows by key function', () => {
    const gv = createGroupedView<Item, string>({ keyOf: (r) => r.category })
    gv.setRows(data, cols)
    const state = gv.getState()
    expect(state.isGrouped).toBe(true)
    expect(state.groups).toHaveLength(2)
    expect(state.groups[0].key).toBe('fruit')
    expect(state.groups[0].rows).toHaveLength(3)
    expect(state.groups[1].key).toBe('veg')
    expect(state.groups[1].rows).toHaveLength(2)
  })

  it('returns empty state when no rows', () => {
    const gv = createGroupedView<Item, string>({ keyOf: (r) => r.category })
    const state = gv.getState()
    expect(state.isGrouped).toBe(false)
    expect(state.groups).toHaveLength(0)
  })

  it('returns empty state when no keyOf', () => {
    const gv = createGroupedView<Item, string>({ keyOf: (r) => r.category })
    gv.setRows(data, cols)
    gv.setConfig({ keyOf: undefined as unknown as (r: Item) => string })
    const state = gv.getState()
    expect(state.isGrouped).toBe(false)
    expect(state.groups).toHaveLength(0)
  })

  it('supports group-level sort', () => {
    const gv = createGroupedView<Item, string>({
      keyOf: (r) => r.category,
      groupSort: 'desc',
    })
    gv.setRows(data, cols)
    const state = gv.getState()
    expect(state.groups[0].key).toBe('veg')
    expect(state.groups[1].key).toBe('fruit')
  })

  it('toggle group expand/collapse', () => {
    const gv = createGroupedView<Item, string>({ keyOf: (r) => r.category })
    gv.setRows(data, cols)
    expect(gv.getState().expanded.has('fruit')).toBe(false)

    gv.toggleGroup('fruit')
    expect(gv.getState().expanded.has('fruit')).toBe(true)

    gv.toggleGroup('fruit')
    expect(gv.getState().expanded.has('fruit')).toBe(false)
  })

  it('expandAll / collapseAll', () => {
    const gv = createGroupedView<Item, string>({ keyOf: (r) => r.category })
    gv.setRows(data, cols)

    gv.expandAll()
    expect(gv.getState().expanded.has('fruit')).toBe(true)
    expect(gv.getState().expanded.has('veg')).toBe(true)

    gv.collapseAll()
    expect(gv.getState().expanded.has('fruit')).toBe(false)
    expect(gv.getState().expanded.has('veg')).toBe(false)
  })

  it('computes aggregates per group (sum)', () => {
    const gv = createGroupedView<Item, string>({
      keyOf: (r) => r.category,
      aggregates: [{ key: 'value', op: 'sum' }],
    })
    gv.setRows(data, cols)
    const state = gv.getState()
    expect(state.aggregates.get('fruit')).toEqual({ value_sum: 45 }) // 10+15+20
    expect(state.aggregates.get('veg')).toEqual({ value_sum: 13 }) // 5+8
  })

  it('computes multiple aggregate ops on the same column', () => {
    const gv = createGroupedView<Item, string>({
      keyOf: (r) => r.category,
      aggregates: [
        { key: 'value', op: 'sum' },
        { key: 'value', op: 'avg' },
        { key: 'value', op: 'min' },
        { key: 'value', op: 'max' },
      ],
    })
    gv.setRows(data, cols)
    const state = gv.getState()
    const fruit = state.aggregates.get('fruit')!
    expect(fruit.value_sum).toBe(45)
    expect(fruit.value_avg).toBe(15) // (10+15+20)/3
    expect(fruit.value_min).toBe(10)
    expect(fruit.value_max).toBe(20)
  })

  it('controlled expanded via config.expanded', () => {
    const gv = createGroupedView<Item, string>({
      keyOf: (r) => r.category,
      expanded: ['fruit'],
    })
    gv.setRows(data, cols)
    expect(gv.getState().expanded.has('fruit')).toBe(true)
    expect(gv.getState().expanded.has('veg')).toBe(false)

    // toggleGroup is a no-op in controlled mode
    gv.toggleGroup('veg')
    expect(gv.getState().expanded.has('veg')).toBe(false)
  })

  it('calls onExpandedChange when internal expanded changes', () => {
    const onExpandedChange = vi.fn()
    const gv = createGroupedView<Item, string>({
      keyOf: (r) => r.category,
      onExpandedChange,
    })
    gv.setRows(data, cols)

    gv.expandGroup('fruit')
    expect(onExpandedChange).toHaveBeenCalledWith(['fruit'])

    gv.expandGroup('veg')
    expect(onExpandedChange).toHaveBeenCalledWith(['fruit', 'veg'])
  })

  it('sets defaultExpanded on init', () => {
    const gv = createGroupedView<Item, string>({
      keyOf: (r) => r.category,
      defaultExpanded: ['fruit'],
    })
    gv.setRows(data, cols)
    expect(gv.getState().expanded.has('fruit')).toBe(true)
    expect(gv.getState().expanded.has('veg')).toBe(false)
  })

  it('is grouped = false when keyOf is missing', () => {
    const gv = createGroupedView<Item, string>({ keyOf: (r) => r.category })
    gv.setRows(data, cols)
    expect(gv.getState().isGrouped).toBe(true)
    gv.setConfig({ keyOf: undefined as unknown as (r: Item) => string })
    expect(gv.getState().isGrouped).toBe(false)
  })

  it('store.subscribe notifies on state changes', () => {
    const gv = createGroupedView<Item, string>({ keyOf: (r) => r.category })
    gv.setRows(data, cols)
    const listener = vi.fn()
    gv.store.subscribe(listener)

    gv.toggleGroup('fruit')
    expect(listener).toHaveBeenCalled()
  })
})
