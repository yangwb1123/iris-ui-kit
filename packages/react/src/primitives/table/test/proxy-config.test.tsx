import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const sortableColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('IrisTable proxyConfig (vxe-grid proxyConfig parity, batch C)', () => {
  it('renders the loading state, then the rows once the query resolves', async () => {
    const d = deferred<{ rows: Row[]; total: number }>()
    const query = vi.fn(() => d.promise)
    const { container } = render(
      <IrisTable columns={baseColumns} data={[]} rowKey="id" proxyConfig={{ query }} />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-row="loading"]')).toBeTruthy()
    })
    await act(async () => {
      d.resolve({ rows: [rows[0]], total: 1 })
    })
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Charlie')
    })
    expect(query).toHaveBeenCalledWith({ page: 1, pageSize: 10, sort: null, filters: {} })
    // The pager renders below the body (proxy mode).
    expect(container.querySelector('[data-iris-table-pager]')).toBeTruthy()
  })

  it('renders the error UI when the query rejects and Retry refetches', async () => {
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ rows: [rows[1]], total: 1 })
    const { container } = render(
      <IrisTable columns={baseColumns} data={[]} rowKey="id" proxyConfig={{ query }} />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-row="error"]')).toBeTruthy()
      expect(container.querySelector('[data-iris-table-retry]')).toBeTruthy()
    })
    fireEvent.click(container.querySelector('[data-iris-table-retry]')!)
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Alice')
    })
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('remoteSort: clicking a sortable header re-queries with the sort param', async () => {
    const query = vi.fn(async () => ({ rows: [rows[1]], total: 3 }))
    const { container } = render(
      <IrisTable
        columns={sortableColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, remoteSort: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'asc' },
      filters: {},
    })
    // Remote sort cycles asc → desc → none on further clicks.
    fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(3))
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: { key: 'name', direction: 'desc' } }),
    )
  })

  it('page change re-queries with page=2 and fires onPageChange', async () => {
    const onPageChange = vi.fn()
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, onPageChange }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.click(container.querySelector('[data-iris-pagination-item="next"]')!)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(query).toHaveBeenLastCalledWith({ page: 2, pageSize: 10, sort: null, filters: {} })
    expect(onPageChange).toHaveBeenCalledWith(2, 10)
  })

  it('autoLoad=false does not query on mount; the first setParams loads', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const { container } = render(
      <IrisTable
        columns={sortableColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, autoLoad: false, remoteSort: true }}
      />,
    )
    expect(query).not.toHaveBeenCalled()
    // A remote sort is the first setParams — it fires the first request.
    fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sort: { key: 'name', direction: 'asc' },
      filters: {},
    })
  })

  it('edit write-back coexists with proxyConfig: local edit survives until the next refetch', async () => {
    const query = vi.fn(async () => ({ rows: [{ id: 1, name: 'Alice', age: 32 }], total: 1 }))
    const columns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true, sortable: true },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, remoteSort: true }}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Alice')
    })
    // Commit an inline edit — the table owns a live copy, so it sticks locally.
    fireEvent.doubleClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const input = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Zoe' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Zoe')
    })
    // The next refetch (here: a remote sort) replaces the local edit.
    query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Server', age: 32 }], total: 1 })
    fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Server')
    })
  })

  it('without remoteSort, the local sort behavior stays (no re-query)', async () => {
    const query = vi.fn(async () => ({ rows: [rows[2], rows[1], rows[0]], total: 3 }))
    const { container } = render(
      <IrisTable columns={sortableColumns} data={[]} rowKey="id" proxyConfig={{ query }} />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.click(container.querySelector('[data-iris-table-header="name"]')!)
    expect(query).toHaveBeenCalledTimes(1)
    const cells = container.querySelectorAll('[data-iris-table-cell="name"]')
    expect(cells[0]?.textContent).toBe('Alice') // sorted client-side (Bob, Alice, Charlie → Alice…)
  })

  it('remoteFilter hands the filter map to the query and skips local filtering', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 1 }))
    const { container, rerender } = render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    rerender(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        filters={{ name: 'Cha' }}
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: { name: 'Cha' },
    })
    expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Charlie')
  })

  it('empty-string filters are inactive: cleared filters go out as {} and dedupe', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const { rerender } = render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    rerender(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        filters={{ name: 'Cha' }}
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    // Clearing the filter ('' = inactive) is forwarded as {} — never { name: '' }.
    rerender(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        filters={{ name: '' }}
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(3))
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: {},
    })
    // A fresh { name: '' } object each render dedupes (no re-query).
    rerender(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        filters={{ name: '' }}
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    expect(query).toHaveBeenCalledTimes(3)
  })

  it('same-value controlled sort with fresh identity does not reset an active page', async () => {
    // The parent re-renders with a NEW inline sort object of the SAME value:
    // the page must stay on 2 (no spurious reset to 1, no re-query).
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const { container, rerender } = render(
      <IrisTable
        columns={sortableColumns}
        data={[]}
        rowKey="id"
        sort={{ key: 'name', direction: 'asc' }}
        proxyConfig={{ query, remoteSort: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.click(container.querySelector('[data-iris-pagination-item="next"]')!)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(query).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, sort: { key: 'name', direction: 'asc' } }),
    )
    rerender(
      <IrisTable
        columns={sortableColumns}
        data={[]}
        rowKey="id"
        sort={{ key: 'name', direction: 'asc' }}
        proxyConfig={{ query, remoteSort: true }}
      />,
    )
    expect(query).toHaveBeenCalledTimes(2)
    const activePage = container.querySelector('[data-iris-pagination-active="true"]')
    expect(activePage?.textContent).toBe('2')
  })

  it('proxyConfig arriving after the first render still auto-loads', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 25 }))
    const { container, rerender } = render(
      <IrisTable columns={baseColumns} data={[rows[0]]} rowKey="id" />,
    )
    expect(query).not.toHaveBeenCalled()
    rerender(<IrisTable columns={baseColumns} data={[]} rowKey="id" proxyConfig={{ query }} />)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Charlie')
    })
  })
})
