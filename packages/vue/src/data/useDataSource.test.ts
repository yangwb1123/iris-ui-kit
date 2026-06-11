import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createClientDataSource, type DataViewColumn } from '@iris-ui/core'
import { useDataSource, type UseDataSource } from './useDataSource'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const data: Row[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 25 },
  { id: 3, name: 'Bob', age: 35 },
]
const columns: DataViewColumn<Row>[] = [
  { key: 'name', getValue: (r) => r.name, filterable: true },
  { key: 'age', getValue: (r) => r.age },
]

/** Mount a probe that exposes the bridge return; settle the async client load. */
async function mountDataSource(config: Parameters<typeof useDataSource<Row>>[0]) {
  let ds!: UseDataSource<Row>
  const Probe = defineComponent({
    setup() {
      ds = useDataSource<Row>(config)
      return () => h('div', String(ds.state.value.rows.length))
    },
  })
  const wrapper = mount(Probe)
  // createClientDataSource's fetcher is async — settle the onMounted load.
  await flushPromises()
  await nextTick()
  return { wrapper, get: () => ds }
}

describe('useDataSource (vue)', () => {
  it('loads on mount and re-sorts reactively', async () => {
    const { get } = await mountDataSource({
      fetcher: createClientDataSource(data, columns),
      pageSize: 10,
    })
    expect(get().state.value.rows).toHaveLength(3)

    get().setSort({ key: 'age', direction: 'asc' })
    await flushPromises()
    await nextTick()
    expect(get().state.value.rows.map((r) => r.age)).toEqual([25, 30, 35])
  })

  it('infinite mode appends via loadMore + flips hasMore', async () => {
    const { get } = await mountDataSource({
      fetcher: createClientDataSource(data, columns),
      pageSize: 2,
      mode: 'infinite',
    })
    expect(get().state.value.rows).toHaveLength(2)
    expect(get().state.value.hasMore).toBe(true)

    await get().loadMore()
    await flushPromises()
    await nextTick()
    expect(get().state.value.rows).toHaveLength(3)
    expect(get().state.value.hasMore).toBe(false)
  })

  it('filters reactively', async () => {
    const { get } = await mountDataSource({
      fetcher: createClientDataSource(data, columns),
      pageSize: 10,
    })
    expect(get().state.value.rows).toHaveLength(3)

    get().setFilter('name', 'li')
    await flushPromises()
    await nextTick()
    expect(
      get()
        .state.value.rows.map((r) => r.name)
        .sort(),
    ).toEqual(['Alice', 'Charlie'])
  })
})
