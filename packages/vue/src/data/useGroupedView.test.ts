import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import type { GroupedViewConfig } from '@iris-ui-kit/core'
import { useGroupedView, type UseGroupedView } from './useGroupedView'

interface Row extends Record<string, unknown> {
  id: number
  category: string
  age: number
}

/** 5 rows across 3 categories with uneven counts (x:2, y:1, z:2). */
const groupedData: Row[] = [
  { id: 1, category: 'x', age: 20 },
  { id: 2, category: 'x', age: 30 },
  { id: 3, category: 'y', age: 40 },
  { id: 4, category: 'z', age: 25 },
  { id: 5, category: 'z', age: 35 },
]

/** Mount a probe that exposes the bridge return (same pattern as useDataSource.test.ts). */
function mountGroupedView(config: GroupedViewConfig<Row, string>) {
  let gv!: UseGroupedView<Row, string>
  const Probe = defineComponent({
    setup() {
      gv = useGroupedView<Row, string>(config)
      return () => h('div', String(gv.state.value.groups.length))
    },
  })
  const wrapper = mount(Probe)
  return { wrapper, get: () => gv }
}

describe('useGroupedView (vue)', () => {
  it('seeds the core store + reactive state synchronously', () => {
    const { get } = mountGroupedView({ keyOf: (r) => r.category })

    // The bridge exposes the core store; useStore seeds it synchronously.
    const store = get().store.getState()
    expect(store.config.keyOf).toBeTypeOf('function')
    expect(store.rows).toEqual([])
    expect(store.columns).toEqual([])
    expect(store.state.isGrouped).toBe(false)

    // `state` is a computed view of the store's state — same object, reactive.
    const s = get().state.value
    expect(s).toBe(store.state)
    expect(s.groups).toEqual([])
    expect(s.aggregates.size).toBe(0)
    expect(s.expanded).toBeInstanceOf(Set)
    expect(s.expanded.size).toBe(0)
  })

  it('setRows groups rows and re-groups on new rows', async () => {
    const { get } = mountGroupedView({ keyOf: (r) => r.category })

    get().setRows(groupedData)
    await nextTick()
    let s = get().state.value
    expect(s.isGrouped).toBe(true)
    expect(s.groups.map((g) => g.key)).toEqual(['x', 'y', 'z'])
    expect(s.groups.map((g) => g.rows.length)).toEqual([2, 1, 2])

    get().setRows(groupedData.filter((r) => r.category === 'x'))
    await nextTick()
    s = get().state.value
    expect(s.groups.map((g) => g.key)).toEqual(['x'])
    expect(s.groups[0].rows).toHaveLength(2)
    expect(s.isGrouped).toBe(true)
  })

  it('toggle/expand/collapse/expandAll/collapseAll mutate expanded', async () => {
    const { get } = mountGroupedView({ keyOf: (r) => r.category })
    get().setRows(groupedData)
    await nextTick()
    expect(get().state.value.expanded.size).toBe(0)

    get().toggleGroup('x')
    await nextTick()
    expect(get().state.value.expanded.has('x')).toBe(true)

    get().toggleGroup('x')
    await nextTick()
    expect(get().state.value.expanded.has('x')).toBe(false)

    get().expandGroup('y')
    await nextTick()
    expect(get().state.value.expanded.has('y')).toBe(true)

    get().collapseGroup('y')
    await nextTick()
    expect(get().state.value.expanded.has('y')).toBe(false)

    get().expandAll()
    await nextTick()
    expect(get().state.value.expanded.size).toBe(3)

    get().collapseAll()
    await nextTick()
    expect(get().state.value.expanded.size).toBe(0)
  })

  it('setConfig re-groups existing rows (keyOf + groupSort)', async () => {
    const { get } = mountGroupedView({ keyOf: (r) => r.category })
    get().setRows(groupedData)
    await nextTick()
    expect(get().state.value.groups.map((g) => g.key)).toEqual(['x', 'y', 'z'])

    get().setConfig({ keyOf: (r) => (r.age >= 30 ? 'senior' : 'junior') })
    await nextTick()
    const s = get().state.value
    expect(s.isGrouped).toBe(true)
    expect(s.groups.map((g) => g.key)).toEqual(['junior', 'senior'])
    expect(s.groups.map((g) => g.rows.length)).toEqual([2, 3])

    // Group-level sort reorders the same groups.
    get().setConfig({ groupSort: 'desc' })
    await nextTick()
    expect(get().state.value.groups.map((g) => g.key)).toEqual(['senior', 'junior'])
  })
})
