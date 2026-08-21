import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'
import type { IrisTableHandle } from './types'

afterEach(cleanup)

const columns = [{ key: 'name', title: 'Name' }]
const rows = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' },
]

describe('IrisTable tableRef.removeRows', () => {
  it('marks the root in printable mode for shared print CSS', () => {
    const { container } = render(IrisTable, { props: { columns, data: rows, printable: true } })
    expect(container.querySelector('[data-iris-table]')?.getAttribute('data-printable')).toBe(
      'true',
    )
  })

  it('exports the current filtered view through the table handle', async () => {
    const tableRef: { current: IrisTableHandle | null } = { current: null }
    render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', filters: { name: 'al' }, tableRef },
    })
    await waitFor(() => expect(tableRef.current).not.toBeNull())
    const view = tableRef.current!.getFilteredData()
    expect(view).toEqual([{ id: 1, name: 'Alpha' }])
    expect(view).not.toBe(tableRef.current!.getFilteredData())
    expect(tableRef.current!.exportCurrentViewCsv()).toBe('Name\nAlpha')
  })

  it('removes existing keys once, ignores missing keys, and prunes selection', async () => {
    const tableRef: { current: IrisTableHandle | null } = { current: null }
    const onDataChange = vi.fn()
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        selectable: 'multi',
        defaultSelection: [2],
        tableRef,
        onDataChange,
      },
    })
    await waitFor(() => expect(tableRef.current).not.toBeNull())

    tableRef.current!.removeRows([2, 999])

    await waitFor(() =>
      expect(container.querySelectorAll('[data-iris-table-row=""]')).toHaveLength(2),
    )
    expect(container.textContent).not.toContain('Beta')
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { id: 1, name: 'Alpha' },
      { id: 3, name: 'Gamma' },
    ])
    expect(container.querySelector('[data-iris-table-row-selected="true"]')).toBeNull()
  })

  it('does not emit or mutate when every key is missing', async () => {
    const tableRef: { current: IrisTableHandle | null } = { current: null }
    const onDataChange = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', tableRef, onDataChange },
    })
    await waitFor(() => expect(tableRef.current).not.toBeNull())

    tableRef.current!.removeRows([404, 405])
    expect(container.querySelectorAll('[data-iris-table-row=""]')).toHaveLength(3)
    expect(onDataChange).not.toHaveBeenCalled()
  })
})
