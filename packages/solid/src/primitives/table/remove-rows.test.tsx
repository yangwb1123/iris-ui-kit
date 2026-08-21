import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn, IrisTableHandle } from './types'

afterEach(() => vi.restoreAllMocks())

type Row = { id: number; name: string }

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

const rows: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Gamma' },
]

describe('IrisTable handle.removeRows', () => {
  it('marks the root in printable mode for shared print CSS', () => {
    const { container } = render(() => <IrisTable columns={columns} data={rows} printable />)
    expect(container.querySelector('[data-iris-table]')?.getAttribute('data-printable')).toBe(
      'true',
    )
  })

  it('exports the current filtered view through the table handle', () => {
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        filters={{ name: 'al' }}
        tableRef={tableRef}
      />
    ))
    const view = tableRef.current!.getFilteredData()
    expect(view).toEqual([{ id: 1, name: 'Alpha' }])
    expect(view).not.toBe(tableRef.current!.getFilteredData())
    expect(tableRef.current!.exportCurrentViewCsv()).toBe('Name\nAlpha')
  })

  it('removes existing keys once, ignores missing keys, and prunes selection', () => {
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    const onDataChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        selectable="multi"
        defaultSelection={[2]}
        tableRef={tableRef}
        onDataChange={onDataChange}
      />
    ))

    expect(tableRef.current).not.toBeNull()
    tableRef.current!.removeRows([2, 999])

    const body = [...container.querySelectorAll('[data-iris-table-row=""]')]
    expect(body).toHaveLength(2)
    expect(container.textContent).not.toContain('Beta')
    expect(onDataChange).toHaveBeenCalledTimes(1)
    expect(onDataChange.mock.calls[0]![0]).toEqual([
      { id: 1, name: 'Alpha' },
      { id: 3, name: 'Gamma' },
    ])
    expect(container.querySelector('[data-iris-table-row-selected="true"]')).toBeNull()
  })

  it('does not emit or mutate when every key is missing', () => {
    const tableRef: { current: IrisTableHandle<Row> | null } = { current: null }
    const onDataChange = vi.fn()
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        tableRef={tableRef}
        onDataChange={onDataChange}
      />
    ))

    tableRef.current!.removeRows([404, 405])
    expect(container.querySelectorAll('[data-iris-table-row=""]')).toHaveLength(3)
    expect(onDataChange).not.toHaveBeenCalled()
  })
})
