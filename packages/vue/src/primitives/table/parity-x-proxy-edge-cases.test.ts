import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn, IrisTableExpose, IrisTableProxyQueryParams } from './types'

enableAutoUnmount(afterEach)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25, status: 'active' },
  { id: 2, name: 'Alice', age: 32, status: 'paused' },
  { id: 3, name: 'Bob', age: 28, status: 'active' },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
  { key: 'status', title: 'Status' },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** Flush microtasks (promise resolutions) then the Vue render queue. */
async function settle(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0))
  await nextTick()
}

function nameCells(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('[data-iris-table-cell="name"]').map((c) => c.text())
}

describe('IrisTable proxyConfig (vxe-grid proxyConfig parity, batch X)', () => {
  let host: HTMLDivElement
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })
  afterEach(() => host.remove())

  it('forwards proxy AbortSignal without changing params and keeps one-argument callbacks compatible', async () => {
    const query = vi.fn(
      async (
        params: IrisTableProxyQueryParams,
        signal?: AbortSignal,
      ): Promise<{ rows: Row[]; total: number }> => {
        expect(Object.keys(params)).toEqual(['page', 'pageSize', 'sort', 'filters'])
        expect(signal).toBeInstanceOf(AbortSignal)
        return { rows: [rows[0]], total: 1 }
      },
    )
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query } },
      attachTo: host,
    })
    await settle()
    expect(nameCells(wrapper)).toEqual(['Charlie'])
    expect(query.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal)

    const oneArgumentQuery = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [rows[1]],
      total: 1,
    }))
    const second = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query: oneArgumentQuery } },
      attachTo: host,
    })
    await settle()
    expect(nameCells(second)).toEqual(['Alice'])
  })

  it('forwards Core resilient options without changing proxy params or the initial request count', async () => {
    const query = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [rows[0]],
      total: 1,
    }))
    const wrapper = mount(IrisTable, {
      props: {
        columns,
        data: [],
        rowKey: 'id',
        proxyConfig: { query, resilient: { ttlMs: 60_000 } },
      },
      attachTo: host,
    })
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: {},
    })
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>
    expose.reloadData()
    await settle()
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('aborts stale proxy requests and never publishes their late rows', async () => {
    const first = deferred<{ rows: Row[]; total: number }>()
    const second = deferred<{ rows: Row[]; total: number }>()
    const signals: Array<AbortSignal | undefined> = []
    const query = vi.fn((_params: IrisTableProxyQueryParams, signal?: AbortSignal) => {
      signals.push(signal)
      return signals.length === 1 ? first.promise : second.promise
    })
    const wrapper = mount(IrisTable, {
      props: { columns, data: [], rowKey: 'id', proxyConfig: { query } },
      attachTo: host,
    })
    await nextTick()
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    const expose = wrapper.vm as unknown as IrisTableExpose<Row>
    expose.reloadData()
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]).toBeInstanceOf(AbortSignal)

    second.resolve({ rows: [rows[1]], total: 1 })
    await settle()
    expect(nameCells(wrapper)).toEqual(['Alice'])
    first.resolve({ rows: [rows[0]], total: 1 })
    await settle()
    expect(nameCells(wrapper)).toEqual(['Alice'])
  })
})
