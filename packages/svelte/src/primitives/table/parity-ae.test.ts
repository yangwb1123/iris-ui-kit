import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

const columns = [{ key: 'name', title: 'Name', sortable: true }]
const rows = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

function names(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')].map(
    (row) => row.querySelector('[data-iris-table-cell="name"]')?.textContent?.trim() ?? '',
  )
}

describe('IrisTable batch AE — imperative handle', () => {
  it('loads local rows, clears sort/filter, and cleans the ref on unmount', async () => {
    const tableRef: { current: IrisTableHandle | null } = { current: null }
    const onDataChange = vi.fn()
    const onUpdateSort = vi.fn()
    const onFiltersChange = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        tableRef,
        onDataChange,
        onUpdateSort,
        onFiltersChange,
      },
    })
    await waitFor(() => expect(tableRef.current).not.toBeNull())
    tableRef.current!.clearFilter()
    expect(onFiltersChange).toHaveBeenCalledWith({})
    tableRef.current!.loadData([{ id: 3, name: 'Cara' }])
    await waitFor(() => expect(names(view.container)).toEqual(['Cara']))
    expect(onDataChange).toHaveBeenCalledWith([{ id: 3, name: 'Cara' }])

    await fireEvent.click(view.container.querySelector('[data-iris-table-header="name"]')!)
    expect(onUpdateSort).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    tableRef.current!.clearSort()
    expect(onUpdateSort).toHaveBeenLastCalledWith(null)
    view.unmount()
    expect(tableRef.current).toBeNull()
  })

  it('exposes proxy info and forwards commitProxy/reloadData', async () => {
    const calls: Array<{ page: number; pageSize: number }> = []
    const tableRef: { current: IrisTableHandle | null } = { current: null }
    const query = vi.fn(async ({ page, pageSize }: { page: number; pageSize: number }) => {
      calls.push({ page, pageSize })
      return { rows, total: 5 }
    })
    render(IrisTable, {
      props: { columns, tableRef, proxyConfig: { query, pageSize: 2 } },
    })
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(tableRef.current).not.toBeNull())
    expect(tableRef.current!.getProxyInfo()).toEqual({ page: 1, pageSize: 2, total: 5 })
    tableRef.current!.commitProxy({ page: 2 })
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(calls.at(-1)).toEqual({ page: 2, pageSize: 2 })
    tableRef.current!.reloadData()
    await waitFor(() => expect(query).toHaveBeenCalledTimes(3))
  })
})
