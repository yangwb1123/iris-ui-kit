import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, waitFor } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableHandle, IrisTableProxyQueryParams } from './types'

afterEach(cleanup)

const nameCols: IrisTableColumn<{ id: number; name: string }>[] = [
  { key: 'name', title: 'Name', sortable: true },
]

const cellTexts = (container: HTMLElement, key: string): string[] =>
  [...container.querySelectorAll(`[data-iris-table-cell="${key}"]`)].map(
    (c) => (c as HTMLElement).textContent ?? '',
  )

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('IrisTable parity-AA: proxyConfig', () => {
  it('forwards Core resilient options without changing proxy params or the initial request count', async () => {
    const query = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [{ id: 1, name: 'Alice' }],
      total: 1,
    }))
    const tableRef: { current: IrisTableHandle<{ id: number; name: string }> | null } = {
      current: null,
    }
    const { container } = render(() => (
      <IrisTable
        columns={nameCols}
        rowKey="id"
        proxyConfig={{ query, resilient: { ttlMs: 60_000 } }}
        tableRef={tableRef}
      />
    ))
    await waitFor(() => expect(cellTexts(container, 'name')).toEqual(['Alice']))
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0]?.[0]).toEqual({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: {},
    })
    await waitFor(() => expect(tableRef.current).not.toBeNull())
    tableRef.current!.reloadData()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('forwards proxy AbortSignal without changing params and keeps one-argument callbacks compatible', async () => {
    const query = vi.fn(
      async (
        params: IrisTableProxyQueryParams,
        signal?: AbortSignal,
      ): Promise<{ rows: Array<{ id: number; name: string }>; total: number }> => {
        expect(Object.keys(params)).toEqual(['page', 'pageSize', 'sort', 'filters'])
        expect(signal).toBeInstanceOf(AbortSignal)
        return { rows: [{ id: 1, name: 'Alice' }], total: 1 }
      },
    )
    const { container } = render(() => (
      <IrisTable columns={nameCols} rowKey="id" proxyConfig={{ query }} />
    ))
    await waitFor(() => expect(cellTexts(container, 'name')).toEqual(['Alice']))
    expect(query.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal)

    const oneArgumentQuery = vi.fn(async (_params: IrisTableProxyQueryParams) => ({
      rows: [{ id: 2, name: 'Bob' }],
      total: 1,
    }))
    const second = render(() => (
      <IrisTable columns={nameCols} rowKey="id" proxyConfig={{ query: oneArgumentQuery }} />
    ))
    await waitFor(() => expect(cellTexts(second.container, 'name')).toEqual(['Bob']))
  })

  it('aborts stale proxy requests and never publishes their late rows', async () => {
    const first = deferred<{ rows: Array<{ id: number; name: string }>; total: number }>()
    const second = deferred<{ rows: Array<{ id: number; name: string }>; total: number }>()
    const signals: Array<AbortSignal | undefined> = []
    const query = vi.fn((_params: IrisTableProxyQueryParams, signal?: AbortSignal) => {
      signals.push(signal)
      return signals.length === 1 ? first.promise : second.promise
    })
    const tableRef: { current: IrisTableHandle<{ id: number; name: string }> | null } = {
      current: null,
    }
    const { container } = render(() => (
      <IrisTable columns={nameCols} rowKey="id" proxyConfig={{ query }} tableRef={tableRef} />
    ))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(tableRef.current).not.toBeNull())
    tableRef.current!.reloadData()
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]).toBeInstanceOf(AbortSignal)

    second.resolve({ rows: [{ id: 2, name: 'Alice' }], total: 1 })
    await waitFor(() => expect(cellTexts(container, 'name')).toEqual(['Alice']))
    first.resolve({ rows: [{ id: 1, name: 'Charlie' }], total: 1 })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cellTexts(container, 'name')).toEqual(['Alice'])
  })
})
